import type {ClockProfile} from '../catalog/types';

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface DerivedClock {
  period: number;
  appWork: number;
  sfWork: number;
  presentLatency: number;
  depth: number;
  maxAcquired: number;
}

/**
 * -1 → appWork = 周期、sfWork = 周期 − 1ms（sched/VsyncConfiguration.cpp:291-297）
 * depth = ⌈presentLatency / 周期⌉，maxAcquired = max(min, depth − 1)（sf/SurfaceFlinger.cpp:9312-9320）
 */
export const deriveClock = (p: ClockProfile, minAcquired = 1): DerivedClock => {
  const period = r2(1000 / p.refreshHz);
  const appWork = p.appWork ?? period;
  const sfWork = p.sfWork ?? r2(period - 1);
  const presentLatency = r2(appWork + sfWork);
  const depth = Math.ceil(presentLatency / period - 1e-9);
  return {period, appWork, sfWork, presentLatency, depth, maxAcquired: Math.max(minAcquired, depth - 1)};
};

export const hwVsyncs = (p: ClockProfile, [w0, w1]: [number, number]) => {
  const {period} = deriveClock(p);
  const out: number[] = [];
  for (let k = Math.ceil(w0 / period); k * period <= w1; k++) out.push(r2(k * period));
  return out;
};

/** sf 唤醒 = 目标 vsync − sfWork；app 唤醒 = 目标 vsync − appWork − sfWork（readyDuration） */
export const wakeTimes = (p: ClockProfile, kind: 'app' | 'sf', [w0, w1]: [number, number]) => {
  const d = deriveClock(p);
  const out: number[] = [];
  const k0 = Math.floor(w0 / d.period) - 4;
  const k1 = Math.ceil(w1 / d.period) + 4;
  for (let k = k0; k <= k1; k++) {
    const v = k * d.period;
    const w = kind === 'sf' ? v - d.sfWork : v - d.appWork - d.sfWork;
    if (w >= w0 && w <= w1) out.push(r2(w));
  }
  return out;
};
