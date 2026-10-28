import type {Step} from '../dsl/types';
import {NARRATION, type NarrationClip} from '../generated/narration';

export type {NarrationClip};

/** 旁白念完后留的呼吸时间（秒）；也吃掉 SceneFade 末尾 8 帧的淡出 */
export const NARRATION_TAIL = 0.5;

/**
 * 旁白默认**关**：技术文档念出来的机器腔会拖慢节奏，想要时再显式打开。
 *   REMOTION_NARRATION=1 npm run render:service
 * Remotion 只把 `REMOTION_` 前缀的环境变量注入到浏览器 bundle（`@remotion/cli` 的 getProcessEnv），
 * 所以这个开关在 Studio、render、node 脚本三边是同一个判断。
 * 写成函数而不是常量：bundle 里环境变量是运行期注入的，模块初始化时读可能还没就绪。
 */
export const narrationOn = (): boolean => process.env.REMOTION_NARRATION === '1';

/**
 * caption → 可朗读文本。
 * 画面上的装饰符号（编号圈、箭头、分隔点）念出来很怪，这里统一洗掉。
 * Step.speak 优先：caption 里符号太多时手工写一份口播稿。
 */
export const speechText = (step: Step | string): string => {
  const raw = typeof step === 'string' ? step : (step.speak ?? step.caption);
  return raw
    .replace(/[\u2460-\u2473]/g, '') // ①②③…⑳
    .replace(/[`「」『』【】]/g, '')
    .replace(/[⇒→]/g, '到')
    .replace(/[·•|]/g, '，')
    .replace(/\s*\n\s*/g, '，')
    .replace(/\s+/g, ' ')
    .replace(/，+/g, '，')
    .replace(/^[，\s]+|[，\s]+$/g, '')
    .trim();
};

/** FNV-1a 32 位；脚本侧与渲染侧共用这一份实现，保证 key 一致 */
export const narrationKey = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

/** 查这句的旁白音频；旁白没开就一律当作没有，时长回填 / 音轨 / 字幕点亮一起退回默片行为 */
export const clipFor = (step: Step | string): NarrationClip | undefined => {
  if (!narrationOn()) return undefined;
  const text = speechText(step);
  if (!text) return undefined;
  return NARRATION[narrationKey(text)];
};

/** 不看开关的原始查表：给 npm run check 统计覆盖率用 */
export const rawClipFor = (step: Step | string): NarrationClip | undefined => NARRATION[narrationKey(speechText(step))];

/**
 * 这句念到哪了（0~1）。
 * marks 是 [句子开始秒, 该句之前已念字数]（edge 给的边界事件；中文音色只有句级）。
 * 没有 marks 就按时长线性推——线性在长句里会和人声差出一两个字。
 */
export const spokenRatio = (clip: NarrationClip, localSec: number): number => {
  if (!clip.marks?.length) return Math.min(1, Math.max(0, localSec / (clip.duration * 0.92)));
  const total = clip.text.length;
  if (localSec <= clip.marks[0][0]) return 0;
  for (let i = clip.marks.length - 1; i >= 0; i--) {
    const [t, chars] = clip.marks[i];
    if (localSec < t) continue;
    const [nextT, nextChars] = clip.marks[i + 1] ?? [clip.duration, total];
    const p = (localSec - t) / Math.max(nextT - t, 0.01);
    return Math.min(1, (chars + (nextChars - chars) * Math.min(p, 1)) / total);
  }
  return 0;
};

/**
 * 真实停留时长：有旁白时至少要念得完（+ 一口气）。
 * storySeconds / buildKeyframes 都走这一个函数，时间轴才不会两边对不上。
 */
export const effectiveHold = (step: Step): number => {
  const clip = clipFor(step);
  if (!clip) return step.hold;
  return Math.max(step.hold, clip.duration + NARRATION_TAIL - Math.max(step.move, 0.01));
};
