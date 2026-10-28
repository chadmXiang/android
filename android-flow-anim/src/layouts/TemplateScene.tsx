import React from 'react';
import type {FlowScript, FlowStory, TemplateKind} from '../dsl/types';
import {clamp01, ease} from '../engine/text';
import {colors} from '../theme';
import {ArrowLegend, Caption, Header, Legend} from '../views/Chrome';
import {GraphLegend} from '../views/InstanceGraphView';
import type {ArrowKind} from '../views/SwimlaneView';
import {LAYOUTS, renderSlot, resolveStepLayout, slotKind, type LayoutId, type SlotOptions} from './slots';
import {StoryScene} from './StoryScene';
import {templateFor} from './templates';

export interface TemplateSceneConfig {
  script: FlowScript;
  story: FlowStory;
  /** 不写则用 script.kind（再不写则 'timeline'） */
  kind?: TemplateKind;
  /** 对比模板的第二份脚本：槽位写 'b:xxx' 时使用；两边共用同一时间轴 */
  compare?: FlowScript;
  title?: string;
  subtitle?: string;
  /** 覆盖模板的默认布局 / 槽位（Step 上写的优先级更高） */
  layout?: LayoutId;
  slots?: Record<string, string>;
  options?: SlotOptions;
  /** 泳道主视图的箭头图例种类（默认 ArrowLegend 的默认集合） */
  arrowKinds?: ArrowKind[];
}

const SplitTag: React.FC<{x: number; y: number; text: string; color: string}> = ({x, y, text, color}) => (
  <div
    style={{
      position: 'absolute',
      left: x + 10,
      top: y - 13,
      padding: '2px 12px',
      borderRadius: 8,
      background: colors.bg,
      border: `1.5px solid ${color}`,
      color,
      fontSize: 15,
      fontWeight: 700,
      zIndex: 5,
    }}
  >
    {text}
  </div>
);

/**
 * 模板场景：默认布局 / 槽位来自流程性质（kind），Step 可以中途换布局。
 * 用法见 README「模板」一节。
 */
/** 所有模板场景的配置（创建时自动登记），Root 启动时据此做停点校验 */
export const TEMPLATE_SCENES: TemplateSceneConfig[] = [];

export const makeTemplateScene = (cfg: TemplateSceneConfig): React.FC => {
  TEMPLATE_SCENES.push(cfg);
  const {script, story, compare} = cfg;
  const tpl = templateFor(script, cfg.kind);
  const fallback = {layout: cfg.layout ?? tpl.layout, slots: cfg.slots ?? tpl.slots};
  const window: [number, number] = compare
    ? [Math.min(script.window[0], compare.window[0]), Math.max(script.window[1], compare.window[1])]
    : script.window;
  const Scene: React.FC = () => (
    <StoryScene
      story={story}
      startT={window[0]}
      defaultView={window}
      render={({frame, t, seg, local, focus, total, view}) => {
        const {layout, slots} = resolveStepLayout(story.steps, seg.index, fallback);
        const prev = seg.index > 0 ? resolveStepLayout(story.steps, seg.index - 1, fallback) : undefined;
        const switched = !!prev && (prev.layout !== layout || JSON.stringify(prev.slots) !== JSON.stringify(slots));
        const fade = switched ? ease(clamp01(local / 0.6)) : 1;
        const areas = LAYOUTS[layout];
        const prevTo = seg.index > 0 ? story.steps[seg.index - 1].to : window[0];
        const ctx = {script, compare, t, frame, focus, view: view ?? window, step: seg.step, stepIndex: seg.index, local, options: cfg.options, prevTo};
        const main = slotKind(slots.main);
        return (
          <>
            <Header title={cfg.title ?? script.title} subtitle={cfg.subtitle ?? script.subtitle} right={`${tpl.def.name} · ${seg.index + 1} / ${total}`} />
            <div style={{position: 'absolute', inset: 0, opacity: fade, transform: `translateY(${(1 - fade) * 10}px)`}}>
              {Object.entries(slots).map(([name, spec]) => (areas[name] ? renderSlot(spec, areas[name], ctx) : null))}
              {compare && layout === 'split' && (
                <>
                  <SplitTag x={areas.main.x} y={areas.main.y} text={`A · ${script.title}`} color={colors.ok} />
                  <SplitTag x={areas.b.x} y={areas.b.y} text={`B · ${compare.title}`} color={colors.bad} />
                </>
              )}
            </div>
            {main === 'swimlane' && (script.resources.length ? <Legend x={44} y={846} /> : <ArrowLegend x={44} y={846} kinds={cfg.arrowKinds} />)}
            {main === 'graph' && <GraphLegend x={44} y={846} />}
            <Caption key={`c${seg.index}`} text={seg.step.caption} localSec={local} />
          </>
        );
      }}
    />
  );
  return Scene;
};
