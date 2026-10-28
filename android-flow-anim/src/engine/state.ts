import type {FlowEvent, FlowScript, SignalKind, TreeNodeKind} from '../dsl/types';

type Of<K extends FlowEvent['type']> = Extract<FlowEvent, {type: K}>;

export const eventsOf = <K extends FlowEvent['type']>(s: FlowScript, type: K): Of<K>[] =>
  s.events.filter((e): e is Of<K> => e.type === type);

// —— 资源 ——
export interface ResourceSnapshot {
  state: string;
  owner: string;
  prevOwner: string;
  since: number;
}

export const resourceAt = (s: FlowScript, id: string, t: number): ResourceSnapshot => {
  const evs = eventsOf(s, 'resource')
    .filter((e) => e.id === id)
    .sort((a, b) => a.at - b.at);
  let cur: Of<'resource'> | undefined;
  let prev: Of<'resource'> | undefined;
  for (const e of evs) {
    if (e.at <= t) {
      prev = cur;
      cur = e;
    }
  }
  if (!cur) {
    const o = evs[0]?.owner ?? '';
    return {state: 'FREE', owner: o, prevOwner: o, since: -Infinity};
  }
  return {state: cur.state, owner: cur.owner, prevOwner: prev?.owner ?? cur.owner, since: cur.at};
};

// —— 信号 ——
export interface FenceSnapshot {
  id: string;
  kind: SignalKind;
  signaled: boolean;
}

/** 资源上最近一次挂的 fence */
export const resourceFence = (s: FlowScript, resId: string, t: number): FenceSnapshot | undefined => {
  const last = eventsOf(s, 'signal')
    .filter((e) => e.resource === resId && e.createdAt <= t)
    .sort((a, b) => a.createdAt - b.createdAt)
    .pop();
  if (!last) return undefined;
  return {id: last.id, kind: last.kind, signaled: last.signaledAt !== undefined && last.signaledAt <= t};
};

export const checkOk = (s: FlowScript, signalId: string, at: number) => {
  const g = eventsOf(s, 'signal').find((e) => e.id === signalId);
  return !!g && g.signaledAt !== undefined && g.signaledAt <= at;
};

// —— span / 屏幕 / jank ——
export const activeSpan = (s: FlowScript, lanes: string[], t: number) =>
  eventsOf(s, 'span')
    .filter((e) => lanes.includes(e.lane) && e.start <= t && t < e.end)
    .sort((a, b) => b.start - a.start)[0];

export const gpuWriting = (s: FlowScript, resId: string, t: number) =>
  eventsOf(s, 'span').some((e) => e.style === 'gpu' && e.resource === resId && e.start <= t && t < e.end);

export const displayedAt = (s: FlowScript, t: number) =>
  eventsOf(s, 'span').find((e) => e.style === 'display' && e.start <= t && t < e.end);

export const jankAt = (s: FlowScript, t: number, within: number) =>
  eventsOf(s, 'jank')
    .filter((e) => e.at <= t && t - e.at < within)
    .sort((a, b) => b.at - a.at)[0];

// 所有"带文字的交互"（消息 / binder / socket / post / 事务）都参与匹配
export const messageActive = (s: FlowScript, match: string, t: number, within: number) =>
  s.events.some((e) => {
    let label: string;
    switch (e.type) {
      case 'message':
      case 'socket':
      case 'batch':
        label = e.label;
        break;
      case 'call':
      case 'oneway':
        label = e.method;
        break;
      case 'post':
        label = e.msg;
        break;
      default:
        return false;
    }
    return label.includes(match) && e.at <= t && t - e.at < within;
  });

export const screenAt = (s: FlowScript, t: number) =>
  eventsOf(s, 'screen')
    .filter((e) => e.at <= t)
    .sort((a, b) => a.at - b.at)
    .pop();

// —— 对象状态机 ——
export const objectStateAt = (s: FlowScript, obj: string, t: number) => {
  const evs = eventsOf(s, 'state')
    .filter((e) => e.object === obj && e.at <= t)
    .sort((a, b) => a.at - b.at);
  const cur = evs[evs.length - 1];
  const prev = evs[evs.length - 2];
  return {state: cur?.to, prev: prev?.to, since: cur?.at ?? -Infinity};
};

// —— 树 ——
export interface TreeNode {
  id: string;
  label: string;
  parent: string | null;
  kind: TreeNodeKind;
  mapTo?: string;
  note?: string;
  order: number;
}

export const treeAt = (s: FlowScript, tree: string, t: number): Map<string, TreeNode> => {
  const m = new Map<string, TreeNode>();
  let order = 0;
  eventsOf(s, 'tree')
    .filter((e) => e.tree === tree && e.at <= t)
    .sort((a, b) => a.at - b.at)
    .forEach((e) => {
      if (e.op === 'add') {
        m.set(e.node, {
          id: e.node,
          label: e.label ?? e.node,
          parent: e.parent ?? null,
          kind: e.kind ?? 'container',
          mapTo: e.mapTo,
          order: order++,
        });
        return;
      }
      const n = m.get(e.node);
      if (!n) return;
      if (e.op === 'remove') m.delete(e.node);
      else if (e.op === 'reparent') {
        n.parent = e.parent ?? null;
        n.order = order++;
      } else if (e.op === 'attr') n.note = e.note;
    });
  return m;
};

export const treeChangeAt = (s: FlowScript, t: number) => {
  const evs = eventsOf(s, 'tree').filter((e) => e.at <= t);
  if (!evs.length) return {lastAt: -Infinity, changed: new Set<string>()};
  const lastAt = Math.max(...evs.map((e) => e.at));
  return {lastAt, changed: new Set(evs.filter((e) => e.at > lastAt - 1.5).map((e) => e.node))};
};

/** 泳道所属进程的诞生时刻（processes.bornAt 或 fork 事件）；常驻进程为 -Infinity */
export const laneBornAt = (s: FlowScript, laneId: string): number => {
  const lane = s.lanes.find((l) => l.id === laneId);
  if (!lane?.process) return -Infinity;
  const p = s.processes?.find((x) => x.id === lane.process);
  if (p?.bornAt !== undefined) return p.bornAt;
  const f = eventsOf(s, 'fork').find((x) => x.process === lane.process);
  return f ? f.at : -Infinity;
};

export const lastInput = (s: FlowScript, target: string, t: number) =>
  eventsOf(s, 'input')
    .filter((e) => e.target === target && e.at <= t)
    .sort((a, b) => a.at - b.at)
    .pop();

/** 所有出现过的属性 key（按首次出现排序），以及 t 时刻的值 */
export const propsAt = (s: FlowScript, t: number) => {
  const all = eventsOf(s, 'prop').sort((a, b) => a.at - b.at);
  const keys = [...new Set(all.map((p) => p.key))];
  return keys.map((key) => {
    const cur = all.filter((p) => p.key === key && p.at <= t).pop();
    return {key, value: cur?.value, at: cur?.at};
  });
};

// —— 超时计时器 ——
export interface TimerSnapshot {
  id: string;
  label: string;
  lane: string;
  object?: string;
  armedAt: number;
  deadline: number;
  /** 'idle' 未启动 · 'running' 计时中 · 'cancelled' 已取消 · 'fired' 已到期 */
  status: 'idle' | 'running' | 'cancelled' | 'fired';
  remaining: number;
  /** 0..1，已经过的比例 */
  progress: number;
  /** 状态切换的时刻（启动 / 取消 / 到期） */
  since: number;
}

export const timerAt = (s: FlowScript, id: string, t: number): TimerSnapshot | undefined => {
  const e = eventsOf(s, 'timeout').find((x) => x.id === id);
  if (!e) return undefined;
  const deadline = e.at + e.duration;
  const cancelled = e.cancelAt !== undefined && e.cancelAt < deadline;
  const base = {id, label: e.label, lane: e.lane, object: e.object, armedAt: e.at, deadline};
  if (t < e.at) return {...base, status: 'idle', remaining: e.duration, progress: 0, since: -Infinity};
  if (cancelled && t >= (e.cancelAt as number)) {
    const c = e.cancelAt as number;
    return {...base, status: 'cancelled', remaining: deadline - c, progress: (c - e.at) / e.duration, since: c};
  }
  if (t >= deadline) return {...base, status: 'fired', remaining: 0, progress: 1, since: deadline};
  return {...base, status: 'running', remaining: deadline - t, progress: (t - e.at) / e.duration, since: e.at};
};

export const timersOf = (s: FlowScript, t: number, object?: string) =>
  eventsOf(s, 'timeout')
    .filter((e) => !object || e.object === object)
    .map((e) => timerAt(s, e.id, t) as TimerSnapshot);

/** 状态迁移的来源泳道：显式 by，否则取 at 时刻正在执行、开始最晚的 span 所在泳道 */
export const stateSourceLane = (s: FlowScript, e: Extract<FlowEvent, {type: 'state'}>): string | undefined => {
  if (e.by) return e.by;
  const sp = eventsOf(s, 'span')
    .filter((x) => x.start <= e.at && e.at <= x.end && x.style !== 'display')
    .sort((a, b) => b.start - a.start)[0];
  return sp?.lane;
};

// —— dumpsys 快照 ——
export interface DumpLine {
  key: string;
  value: string | null;
  prev: string | null;
  since: number;
  /** 与时间窗开始时（基线）相比是否不同 */
  changedFromBase: boolean;
}

/** t 时刻各 section 的快照（按 key 首次出现排序）；消失的行 value 为 null */
export const dumpAt = (s: FlowScript, t: number): Map<string, DumpLine[]> => {
  const evs = eventsOf(s, 'dump').sort((a, b) => a.at - b.at);
  const base = s.window[0];
  const out = new Map<string, DumpLine[]>();
  const sections = [...new Set(evs.map((e) => e.section))];
  sections.forEach((sec) => {
    const keys = [...new Set(evs.filter((e) => e.section === sec).map((e) => e.key))];
    const lines = keys.map((key) => {
      const ks = evs.filter((e) => e.section === sec && e.key === key);
      const upto = ks.filter((e) => e.at <= t);
      const cur = upto[upto.length - 1];
      const prev = upto[upto.length - 2];
      const atBase = ks.filter((e) => e.at <= base).pop();
      const value = cur?.value ?? null;
      return {key, value, prev: prev?.value ?? null, since: cur?.at ?? -Infinity, changedFromBase: value !== (atBase?.value ?? null)};
    });
    out.set(sec, lines);
  });
  return out;
};
