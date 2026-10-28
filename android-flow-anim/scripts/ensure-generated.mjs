/**
 * `src/generated/narration.ts` 是 `npm run narrate` 的产物，不进仓（它引用的 mp3 也不进仓）。
 * 没有它 TS 编译和打包都会直接失败，所以这里兜底生成一份**空表**：
 * 空表 = 没有任何旁白，渲染自然退回默片，不影响任何现有行为。
 *
 * 调用点：`remotion.config.ts`（覆盖 studio / render / still）、`scripts/bundle.mjs`（覆盖 node 脚本）、
 * `package.json` 的 `prepare`（覆盖 npm i）与 `explorer`。
 *
 * 注意：remotion.config.ts 会被 Remotion CLI 用 esbuild 打成 CJS，**这里不能用 import.meta**，
 * 否则报 'You need to set the output format to "esm" for "import.meta" to work correctly'。
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';

export const STUB = `/**
 * 由 \`npm run narrate\` 生成，勿手改；缺失时由 scripts/ensure-generated.mjs 兜底成空表。
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

/* narration-data:start */
const DATA = {} as Record<string, NarrationClip>;
/* narration-data:end */

export const NARRATION = DATA;
`;

/** @param root 仓根；默认取 cwd（npm 脚本与 remotion CLI 都在仓根下跑） */
export const ensureGeneratedNarration = (root = process.cwd()) => {
  const generated = join(root, 'src', 'generated', 'narration.ts');
  if (existsSync(generated)) return false;
  mkdirSync(dirname(generated), {recursive: true});
  writeFileSync(generated, STUB);
  return true;
};

// 直接 `node scripts/ensure-generated.mjs`（npm 的 prepare / explorer 钩子走这条）
if (process.argv[1]?.endsWith('ensure-generated.mjs') && ensureGeneratedNarration()) {
  console.log('已生成空的 src/generated/narration.ts（跑 npm run narrate 填充旁白）');
}
