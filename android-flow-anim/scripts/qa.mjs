#!/usr/bin/env node
// 渲染后自审脚本：确定性检查（容器探测 / 抽帧空白检测 / 音频电平 / 时长核对）
// 判据照搬 OpenMontage 的 visual_qa.py 与 video_compose._run_final_review，
// 只保留确定性部分，不做任何云端或模型调用。
//
// 用法：
//   node scripts/qa.mjs                      # 自动扫 out/*.mp4
//   node scripts/qa.mjs out/boot.mp4 ...     # 指定文件
//   --expect-seconds <秒>                    # 期望时长，偏差 > ±5% 记 issue
//   --keep-frames                            # 抽出的帧保留到 out/qa/<视频名>/
//   --json <path>                            # 写结构化报告

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ---- 常量阈值（与 OpenMontage 一致，除空白帧判据按本仓近黑底色 #0d1117 收紧） ----
const EXPECT_W = 1920;
const EXPECT_H = 1080;
const EXPECT_FPS = 30;
const SAMPLE_POINTS = [0.10, 0.35, 0.65, 0.90];
const BLANK_YAVG = 20;        // 平均亮度低于此值才可能是空白帧
const BLANK_BYTES = 20000;    // 且 PNG 体积小于此值（#0d1117 纯色底 PNG 很小）
const SILENT_MEAN_DB = -60;   // mean_volume 低于此值判 critical
const NARRATION_MEAN_DB = -40;// 高于此值认为有旁白
const CLIP_MAX_DB = -0.5;     // max_volume 高于此值判削顶
const DURATION_TOLERANCE = 0.05;

function run(cmd, args, timeout = 120000) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

function parseArgs(argv) {
  const files = [];
  const opts = { keepFrames: false, json: null, expectSeconds: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--keep-frames') opts.keepFrames = true;
    else if (a === '--json') opts.json = argv[++i];
    else if (a === '--expect-seconds') opts.expectSeconds = Number(argv[++i]);
    else files.push(a);
  }
  return { files, opts };
}

function parseFps(str) {
  if (!str) return 0;
  const [n, d] = String(str).split('/').map(Number);
  if (!d) return n || 0;
  return Math.round((n / d) * 1000) / 1000;
}

// ---- 1. 容器探测 ----
function probe(file) {
  const r = run('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file], 30000);
  if (r.code !== 0) return { valid: false, error: `ffprobe 退出码 ${r.code}` };
  let data;
  try { data = JSON.parse(r.stdout); } catch (e) { return { valid: false, error: `ffprobe 输出解析失败: ${e.message}` }; }
  const streams = data.streams || [];
  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');
  const subs = streams.filter((s) => s.codec_type === 'subtitle');
  const fmt = data.format || {};
  return {
    valid: Boolean(v),
    duration: Number(fmt.duration || 0),
    sizeBytes: Number(fmt.size || 0),
    width: v ? Number(v.width || 0) : 0,
    height: v ? Number(v.height || 0) : 0,
    fps: v ? parseFps(v.r_frame_rate) : 0,
    codec: v ? v.codec_name || 'unknown' : 'none',
    pixFmt: v ? v.pix_fmt || '' : '',
    hasAudio: Boolean(a),
    audioCodec: a ? a.codec_name : null,
    hasSubtitles: subs.length > 0,
    subtitleCount: subs.length,
  };
}

// ---- 2. 抽帧 + 空白检测 ----
function frameYavg(png) {
  const r = run('ffprobe', [
    '-v', 'quiet', '-f', 'lavfi',
    '-i', `movie=${png.replace(/\\/g, '/').replace(/:/g, '\\:')},signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YAVG',
    '-of', 'csv=p=0',
  ], 30000);
  const line = r.stdout.trim().split('\n')[0];
  const val = Number(line);
  return Number.isFinite(val) ? val : null;
}

function spotcheckFrames(file, info, opts) {
  const out = { framesSampled: 0, frames: [], blankFrames: 0, issues: [] };
  if (!info.valid || !(info.duration > 0)) {
    out.issues.push({ level: 'CRITICAL', code: 'no_video', msg: '容器无有效视频流或时长为 0，跳过抽帧' });
    return out;
  }
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const dir = opts.keepFrames
    ? path.join(path.dirname(file), 'qa', base)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'qa-frames-'));
  fs.mkdirSync(dir, { recursive: true });

  for (let i = 0; i < SAMPLE_POINTS.length; i++) {
    const ts = Math.round(info.duration * SAMPLE_POINTS[i] * 100) / 100;
    const png = path.join(dir, `review_frame_${i}.png`);
    run('ffmpeg', ['-y', '-ss', String(ts), '-i', file, '-frames:v', '1', png], 30000);
    if (!fs.existsSync(png)) continue;
    const bytes = fs.statSync(png).size;
    const yavg = frameYavg(png);
    // 双重判据：平均亮度低 且 PNG 体积小，才算「几乎空白」
    const blank = yavg !== null && yavg < BLANK_YAVG && bytes < BLANK_BYTES;
    if (blank) out.blankFrames++;
    out.framesSampled++;
    out.frames.push({ index: i, timestamp: ts, bytes, yavg, blank, path: opts.keepFrames ? png : null });
  }

  if (!opts.keepFrames) fs.rmSync(dir, { recursive: true, force: true });

  if (out.framesSampled < SAMPLE_POINTS.length) {
    out.issues.push({
      level: 'WARN', code: 'frames_missing',
      msg: `只抽到 ${out.framesSampled}/${SAMPLE_POINTS.length} 帧，部分时间点可能越界`,
    });
  }
  if (out.blankFrames >= SAMPLE_POINTS.length) {
    out.issues.push({
      level: 'CRITICAL', code: 'black_frames_detected',
      msg: `${out.blankFrames}/${SAMPLE_POINTS.length} 帧几乎空白（YAVG < ${BLANK_YAVG} 且 PNG < ${BLANK_BYTES}B）——渲染可能整体失败`,
    });
  } else if (out.blankFrames > 0) {
    out.issues.push({
      level: 'WARN', code: 'blank_frame',
      msg: `${out.blankFrames} 帧几乎空白，可能只是转场黑场`,
    });
  }
  return out;
}

// ---- 3. 音频电平 ----
function audioCheck(file, info) {
  const out = { meanDb: null, maxDb: null, narrationPresent: false, issues: [] };
  if (!info.hasAudio) {
    out.issues.push({ level: 'WARN', code: 'no_audio_stream', msg: '没有音轨（默片）' });
    return out;
  }
  const r = run('ffmpeg', ['-i', file, '-af', 'volumedetect', '-f', 'null', '-'], 120000);
  for (const line of (r.stderr || '').split('\n')) {
    if (line.includes('mean_volume:')) {
      const v = Number(line.split('mean_volume:')[1].trim().split(/\s+/)[0]);
      if (Number.isFinite(v)) out.meanDb = v;
    }
    if (line.includes('max_volume:')) {
      const v = Number(line.split('max_volume:')[1].trim().split(/\s+/)[0]);
      if (Number.isFinite(v)) out.maxDb = v;
    }
  }
  if (out.meanDb !== null) {
    if (out.meanDb < SILENT_MEAN_DB) {
      out.issues.push({ level: 'CRITICAL', code: 'unexpected_silence', msg: `mean_volume ${out.meanDb.toFixed(1)} dB —— effectively silent` });
    }
    if (out.meanDb > NARRATION_MEAN_DB) {
      out.narrationPresent = true;
      out.issues.push({ level: 'INFO', code: 'narration_present', msg: `mean_volume ${out.meanDb.toFixed(1)} dB，判定旁白存在` });
    }
  }
  if (out.maxDb !== null && out.maxDb > CLIP_MAX_DB) {
    out.issues.push({ level: 'WARN', code: 'clipping_detected', msg: `max_volume ${out.maxDb.toFixed(1)} dB —— 可能削顶` });
  }
  return out;
}

// ---- 容器期望值核对 + 时长核对 ----
function containerIssues(info, opts) {
  const issues = [];
  if (!info.valid) {
    issues.push({ level: 'CRITICAL', code: 'invalid_container', msg: info.error || '容器无视频流' });
    return issues;
  }
  if (info.width !== EXPECT_W || info.height !== EXPECT_H) {
    issues.push({ level: 'WARN', code: 'resolution_mismatch', msg: `分辨率 ${info.width}x${info.height}，期望 ${EXPECT_W}x${EXPECT_H}` });
  }
  if (Math.abs(info.fps - EXPECT_FPS) > 0.01) {
    issues.push({ level: 'WARN', code: 'fps_mismatch', msg: `fps ${info.fps}，期望 ${EXPECT_FPS}` });
  }
  if (info.duration < 1.0) {
    issues.push({ level: 'CRITICAL', code: 'too_short', msg: `时长只有 ${info.duration.toFixed(1)}s，异常短` });
  }
  if (info.hasSubtitles) {
    issues.push({ level: 'INFO', code: 'subtitle_stream', msg: `含 ${info.subtitleCount} 条字幕流` });
  }
  if (opts.expectSeconds && opts.expectSeconds > 0) {
    const drift = Math.abs(info.duration - opts.expectSeconds) / opts.expectSeconds;
    if (drift > DURATION_TOLERANCE) {
      issues.push({
        level: 'WARN', code: 'duration_drift',
        msg: `时长 ${info.duration.toFixed(2)}s 与期望 ${opts.expectSeconds}s 偏差 ${(drift * 100).toFixed(1)}%（> ${DURATION_TOLERANCE * 100}%）`,
      });
    }
  }
  return issues;
}

function checkFile(file, opts) {
  const info = probe(file);
  const issues = containerIssues(info, opts);
  const visual = info.valid ? spotcheckFrames(file, info, opts) : { framesSampled: 0, frames: [], blankFrames: 0, issues: [] };
  const audio = info.valid ? audioCheck(file, info) : { meanDb: null, maxDb: null, issues: [] };
  const all = [...issues, ...visual.issues, ...audio.issues];
  const critical = all.filter((i) => i.level === 'CRITICAL').length;
  return { file, info, visual, audio, issues: all, critical, verdict: critical > 0 ? 'FAIL' : 'PASS' };
}

// ---- 输出 ----
const LEVEL_COLOR = { CRITICAL: '\x1b[31m', WARN: '\x1b[33m', INFO: '\x1b[36m' };
const RESET = '\x1b[0m';

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function printTable(results) {
  const cols = [['文件', 30], ['时长', 9], ['分辨率', 11], ['fps', 7], ['音轨', 6], ['mean_dB', 9], ['结论', 6]];
  console.log(cols.map(([t, w]) => pad(t, w)).join(' '));
  console.log(cols.map(([, w]) => '-'.repeat(w)).join(' '));
  for (const r of results) {
    const i = r.info;
    console.log([
      pad(path.basename(r.file), 30),
      pad(i.valid ? `${i.duration.toFixed(2)}s` : '-', 9),
      pad(i.valid ? `${i.width}x${i.height}` : '-', 11),
      pad(i.valid ? i.fps : '-', 7),
      pad(i.hasAudio ? '有' : '无', 6),
      pad(r.audio.meanDb === null ? '-' : r.audio.meanDb.toFixed(1), 9),
      pad(r.verdict, 6),
    ].join(' '));
  }
}

function main() {
  const { files, opts } = parseArgs(process.argv.slice(2));
  let targets = files;
  if (targets.length === 0) {
    const outDir = path.resolve('out');
    if (!fs.existsSync(outDir)) {
      console.error('out/ 不存在，且未指定文件');
      process.exit(2);
    }
    targets = fs.readdirSync(outDir).filter((f) => f.endsWith('.mp4')).sort().map((f) => path.join('out', f));
  }
  if (targets.length === 0) {
    console.error('没有可检查的 mp4');
    process.exit(2);
  }

  const results = [];
  for (const f of targets) {
    if (!fs.existsSync(f)) {
      console.error(`跳过：${f} 不存在`);
      continue;
    }
    results.push(checkFile(f, opts));
  }

  printTable(results);
  for (const r of results) {
    if (r.issues.length === 0) continue;
    console.log(`\n${path.basename(r.file)}:`);
    for (const it of r.issues) {
      console.log(`  ${LEVEL_COLOR[it.level] || ''}${pad(it.level, 8)}${RESET} [${it.code}] ${it.msg}`);
    }
  }

  const totalCritical = results.reduce((s, r) => s + r.critical, 0);
  console.log(`\n共 ${results.length} 个文件，critical ${totalCritical} 条。`);

  if (opts.json) {
    fs.mkdirSync(path.dirname(path.resolve(opts.json)), { recursive: true });
    fs.writeFileSync(opts.json, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
    console.log(`报告已写入 ${opts.json}`);
  }

  process.exit(totalCritical > 0 ? 1 : 0);
}

main();
