import type {FlowEvent, FlowScript} from '../dsl/types';

/** 可复用的子流程片段：时间从 0 开始，泳道用 '$xxx' 占位 */
export interface Fragment {
  id: string;
  title: string;
  events: FlowEvent[];
}

const TIME_KEYS = ['at', 'start', 'end', 'createdAt', 'signaledAt', 'returnAt', 'handledAt', 'cancelAt'];
const LANE_KEYS = ['lane', 'from', 'to', 'owner', 'by'];

const shift = (e: FlowEvent, dt: number, map: Record<string, string>): FlowEvent => {
  const o: Record<string, unknown> = {...e};
  for (const k of TIME_KEYS) if (typeof o[k] === 'number') o[k] = (o[k] as number) + dt;
  for (const k of LANE_KEYS) {
    const v = o[k];
    if (typeof v === 'string' && v.startsWith('$')) o[k] = map[v] ?? v;
  }
  return o as FlowEvent;
};

/** 展开所有 include：平移时间、映射泳道，并在入口处打一个 "↳ 片段名" 标注 */
export const resolveIncludes = (s: FlowScript, fragments: Record<string, Fragment>): FlowScript => {
  const out: FlowEvent[] = [];
  for (const e of s.events) {
    if (e.type !== 'include') {
      out.push(e);
      continue;
    }
    const fr = fragments[e.fragment];
    if (!fr) {
      console.warn(`[resolve] 未知片段 ${e.fragment}`);
      continue;
    }
    const firstLane = Object.values(e.lanes)[0];
    if (firstLane) out.push({type: 'marker', at: e.at, lane: firstLane, label: `↳ ${fr.title}`, tone: 'info'});
    fr.events.forEach((fe) => out.push(shift(fe, e.at, e.lanes)));
  }
  return {...s, events: out};
};
