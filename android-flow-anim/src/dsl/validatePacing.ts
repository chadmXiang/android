import type {FlowStory, Step} from './types';
import {clipFor, effectiveHold} from '../engine/narration';
import {textWidth} from '../engine/text';

/**
 * 节奏 / 文字密度校验：把"快了慢了、字多字少"变成可判定的阈值。
 * 阈值来源：OpenMontage styles/minimalist-diagram.yaml 的 pacing_rules
 * （min_scene_hold 3s / max 15s）与 skills/core/subtitle-sync.md 的阅读速度，
 * 中文按单字信息量更大调保守（念 4~7 字/秒，读 ~9 字/秒）。
 */
export const PACING = {
  /** 一个停点（move + hold）的时长区间，秒 */
  minStepSeconds: 2.5,
  maxStepSeconds: 26,
  /** 阅读单位 / 停点秒数：超过说明字太多来不及读（单位见 readingUnits） */
  maxUnitsPerSecond: 7,
  /** 低于这个速率且停点超过 6 秒：画面空转 */
  idleUnitsPerSecond: 1,
  /** Caption 框：1920 宽减左右 40 边距与 32 内距，字号 29，高 160 ≈ 3 行 */
  captionBoxWidth: 1920 - 80 - 64,
  captionFontSize: 29,
  maxCaptionLines: 3,
  /** 连续多少步画面结构、模拟时刻、镜头都没变 = 幻灯片感 */
  maxFrozenRun: 3,
} as const;

export interface PacingIssue {
  level: 'error' | 'warn';
  step: number;
  message: string;
}

const structureOf = (s: Step) => `${s.layout ?? '-'}|${JSON.stringify(s.slots ?? {})}`;

/**
 * 阅读负担，单位数。中文一个字算一个单位；
 * 连续的拉丁串（`bumpServiceExecutingLocked` 这种标识符）是**一眼扫过去**的，
 * 按每 4 个字符算一个单位，否则技术字幕会被按字符数误判成"读不完"。
 */
export const readingUnits = (text: string): number => {
  let units = 0;
  for (const run of text.match(/[A-Za-z0-9_.()/]+|[^A-Za-z0-9_.()/]/g) ?? []) {
    units += run.length > 1 ? Math.ceil(run.length / 4) : 1;
  }
  return units;
};

export const validatePacing = (story: FlowStory): PacingIssue[] => {
  const issues: PacingIssue[] = [];
  let frozenRun = 1;

  story.steps.forEach((s, i) => {
    const clip = clipFor(s);
    const seconds = Math.max(s.move, 0.01) + effectiveHold(s);
    const chars = s.caption.length;
    const units = readingUnits(s.caption);
    const rate = units / seconds;
    const n = i + 1;

    // 按 engine/text.ts 的字宽启发式估行数（CJK 占满字号宽、西文 0.58）
    const lines = Math.ceil(textWidth(s.caption, PACING.captionFontSize) / PACING.captionBoxWidth);
    if (lines > PACING.maxCaptionLines) {
      issues.push({level: 'error', step: n, message: `caption ${chars} 字 ≈ ${lines} 行，超过字幕框的 ${PACING.maxCaptionLines} 行会溢出`});
    }
    if (seconds < PACING.minStepSeconds) {
      issues.push({level: 'warn', step: n, message: `停点只有 ${seconds.toFixed(1)}s，短于 ${PACING.minStepSeconds}s，看不清`});
    }
    if (seconds > PACING.maxStepSeconds) {
      issues.push({level: 'warn', step: n, message: `停点 ${seconds.toFixed(1)}s，长于 ${PACING.maxStepSeconds}s，建议拆成两步`});
    }
    if (clip) {
      // 有旁白时节奏由音频决定；只要确认镜头没短过音频（短了就会被下一镜截断）
      if (seconds + 0.01 < clip.duration) {
        issues.push({level: 'error', step: n, message: `镜头 ${seconds.toFixed(1)}s 短于旁白 ${clip.duration.toFixed(1)}s，这句会被截断`});
      }
    } else if (rate > PACING.maxUnitsPerSecond) {
      issues.push({
        level: 'warn',
        step: n,
        message: `${chars} 字 ≈ ${units} 阅读单位配 ${seconds.toFixed(1)}s = ${rate.toFixed(1)} 单位/秒，读不完（上限 ${PACING.maxUnitsPerSecond}）`,
      });
    } else if (seconds > 6 && rate < PACING.idleUnitsPerSecond) {
      issues.push({level: 'warn', step: n, message: `${seconds.toFixed(1)}s 只有 ${units} 阅读单位，画面空转`});
    }

    if (i > 0) {
      const prev = story.steps[i - 1];
      const frozen = structureOf(prev) === structureOf(s) && prev.to === s.to && JSON.stringify(prev.view) === JSON.stringify(s.view);
      frozenRun = frozen ? frozenRun + 1 : 1;
      if (frozenRun === PACING.maxFrozenRun) {
        issues.push({
          level: 'warn',
          step: n,
          message: `连续 ${PACING.maxFrozenRun} 步画面结构、模拟时刻、镜头都没变 —— 只剩字幕在翻页，像幻灯片`,
        });
      }
    }
  });

  return issues;
};
