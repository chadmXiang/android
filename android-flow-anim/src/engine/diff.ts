import type {FlowEvent, FlowScript} from '../dsl/types';
import {timerAt} from './state';

/**
 * 两份脚本的差异（对比 / bug 还原模板）：按"事件签名"（类型 + 泳道 + 文字，不含时间）配对，
 * 找出只在一边出现、或两边时刻明显不同的事件；计时器按状态对比。
 */

export interface DiffEntry {
  kind: 'only-a' | 'only-b' | 'shifted' | 'timer';
  at: number;
  label: string;
  atA?: number;
  atB?: number;
}

const sigOf = (e: FlowEvent): {sig: string; label: string; at: number} | undefined => {
  switch (e.type) {
    case 'span':
      return e.style === 'display' ? undefined : {sig: `span|${e.lane}|${e.label}`, label: e.label, at: e.start};
    case 'call':
    case 'oneway':
    case 'invoke':
      return {sig: `${e.type}|${e.from}|${e.to}|${e.method}`, label: e.method, at: e.at};
    case 'post':
      return {sig: `post|${e.to}|${e.msg}`, label: `post ${e.msg}`, at: e.at};
    case 'message':
    case 'socket':
    case 'batch':
      return {sig: `${e.type}|${e.from}|${e.to}|${e.label}`, label: e.label, at: e.at};
    case 'state':
      return {sig: `state|${e.object}|${e.to}`, label: `${e.object} → ${e.to}`, at: e.at};
    case 'marker':
      return {sig: `marker|${e.lane}|${e.label}`, label: e.label, at: e.at};
    case 'jank':
      return {sig: `jank|${e.lane}|${e.label}`, label: `卡顿：${e.label}`, at: e.at};
    case 'resource':
      return {sig: `res|${e.id}|${e.state}|${e.owner}`, label: `${e.id} → ${e.state}`, at: e.at};
    default:
      return undefined;
  }
};

/** 时间窗开始之前的事件是"初始布置"（如各自声明了几块 buffer），不算分歧 */
const group = (s: FlowScript, from: number) => {
  const m = new Map<string, {label: string; ats: number[]}>();
  s.events.forEach((e) => {
    const x = sigOf(e);
    if (!x || x.at < from) return;
    const g = m.get(x.sig) ?? {label: x.label, ats: []};
    g.ats.push(x.at);
    m.set(x.sig, g);
  });
  m.forEach((g) => g.ats.sort((a, b) => a - b));
  return m;
};

const cache = new WeakMap<FlowScript, WeakMap<FlowScript, DiffEntry[]>>();

/** 全部差异（与 t 无关，按时刻排序） */
export const diffScripts = (a: FlowScript, b: FlowScript): DiffEntry[] => {
  const hit = cache.get(a)?.get(b);
  if (hit) return hit;
  const from = Math.max(a.window[0], b.window[0]);
  const ga = group(a, from);
  const gb = group(b, from);
  const span = Math.max(a.window[1] - a.window[0], b.window[1] - b.window[0]);
  const tol = Math.max(1, span * 0.002);
  const out: DiffEntry[] = [];
  new Set([...ga.keys(), ...gb.keys()]).forEach((sig) => {
    const A = ga.get(sig)?.ats ?? [];
    const B = gb.get(sig)?.ats ?? [];
    const label = ga.get(sig)?.label ?? gb.get(sig)?.label ?? sig;
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      const ta = A[i];
      const tb = B[i];
      if (ta === undefined) out.push({kind: 'only-b', at: tb, atB: tb, label});
      else if (tb === undefined) out.push({kind: 'only-a', at: ta, atA: ta, label});
      else if (Math.abs(ta - tb) > tol) out.push({kind: 'shifted', at: Math.min(ta, tb), atA: ta, atB: tb, label});
    }
  });
  out.sort((x, y) => x.at - y.at);
  const inner = cache.get(a) ?? new WeakMap();
  inner.set(b, out);
  cache.set(a, inner);
  return out;
};

/** t 时刻已经"发生"的差异 + 计时器状态差异 */
export const diffAt = (a: FlowScript, b: FlowScript, t: number): DiffEntry[] => {
  const evs = diffScripts(a, b).filter((d) => d.at <= t);
  const ids = new Set([...a.events, ...b.events].filter((e) => e.type === 'timeout').map((e) => (e as {id: string}).id));
  const timers: DiffEntry[] = [];
  ids.forEach((id) => {
    const x = timerAt(a, id, t);
    const y = timerAt(b, id, t);
    if (x?.status !== y?.status) {
      const name = (k?: string) => ({idle: '未启动', running: '计时中', cancelled: '已取消', fired: '已到期'})[k ?? ''] ?? '无';
      timers.push({kind: 'timer', at: Math.max(x?.since ?? -Infinity, y?.since ?? -Infinity), label: `${x?.label ?? y?.label}：A ${name(x?.status)} / B ${name(y?.status)}`});
    }
  });
  return [...evs, ...timers].sort((p, q) => p.at - q.at);
};

/** 首次分歧时刻（没有差异时为 undefined） */
export const firstDivergence = (a: FlowScript, b: FlowScript) => diffScripts(a, b)[0]?.at;
