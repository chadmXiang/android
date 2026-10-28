#!/usr/bin/env node
/**
 * 旁白生成器：扫出所有分镜的 caption → 本地 TTS 合成 → 写 public/narration/*.mp3
 * 与 src/generated/narration.ts（key → {file, duration, text}）。
 *
 * 全离线：TTS 优先 piper（跨平台，设 PIPER_MODEL 选音色），没有就用 macOS 自带的 say（zh_CN 婷婷）。
 * 时长由 ffprobe 实测，渲染侧 engine/narration.ts 的 effectiveHold 据此回填 hold。
 *
 * 用法：
 *   node scripts/narrate.mjs                      # 全量（已存在的音频跳过）
 *   node scripts/narrate.mjs --match am/service   # 只做匹配该源码路径/故事名的流程
 *   node scripts/narrate.mjs --force              # 重新合成
 *   node scripts/narrate.mjs --dry                # 只统计，不合成
 *   node scripts/narrate.mjs --voice Tingting --rate 185
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadSources, ROOT} from './bundle.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const MATCH = opt('--match') ? new RegExp(opt('--match')) : null;
const FORCE = flag('--force');
const DRY = flag('--dry');

const EDGE_PY = join(ROOT, '.venv-tts', 'bin', 'python');
/** edge（微软神经网络音色，联网免费）> piper（离线）> say（macOS 自带，最差） */
const ENGINE = opt('--engine', existsSync(EDGE_PY) ? 'edge' : spawnSync('piper', ['--help'], {stdio: 'ignore'}).error ? 'say' : 'piper');
const VOICE = opt('--voice', {edge: 'zh-CN-YunyangNeural', piper: process.env.PIPER_MODEL ?? 'zh_CN-huayan-medium', say: 'Tingting'}[ENGINE]);
const RATE = opt('--rate', {edge: '+8%', piper: '1.0', say: '180'}[ENGINE]);
const CONCURRENCY = opt('--concurrency', '8');

const OUT_AUDIO_DIR = join(ROOT, 'public', 'narration');
const GENERATED = join(ROOT, 'src', 'generated', 'narration.ts');

const {mod, sources, stories} = await loadSources();
const {speechText, narrationKey} = mod;

/** key → {text, origins:Set<string>} */
const wanted = new Map();
for (const {origin, story} of stories) {
  if (MATCH && !MATCH.test(origin)) continue;
  for (const step of story.steps) {
    const text = speechText(step);
    if (!text) continue;
    const key = narrationKey(text);
    const hit = wanted.get(key) ?? {text, origins: new Set()};
    hit.origins.add(origin);
    wanted.set(key, hit);
  }
}

console.log(`扫到 ${sources.length} 个源文件 / ${stories.length} 份分镜，${wanted.size} 条待合成旁白${MATCH ? `（--match ${MATCH}）` : ''}`);
if (DRY) {
  for (const [key, {text, origins}] of wanted) console.log(`  ${key}  ${text.slice(0, 40)}…  ←  ${[...origins][0]}`);
  process.exit(0);
}

// —— 合成 ——

mkdirSync(OUT_AUDIO_DIR, {recursive: true});
const TMP_DIR = join(ROOT, 'out', 'tts-raw');
mkdirSync(TMP_DIR, {recursive: true});

/** 人声链：80Hz 高通去隆隆 + 2.5kHz 抬清晰度 + loudnorm 到 -16 LUFS（照搬 OpenMontage audio_enhance/audio_mixer） */
const master = (src, mp3Path) => {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', src,
    '-af', 'highpass=f=80,equalizer=f=2500:t=q:w=1.2:g=2.5,loudnorm=I=-16:LRA=11:TP=-1.5,aresample=48000',
    '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k',
    mp3Path,
  ]);
  rmSync(src, {force: true});
};

const todo = [...wanted].filter(([key]) => FORCE || !existsSync(join(OUT_AUDIO_DIR, `${key}.mp3`)));
const marksByKey = new Map();

const failed = [];

if (todo.length && ENGINE === 'edge') {
  // 一个 python 进程批量跑，内部 asyncio 并发 + 超时重试；顺带拿句边界给字幕逐字点亮。
  // out/tts-raw 里已有的原始音频直接复用 —— 上一次跑到一半被打断时不用从头再来。
  const jobs = todo
    .map(([key, {text}]) => ({key, text, out: join(TMP_DIR, `${key}.mp3`)}))
    .filter((j) => !existsSync(j.out));
  if (jobs.length < todo.length) console.log(`复用 out/tts-raw 里已合成的 ${todo.length - jobs.length} 条`);
  if (jobs.length) {
    const res = spawnSync(
      EDGE_PY,
      [join(ROOT, 'scripts', 'edge_tts_batch.py'), '--voice', VOICE, '--rate', RATE, '--concurrency', CONCURRENCY],
      {input: JSON.stringify(jobs), encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'inherit']},
    );
    if (res.status !== 0) throw new Error(`edge-tts 批量合成失败（exit ${res.status}）`);
  }
  for (const [key] of todo) {
    const raw = join(TMP_DIR, `${key}.mp3`);
    if (!existsSync(raw)) {
      failed.push(key);
      continue;
    }
    const marksFile = `${raw}.json`;
    if (existsSync(marksFile)) {
      marksByKey.set(key, JSON.parse(readFileSync(marksFile, 'utf8')));
      rmSync(marksFile, {force: true});
    }
    master(raw, join(OUT_AUDIO_DIR, `${key}.mp3`));
  }
} else {
  for (const [i, [key, {text}]] of todo.entries()) {
    const raw = join(TMP_DIR, `${key}.${ENGINE === 'piper' ? 'wav' : 'aiff'}`);
    if (ENGINE === 'piper') {
      execFileSync('piper', ['--model', VOICE, '--length-scale', RATE, '--sentence-silence', '0.35', '--output_file', raw], {input: text});
    } else {
      // macOS say：离线，zh_CN 只有婷婷一个音色。aiff 只能用默认大端格式，指定 LEI16 会报 "Opening output file failed: fmt?"
      execFileSync('say', ['-v', VOICE, '-r', String(RATE), '-o', raw], {input: text});
    }
    master(raw, join(OUT_AUDIO_DIR, `${key}.mp3`));
    process.stderr.write(`\r合成 ${i + 1}/${todo.length}`);
  }
  if (todo.length) process.stderr.write('\n');
}

const probeDuration = (p) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).toString().trim());

const clips = {};
for (const [key, {text}] of wanted) {
  const file = `narration/${key}.mp3`;
  if (!existsSync(join(ROOT, 'public', file))) continue; // 合成失败的跳过，下次 narrate 再补
  const marks = marksByKey.get(key);
  clips[key] = {file, duration: Math.round(probeDuration(join(ROOT, 'public', file)) * 1000) / 1000, text, ...(marks?.length ? {marks} : {})};
}
const made = todo.length - failed.length;
const reused = wanted.size - todo.length;

// —— 写回 generated（保留本次没命中的旧条目，支持分批合成） ——

const DATA_START = '/* narration-data:start */';
const DATA_END = '/* narration-data:end */';

let previous = {};
if (existsSync(GENERATED)) {
  const src = readFileSync(GENERATED, 'utf8');
  const from = src.indexOf(DATA_START);
  const to = src.indexOf(DATA_END);
  if (from >= 0 && to > from) {
    const json = src
      .slice(from + DATA_START.length, to)
      .replace(/^\s*const DATA =/, '')
      .replace(/as Record<[^>]*>;\s*$/, '')
      .trim();
    previous = JSON.parse(json.replace(/;\s*$/, ''));
  }
}
const merged = {...previous, ...clips};
for (const key of Object.keys(merged)) {
  if (!existsSync(join(ROOT, 'public', merged[key].file))) delete merged[key];
}

const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(
  GENERATED,
  `/**
 * 由 \`npm run narrate\` 生成，勿手改。
 * key = narrationKey(speechText(caption))，见 src/engine/narration.ts。
 */
export interface NarrationClip {
  /** 相对 public/ 的路径，交给 staticFile() */
  file: string;
  /** 音频时长（秒），ffprobe 实测 */
  duration: number;
  /** 合成时实际念的文本（清洗后） */
  text: string;
  /** 词边界：[开始秒, 到这个词为止念完的字数]；edge 引擎才有，字幕按它逐字点亮 */
  marks?: [number, number][];
}

${DATA_START}
const DATA = ${JSON.stringify(sorted, null, 2)} as Record<string, NarrationClip>;
${DATA_END}

export const NARRATION = DATA;
`,
);

const total = Object.values(merged).reduce((s, c) => s + c.duration, 0);
console.log(
  `完成：新合成 ${made}、复用 ${reused}${failed.length ? `、失败 ${failed.length}（再跑一次即可补上：${failed.slice(0, 5).join(' ')}${failed.length > 5 ? ' …' : ''}）` : ''}；` +
    `narration.ts 共 ${Object.keys(merged).length} 条，总时长 ${(total / 60).toFixed(1)} 分钟（引擎：${ENGINE} / ${VOICE} / rate ${RATE}）`,
);
if (failed.length) process.exitCode = 1;
