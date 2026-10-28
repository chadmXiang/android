import type {FlowScript} from '../dsl/types';
import {instanceBornAt, instanceLabel, instancesOf, interactionsOf} from './instances';
import {eventsOf} from './state';

/** 类 → 它出现在哪些流程里（泳道 / 实例），以及首次活动的时刻：用于"从类反查流程" */
export interface ClassUsage {
  scriptId: string;
  title: string;
  as: 'lane' | 'instance';
  label: string;
  /** 首次有活动（span / 调用 / 创建）的模拟时间 */
  firstAt: number;
}

export const classUsage = (scripts: FlowScript[]): Map<string, ClassUsage[]> => {
  const m = new Map<string, ClassUsage[]>();
  const add = (cls: string, u: ClassUsage) => m.set(cls, [...(m.get(cls) ?? []), u]);
  scripts.forEach((s) => {
    const seen = new Set<string>();
    const calls = interactionsOf(s);
    instancesOf(s).forEach((i) => {
      seen.add(`${i.cls}`);
      const touched = calls.filter((c) => c.from === i.id || c.to === i.id).map((c) => c.at);
      const born = instanceBornAt(s, i.id);
      const firstAt = Math.max(s.window[0], Math.min(...touched, Number.isFinite(born) ? born : Infinity));
      add(i.cls, {scriptId: s.id, title: s.title, as: 'instance', label: instanceLabel(s, i.id), firstAt: Number.isFinite(firstAt) ? firstAt : s.window[0]});
    });
    s.lanes.forEach((l) => {
      if (!l.cls || seen.has(l.cls)) return;
      const starts = eventsOf(s, 'span')
        .filter((e) => e.lane === l.id)
        .map((e) => e.start);
      add(l.cls, {scriptId: s.id, title: s.title, as: 'lane', label: l.label, firstAt: starts.length ? Math.min(...starts) : s.window[0]});
    });
  });
  return m;
};
