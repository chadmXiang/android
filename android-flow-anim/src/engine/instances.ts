import {getClass} from '../catalog/classes';
import type {FlowScript, InstanceDef, ObjectDef} from '../dsl/types';
import {activeSpan, eventsOf} from './state';

/** 实例：流程里"活"的类对象。泳道 / 状态机对象 / 调用都可以落到实例上 */

export const instancesOf = (s: FlowScript): InstanceDef[] => s.instances ?? [];

export const getInstance = (s: FlowScript, id: string): InstanceDef | undefined =>
  instancesOf(s).find((i) => i.id === id);

export const instanceLabel = (s: FlowScript, id: string) => {
  const i = getInstance(s, id);
  if (!i) return id;
  const name = getClass(i.cls).name;
  return i.label ? `${name} · ${i.label}` : name;
};

export const laneOfInstance = (s: FlowScript, id: string) => s.lanes.find((l) => l.inst === id)?.id;

export const instanceOfLane = (s: FlowScript, laneId: string) => s.lanes.find((l) => l.id === laneId)?.inst;

const processBornAt = (s: FlowScript, pid: string): number => {
  const p = s.processes?.find((x) => x.id === pid);
  if (p?.bornAt !== undefined) return p.bornAt;
  const f = eventsOf(s, 'fork').find((x) => x.process === pid);
  return f ? f.at : -Infinity;
};

/** new 事件的时刻；没有 new 则随进程诞生 */
export const instanceBornAt = (s: FlowScript, id: string): number => {
  const n = eventsOf(s, 'new').find((e) => e.inst === id);
  if (n) return n.at;
  const i = getInstance(s, id);
  return i ? processBornAt(s, i.process) : -Infinity;
};

/** 状态机对象 = 显式 objects + 自带状态机的类实例（ObjectBoard / 校验共用） */
export const objectsOf = (s: FlowScript): ObjectDef[] => {
  const derived = instancesOf(s)
    .filter((i) => getClass(i.cls).stateMachine && !(s.objects ?? []).some((o) => o.id === i.id))
    .map((i) => ({id: i.id, label: instanceLabel(s, i.id), stateMachine: getClass(i.cls).stateMachine as string}));
  return [...(s.objects ?? []), ...derived];
};

export interface FieldValue {
  value: string | null;
  since: number;
}

/** t 时刻实例的字段值：初始 fields → new(field) → set，按时间覆盖 */
export const fieldsAt = (s: FlowScript, id: string, t: number): Map<string, FieldValue> => {
  const m = new Map<string, FieldValue>();
  Object.entries(getInstance(s, id)?.fields ?? {}).forEach(([k, v]) => m.set(k, {value: v, since: -Infinity}));
  const evs: {at: number; field: string; value: string | null}[] = [
    ...eventsOf(s, 'new')
      .filter((e) => e.by === id && e.field)
      .map((e) => ({at: e.at, field: e.field as string, value: e.inst})),
    ...eventsOf(s, 'set')
      .filter((e) => e.inst === id)
      .map((e) => ({at: e.at, field: e.field, value: e.value})),
  ];
  evs
    .filter((e) => e.at <= t)
    .sort((a, b) => a.at - b.at)
    .forEach((e) => m.set(e.field, {value: e.value, since: e.at}));
  return m;
};

/** 脚本里出现过的字段名（含初始值），用于卡片固定行 */
export const fieldNamesOf = (s: FlowScript, id: string): string[] => {
  const names = new Set(Object.keys(getInstance(s, id)?.fields ?? {}));
  eventsOf(s, 'new').forEach((e) => e.by === id && e.field && names.add(e.field));
  eventsOf(s, 'set').forEach((e) => e.inst === id && names.add(e.field));
  return [...names];
};

export type InteractionKind = 'invoke' | 'call' | 'oneway' | 'post' | 'new';

export interface Interaction {
  kind: InteractionKind;
  at: number;
  /** invoke / call：返回时刻；post：被取出时刻 */
  end: number;
  from: string;
  to: string;
  label: string;
}

/** 把泳道间的调用映射到实例间；两端泳道都要声明 inst */
export const interactionsOf = (s: FlowScript): Interaction[] => {
  const out: Interaction[] = [];
  const lane = (l: string) => instanceOfLane(s, l);
  const push = (kind: InteractionKind, at: number, end: number, fromLane: string, toLane: string, label: string) => {
    const from = lane(fromLane);
    const to = lane(toLane);
    if (from && to) out.push({kind, at, end, from, to, label});
  };
  eventsOf(s, 'invoke').forEach((e) => push('invoke', e.at, e.returnAt ?? e.at, e.from, e.to, e.method));
  eventsOf(s, 'call').forEach((e) => push('call', e.at, e.returnAt ?? e.at, e.from, e.to, e.method));
  eventsOf(s, 'oneway').forEach((e) => push('oneway', e.at, e.at, e.from, e.to, e.method));
  eventsOf(s, 'post').forEach((e) => push('post', e.at, e.handledAt, e.from, e.to, e.msg));
  eventsOf(s, 'new').forEach((e) =>
    out.push({kind: 'new', at: e.at, end: e.at, from: e.by, to: e.inst, label: `new ${getClass(getInstance(s, e.inst)?.cls ?? '').name}`}),
  );
  return out.sort((a, b) => a.at - b.at);
};

export interface StackFrame {
  call: Interaction;
  depth: number;
}

/**
 * t 时刻仍未返回的同步调用（invoke / call），按嵌套关系给出深度；
 * 以及还在 MessageQueue 里排队的 post。
 */
export const callStackAt = (s: FlowScript, t: number) => {
  const all = interactionsOf(s);
  const open = all.filter((c) => (c.kind === 'invoke' || c.kind === 'call') && c.at <= t && t < c.end);
  const frames: StackFrame[] = open.map((c) => ({
    call: c,
    depth: open.filter((p) => p !== c && p.at <= c.at && c.end <= p.end).length,
  }));
  const queued = all.filter((c) => c.kind === 'post' && c.at <= t && t < c.end);
  return {frames, queued};
};

/** 实例当前正在执行的 span（泳道 = 实例） */
export const instanceSpanAt = (s: FlowScript, id: string, t: number) => {
  const l = laneOfInstance(s, id);
  return l ? activeSpan(s, [l], t) : undefined;
};

/** 最近 within 个时间单位内落在实例泳道上的标注 */
export const instanceMarkerAt = (s: FlowScript, id: string, t: number, within: number) => {
  const l = laneOfInstance(s, id);
  if (!l) return undefined;
  return eventsOf(s, 'marker')
    .filter((m) => m.lane === l && m.at <= t && t - m.at < within)
    .sort((a, b) => b.at - a.at)[0];
};
