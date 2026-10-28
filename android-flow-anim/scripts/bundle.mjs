/**
 * 把仓里所有可能含分镜的 TS/TSX 打成一个临时 ESM bundle 再 import 回来，
 * 让 node 脚本（narrate / check）能直接拿到 FlowStory、校验函数等源码里的东西。
 * react / remotion 走 external，由 node 自己从 node_modules 解析。
 */
import {execFileSync} from 'node:child_process';
import {mkdirSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ensureGeneratedNarration} from './ensure-generated.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

ensureGeneratedNarration(ROOT);

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
};

/** 鸭子类型认 FlowStory：{steps: [{caption, hold, …}]} */
export const isStory = (v) =>
  Boolean(v) &&
  typeof v === 'object' &&
  Array.isArray(v.steps) &&
  v.steps.length > 0 &&
  v.steps.every((s) => s && typeof s.caption === 'string' && typeof s.hold === 'number');

/**
 * @param {string[]} extraExports 额外要从源码里导出的 `export {a, b} from '<src 相对路径>'` 规格
 * @returns {Promise<{mod: any, sources: string[], stories: {origin: string, story: any}[]}>}
 */
export const loadSources = async (extraExports = []) => {
  const sources = [...walk(join(ROOT, 'src', 'flows')), ...walk(join(ROOT, 'src', 'videos'))];
  const entryPath = join(ROOT, 'out', '.bundle-entry.ts');
  const bundlePath = join(ROOT, 'out', `.bundle-${process.pid}.mjs`);
  mkdirSync(join(ROOT, 'out'), {recursive: true});

  writeFileSync(
    entryPath,
    [
      `export {speechText, narrationKey} from ${JSON.stringify(join(ROOT, 'src/engine/narration'))};`,
      `export {TEMPLATE_SCENES} from ${JSON.stringify(join(ROOT, 'src/layouts/TemplateScene'))};`,
      ...extraExports,
      ...sources.map((p, i) => `export * as m${i} from ${JSON.stringify(p)};`),
      `export const SOURCES = ${JSON.stringify(sources.map((p) => relative(ROOT, p)))};`,
    ].join('\n'),
  );

  execFileSync(
    join(ROOT, 'node_modules', '.bin', 'esbuild'),
    [
      entryPath,
      '--bundle',
      '--format=esm',
      '--platform=node',
      '--jsx=automatic',
      '--log-level=error',
      '--external:react',
      '--external:react-dom',
      '--external:remotion',
      '--external:@remotion/*',
      `--outfile=${bundlePath}`,
    ],
    {cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit']},
  );

  const mod = await import(`file://${bundlePath}`);
  rmSync(entryPath, {force: true});
  rmSync(bundlePath, {force: true});

  const stories = [];
  mod.SOURCES.forEach((src, i) => {
    const m = mod[`m${i}`];
    if (!m) return;
    for (const [name, value] of Object.entries(m)) {
      if (isStory(value)) stories.push({origin: `${src}#${name}`, story: value});
    }
  });
  for (const cfg of mod.TEMPLATE_SCENES ?? []) {
    if (isStory(cfg.story)) stories.push({origin: `模板场景:${cfg.title ?? cfg.script?.title ?? '?'}`, story: cfg.story});
  }

  return {mod, sources: mod.SOURCES, stories};
};
