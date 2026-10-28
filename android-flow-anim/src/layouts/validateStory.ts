import type {FlowScript, FlowStory, TemplateKind} from '../dsl/types';
import {resolveStepLayout, slotKind, type LayoutId} from './slots';
import {stopIssues, templateFor} from './templates';

/** 一份分镜 + 它在哪个模板下播放（场景注册时同时登记，供停点校验） */
export interface StoryEntry {
  name: string;
  script: FlowScript;
  story: FlowStory;
  kind?: TemplateKind;
  compare?: FlowScript;
  layout?: LayoutId;
  slots?: Record<string, string>;
  /** Task 栈的容器节点（默认 wm:tda） */
  container?: string;
}

/**
 * 停点校验：按每一步实际使用的主视图（模板默认 + Step 覆盖）检查停点是否合适。
 * 返回 `第 n 步：…` 形式的警告；不阻断渲染。
 */
export const validateStory = (e: StoryEntry): string[] => {
  const tpl = templateFor(e.script, e.kind);
  const fallback = {layout: e.layout ?? tpl.layout, slots: e.slots ?? tpl.slots};
  const window: [number, number] = e.compare
    ? [Math.min(e.script.window[0], e.compare.window[0]), Math.max(e.script.window[1], e.compare.window[1])]
    : e.script.window;
  const out: string[] = [];
  let view = window;
  e.story.steps.forEach((step, i) => {
    if (step.view) view = step.view;
    const {slots} = resolveStepLayout(e.story.steps, i, fallback);
    const check = (spec: string | undefined, s: FlowScript) =>
      stopIssues(slotKind(spec), s, step.to, view, {stepIndex: i, container: e.container}).forEach((m) => out.push(`第 ${i + 1} 步（to=${step.to}）：${m}`));
    check(slots.main, e.script);
    if (e.compare && slots.b) check(slots.b, e.compare);
  });
  return out;
};
