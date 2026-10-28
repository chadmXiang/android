import type {Step} from '../dsl/types';
import {effectiveHold} from './narration';

export interface Segment {
  start: number;
  end: number;
  step: Step;
  index: number;
}
export interface Keyframes {
  secs: number[];
  ts: number[];
  segments: Segment[];
  total: number;
}

export const storySeconds = (steps: Step[]) =>
  steps.reduce((s, st) => s + Math.max(st.move, 0.01) + effectiveHold(st), 0);

export const buildKeyframes = (steps: Step[], startT: number): Keyframes => {
  const secs = [0];
  const ts = [startT];
  const segments: Segment[] = [];
  let sec = 0;
  steps.forEach((s, index) => {
    const start = sec;
    const hold = effectiveHold(s);
    sec += Math.max(s.move, 0.01);
    secs.push(sec);
    ts.push(s.to);
    if (hold > 0) {
      sec += hold;
      secs.push(sec);
      ts.push(s.to);
    }
    segments.push({start, end: sec, step: s, index});
  });
  return {secs, ts, segments, total: sec};
};

export const simTimeAt = (sec: number, kf: Keyframes) => {
  if (sec <= kf.secs[0]) return kf.ts[0];
  for (let i = 0; i < kf.secs.length - 1; i++) {
    const a = kf.secs[i];
    const b = kf.secs[i + 1];
    if (sec <= b) {
      const p = (sec - a) / (b - a || 1);
      const e = p * p * (3 - 2 * p);
      return kf.ts[i] + (kf.ts[i + 1] - kf.ts[i]) * e;
    }
  }
  return kf.ts[kf.ts.length - 1];
};

export const activeSegment = (sec: number, kf: Keyframes): Segment =>
  kf.segments.find((s) => sec < s.end) ?? kf.segments[kf.segments.length - 1];

/** 镜头时间窗：在当前镜头的 move 阶段从上一个 view 缓动到本步 view */
export const viewAt = (sec: number, kf: Keyframes, fallback: [number, number]): [number, number] => {
  const seg = activeSegment(sec, kf);
  let prev: [number, number] = fallback;
  for (let i = 0; i < seg.index; i++) {
    const v = kf.segments[i].step.view;
    if (v) prev = v;
  }
  const cur = seg.step.view ?? prev;
  const p = Math.max(0, Math.min(1, (sec - seg.start) / Math.max(seg.step.move, 0.01)));
  const e = p * p * (3 - 2 * p);
  return [prev[0] + (cur[0] - prev[0]) * e, prev[1] + (cur[1] - prev[1]) * e];
};
