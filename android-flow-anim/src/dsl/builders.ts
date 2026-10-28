import type {FlowEvent, SignalKind, SpanStyle, Tone, TreeNodeKind} from './types';

type SpanOpts = {resource?: string; frame?: string};

export const span = (
  lane: string,
  start: number,
  end: number,
  label: string,
  style: SpanStyle,
  o: SpanOpts = {},
): FlowEvent => ({type: 'span', lane, start, end, label, style, ...o});

export const res = (id: string, at: number, state: string, owner: string): FlowEvent => ({
  type: 'resource',
  id,
  at,
  state,
  owner,
});

export const msg = (at: number, from: string, to: string, label: string): FlowEvent => ({
  type: 'message',
  at,
  from,
  to,
  label,
});

export const batch = (at: number, from: string, to: string, label: string): FlowEvent => ({
  type: 'batch',
  at,
  from,
  to,
  label,
});

export const sig = (
  id: string,
  kind: SignalKind,
  resource: string | undefined,
  createdAt: number,
  signaledAt?: number,
): FlowEvent => ({type: 'signal', id, kind, resource, createdAt, signaledAt});

export const check = (at: number, lane: string, signal: string, label = '就绪判定'): FlowEvent => ({
  type: 'check',
  at,
  lane,
  signal,
  label,
});

export const mark = (at: number, lane: string, label: string, tone: Tone): FlowEvent => ({
  type: 'marker',
  at,
  lane,
  label,
  tone,
});

export const jank = (at: number, lane: string, label: string): FlowEvent => ({type: 'jank', at, lane, label});

export const state = (at: number, object: string, to: string, by?: string): FlowEvent => ({type: 'state', at, object, to, by});

export const node = (
  at: number,
  tree: string,
  id: string,
  label: string,
  parent: string | null,
  kind: TreeNodeKind,
  mapTo?: string,
): FlowEvent => ({type: 'tree', op: 'add', at, tree, node: id, label, parent, kind, mapTo});

export const reparent = (at: number, tree: string, id: string, parent: string): FlowEvent => ({
  type: 'tree',
  op: 'reparent',
  at,
  tree,
  node: id,
  parent,
});

export const remove = (at: number, tree: string, id: string): FlowEvent => ({
  type: 'tree',
  op: 'remove',
  at,
  tree,
  node: id,
});

export const attr = (at: number, tree: string, id: string, note: string): FlowEvent => ({
  type: 'tree',
  op: 'attr',
  at,
  tree,
  node: id,
  note,
});

export const screen = (at: number, show: string): FlowEvent => ({type: 'screen', at, show});

// —— 系统流程原语 ——
export const call = (at: number, from: string, to: string, method: string, returnAt?: number): FlowEvent => ({
  type: 'call',
  at,
  from,
  to,
  method,
  returnAt,
});

export const oneway = (at: number, from: string, to: string, method: string): FlowEvent => ({
  type: 'oneway',
  at,
  from,
  to,
  method,
});

export const socket = (at: number, from: string, to: string, label: string): FlowEvent => ({
  type: 'socket',
  at,
  from,
  to,
  label,
});

export const fork = (at: number, from: string, to: string, process: string, label = 'fork'): FlowEvent => ({
  type: 'fork',
  at,
  from,
  to,
  process,
  label,
});

export const post = (at: number, from: string, to: string, msg: string, handledAt: number): FlowEvent => ({
  type: 'post',
  at,
  from,
  to,
  msg,
  handledAt,
});

export const include = (at: number, fragment: string, lanes: Record<string, string>): FlowEvent => ({
  type: 'include',
  at,
  fragment,
  lanes,
});

export const input = (
  at: number,
  lane: string,
  kind: 'touch-down' | 'touch-up' | 'key-down' | 'key-up',
  label: string,
  target?: string,
): FlowEvent => ({type: 'input', at, lane, kind, label, target});

/** init 拉起服务：fork + exec（复用 fork 事件，箭头样式不同） */
export const spawn = (at: number, from: string, to: string, process: string, label = 'spawn'): FlowEvent => ({
  type: 'fork',
  at,
  from,
  to,
  process,
  label,
  exec: true,
});

export const service = (at: number, name: string, group: string, end?: number): FlowEvent => ({
  type: 'service',
  at,
  end,
  name,
  group,
});

export const phase = (at: number, value: number, label: string, lane?: string): FlowEvent => ({
  type: 'phase',
  at,
  value,
  label,
  lane,
});

export const prop = (at: number, lane: string, key: string, value: string): FlowEvent => ({
  type: 'prop',
  at,
  lane,
  key,
  value,
});

/** 进程内方法调用（类级时序图） */
export const invoke = (at: number, from: string, to: string, method: string, returnAt?: number): FlowEvent => ({
  type: 'invoke',
  at,
  from,
  to,
  method,
  returnAt,
});

/** 实例创建：by 在 at 时刻 new 出 inst（可选同时赋给 by.field） */
export const newInst = (at: number, by: string, inst: string, field?: string): FlowEvent => ({
  type: 'new',
  at,
  by,
  inst,
  field,
});

/** 实例字段赋值：value 为实例 id 时视图画引用线 */
export const set = (at: number, inst: string, field: string, value: string | null): FlowEvent => ({
  type: 'set',
  at,
  inst,
  field,
  value,
});

/** 超时计时器：at 启动、duration 后到期；cancelAt 早于到期 = 被取消（如 serviceDoneExecuting） */
export const timeout = (
  id: string,
  at: number,
  duration: number,
  lane: string,
  label: string,
  o: {object?: string; cancelAt?: number} = {},
): FlowEvent => ({type: 'timeout', id, at, duration, lane, label, ...o});

/** dumpsys 快照的一行（示意格式，字段名对照各 dump 方法）；value = null 表示这一行消失 */
export const dump = (at: number, section: string, key: string, value: string | null): FlowEvent => ({
  type: 'dump',
  at,
  section,
  key,
  value,
});
