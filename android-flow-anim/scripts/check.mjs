#!/usr/bin/env node
/**
 * 渲染前门禁：脚本校验 + 停点校验 + 节奏/文字密度校验。
 * 有 error 直接 exit 1 —— Studio 控制台里的 console.warn 拦不住任何人，这里才是门。
 *
 *   node scripts/check.mjs            # 全部
 *   node scripts/check.mjs --warn-as-error
 */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {loadSources, ROOT} from './bundle.mjs';

const STRICT = process.argv.includes('--warn-as-error');

const {mod, stories} = await loadSources([
  `export {ALL_SCRIPTS} from ${JSON.stringify(`${ROOT}/src/flows`)};`,
  `export {validateScript} from ${JSON.stringify(`${ROOT}/src/dsl/validate`)};`,
  `export {validateStory} from ${JSON.stringify(`${ROOT}/src/layouts/validateStory`)};`,
  `export {validatePacing} from ${JSON.stringify(`${ROOT}/src/dsl/validatePacing`)};`,
  `export {storySeconds} from ${JSON.stringify(`${ROOT}/src/engine/camera`)};`,
  `export {rawClipFor, narrationOn} from ${JSON.stringify(`${ROOT}/src/engine/narration`)};`,
]);
const {ALL_SCRIPTS, TEMPLATE_SCENES, validateScript, validateStory, validatePacing, storySeconds, rawClipFor, narrationOn} = mod;

let errors = 0;
let warns = 0;
/** 同类警告先攒起来：几百条刷屏没人看，默认只给每类前 5 条 + 计数，`--verbose` 打全部 */
const warnBuckets = new Map();
const report = (level, scope, msg) => {
  if (level === 'error') {
    errors++;
    console.log(`ERROR  [${scope}] ${msg}`);
    return;
  }
  warns++;
  const kind = msg.includes('读不完')
    ? '字幕读不完（停点太短 / caption 太长）'
    : msg.includes('画面空转')
      ? '画面空转'
      : msg.includes('幻灯片')
        ? '连续多步画面没变'
        : msg.includes('建议拆成两步')
          ? '停点过长'
          : msg.includes('看不清')
            ? '停点过短'
            : '停点与动画时长不匹配';
  const bucket = warnBuckets.get(kind) ?? [];
  bucket.push(`[${scope}] ${msg}`);
  warnBuckets.set(kind, bucket);
};

// 1. 流程脚本：引用完整性 / 时序合法性（validate.ts 的结论一律算 error）
for (const s of ALL_SCRIPTS) {
  for (const e of validateScript(s)) report('error', `flow:${s.id}`, e);
}

// 2. 停点：动画有没有被冻在半截（validateStory 的结论算 warn）
for (const c of TEMPLATE_SCENES) {
  const name = c.title ?? c.script.title;
  for (const w of validateStory({name, ...c, container: c.options?.taskStack?.container})) {
    report('warn', `story:${name}`, w);
  }
}

// 3. 节奏 / 文字密度 / 幻灯片感
for (const {origin, story} of stories) {
  for (const issue of validatePacing(story)) report(issue.level, `${origin} 第 ${issue.step} 步`, issue.message);
}

// 4. 旁白资产：narration.ts 里登记了时长、音频文件却不在（public/narration 不进 git）
const allSteps = stories.flatMap((s) => s.story.steps);
const files = new Set();
for (const step of allSteps) {
  const clip = rawClipFor(step);
  if (clip) files.add(clip.file);
}
for (const file of files) {
  if (!existsSync(join(ROOT, 'public', file))) {
    // 开了旁白才算错：默片模式下缺音频无所谓
    report(narrationOn() ? 'error' : 'warn', 'narration', `${file} 不存在 —— 跑 npm run narrate 补上`);
  }
}

const narrated = allSteps.filter((s) => rawClipFor(s)).length;
const minutes = stories.reduce((sum, s) => sum + storySeconds(s.story.steps), 0) / 60;

const VERBOSE = process.argv.includes('--verbose');
for (const [kind, list] of [...warnBuckets].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\nWARN  ${kind} × ${list.length}`);
  for (const line of VERBOSE ? list : list.slice(0, 5)) console.log(`  ${line}`);
  if (!VERBOSE && list.length > 5) console.log(`  …还有 ${list.length - 5} 条，加 --verbose 看全部`);
}

console.log(
  `\n分镜 ${stories.length} 份 / 停点 ${allSteps.length} 个，已合成旁白 ${narrated}（${((narrated / allSteps.length) * 100).toFixed(0)}%），` +
    `当前模式：${narrationOn() ? '带旁白（REMOTION_NARRATION=1）' : '默片（默认）'}，总时长约 ${minutes.toFixed(1)} 分钟`,
);
console.log(`错误 ${errors} 条，警告 ${warns} 条`);
process.exit(errors > 0 || (STRICT && warns > 0) ? 1 : 0);
