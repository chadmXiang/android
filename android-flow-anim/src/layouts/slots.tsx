import React from 'react';
import {getPool, getStateMachine} from '../catalog';
import {getClockProfile} from '../catalog';
import type {Rect} from '../catalog/types';
import type {FlowScript, Step} from '../dsl/types';
import {firstDivergence} from '../engine/diff';
import {objectStateAt, resourceAt} from '../engine/state';
import {CallStackView} from '../views/CallStackView';
import {ChapterBar} from '../views/ChapterBar';
import {ClassInfoView} from '../views/ClassInfoView';
import {CodeView} from '../views/CodeView';
import {DiffView} from '../views/DiffView';
import {DispatchRuleView, type DispatchRuleConfig} from '../views/DispatchRuleView';
import {ViewTreeView, type ViewTreeConfig} from '../views/ViewTreeView';
import {DumpsysView} from '../views/DumpsysView';
import {LifecycleView, type LifecycleConfig} from '../views/LifecycleView';
import {ProcessSequenceView} from '../views/ProcessSequenceView';
import {DualTreeView} from '../views/DualTreeView';
import {InstanceGraphView} from '../views/InstanceGraphView';
import {MessageQueueView} from '../views/MessageQueueView';
import {ObjectBoard} from '../views/ObjectBoard';
import {PipelineView, type PipelineConfig} from '../views/PipelineView';
import {PropBoard} from '../views/PropBoard';
import {ResourcePoolView} from '../views/ResourcePoolView';
import {ScreenView} from '../views/ScreenView';
import {ServiceGrid} from '../views/ServiceGrid';
import {StateStageView} from '../views/StateStageView';
import {StateView} from '../views/StateView';
import {SwimlaneView} from '../views/SwimlaneView';
import {TaskStackView, type TaskStackProps} from '../views/TaskStackView';
import {TimerView} from '../views/TimerView';
import {colors} from '../theme';

/**
 * 布局 + 槽位：Step 只声明"用哪个布局、每个槽放什么"，坐标由布局给出。
 *
 * 槽位写法（冒号后是参数；前缀 'b:' 表示用对比模板的第二份脚本）：
 *   通用      swimlane · objects · screen · code · class-info · queue:<泳道> · state:<状态机>:<对象>
 *   调用链    graph · callstack
 *   流水线    pipeline · pool · res-state · vsync
 *   结构变化  task-stack
 *   映射      tree
 *   状态驱动  state-stage[:<对象>] · timers
 *   阶段      chapters · services · props
 *   对比      diff
 *   进程交互  proc-seq            生命周期  lifecycle            dumpsys  dumpsys
 *   协作图过滤 graph:<进程 id 或 options.graphSets 里的名字>
 *   输入      dispatch-rules（窗口命中 / 焦点规则）  view-tree（应用布局内部）
 */

export type LayoutId = NonNullable<Step['layout']>;

/** 内容区 1840 × 744（x 40..1880，y 92..836），字幕在下方 */
export const LAYOUTS: Record<LayoutId, Record<string, Rect>> = {
  // 时序主视图 + 右侧四格
  timeline: {
    main: {x: 40, y: 92, w: 1300, h: 744},
    s1: {x: 1370, y: 92, w: 200, h: 330},
    s2: {x: 1584, y: 92, w: 296, h: 330},
    s3: {x: 1370, y: 436, w: 510, h: 154},
    s4: {x: 1370, y: 604, w: 510, h: 232},
  },
  // 结构 / 状态主视图 + 右侧三格
  stage: {
    main: {x: 40, y: 92, w: 1160, h: 744},
    s1: {x: 1220, y: 92, w: 660, h: 330},
    s2: {x: 1220, y: 436, w: 250, h: 400},
    s3: {x: 1484, y: 436, w: 396, h: 400},
  },
  // 协作图 + 调用栈 + 源码
  graph: {
    main: {x: 40, y: 92, w: 1400, h: 744},
    s1: {x: 1460, y: 92, w: 420, h: 430},
    s2: {x: 1460, y: 536, w: 420, h: 300},
  },
  // 全宽主视图 + 底部三格（流水线）
  wide: {
    main: {x: 40, y: 92, w: 1840, h: 440},
    s1: {x: 40, y: 546, w: 600, h: 290},
    s2: {x: 660, y: 546, w: 600, h: 290},
    s3: {x: 1280, y: 546, w: 600, h: 290},
  },
  // 对比：A 在上、B 在下，各带一个侧格；最右是差异
  split: {
    main: {x: 40, y: 92, w: 1180, h: 364},
    sa: {x: 1234, y: 92, w: 330, h: 364},
    b: {x: 40, y: 472, w: 1180, h: 364},
    sb: {x: 1234, y: 472, w: 330, h: 364},
    s1: {x: 1578, y: 92, w: 302, h: 744},
  },
  // 全屏主视图（dumpsys）
  full: {
    main: {x: 40, y: 92, w: 1840, h: 744},
  },
  // 阶段：顶部章节条 + 主视图 + 右侧三格
  phase: {
    chapters: {x: 40, y: 92, w: 1840, h: 74},
    main: {x: 40, y: 176, w: 1300, h: 660},
    s1: {x: 1370, y: 176, w: 200, h: 330},
    s2: {x: 1584, y: 176, w: 296, h: 330},
    s3: {x: 1370, y: 520, w: 510, h: 316},
  },
};

export interface SlotOptions {
  taskStack?: Partial<Omit<TaskStackProps, 'script' | 't' | 'width' | 'height' | 'frame'>>;
  screenNavBar?: boolean;
  pipeline?: PipelineConfig;
  /** 协作图过滤用的实例集合：graph:<名字> */
  graphSets?: Record<string, string[]>;
  lifecycle?: LifecycleConfig;
  dispatchRules?: DispatchRuleConfig;
  viewTree?: ViewTreeConfig;
}

export interface SlotCtx {
  script: FlowScript;
  /** 对比模板的第二份脚本（'b:' 前缀的槽位用它） */
  compare?: FlowScript;
  t: number;
  frame: number;
  focus: string[];
  view: [number, number];
  step: Step;
  stepIndex: number;
  local: number;
  options?: SlotOptions;
  /** 上一步的停点（dumpsys 视图据此标出"本步变化"） */
  prevTo?: number;
}

/** 不需要外框 Panel 的槽 */
const BARE = new Set(['code']);
/** 不加内边距的槽 */
const NO_PAD = new Set(['swimlane', 'graph', 'screen', 'tree', 'task-stack', 'pipeline', 'state-stage', 'services', 'chapters', 'vsync', 'proc-seq', 'lifecycle', 'dumpsys', 'dispatch-rules', 'view-tree']);

// VSYNC 条：只保留 vsyncLanes + 屏幕泳道的派生脚本（按脚本缓存）
const vsyncCache = new WeakMap<FlowScript, FlowScript>();
const vsyncScript = (s: FlowScript): FlowScript => {
  const hit = vsyncCache.get(s);
  if (hit) return hit;
  const keep = new Set([s.vsyncLanes?.app, s.vsyncLanes?.sf, ...s.lanes.filter((l) => l.component === 'hwc').map((l) => l.id)].filter(Boolean) as string[]);
  const lanes = s.lanes.filter((l) => keep.has(l.id));
  const laneKeys = ['lane', 'from', 'to', 'owner'] as const;
  const events = s.events.filter((e) => {
    const o = e as unknown as Record<string, unknown>;
    return laneKeys.every((k) => typeof o[k] !== 'string' || keep.has(o[k] as string) || !s.lanes.some((l) => l.id === o[k]));
  });
  const out: FlowScript = {...s, id: `${s.id}-vsync`, lanes, resources: [], events};
  vsyncCache.set(s, out);
  return out;
};

const renderInner = (rawSpec: string, c: SlotCtx, inner: {w: number; h: number}): React.ReactNode => {
  const useB = rawSpec.startsWith('b:');
  const script = useB && c.compare ? c.compare : c.script;
  const spec = useB ? rawSpec.slice(2) : rawSpec;
  const [kind, a, b] = spec.split(':');
  const span = c.view[1] - c.view[0];
  const div = c.compare ? firstDivergence(c.script, c.compare) : undefined;
  switch (kind) {
    case 'swimlane':
      return (
        <SwimlaneView
          script={script}
          t={c.t}
          width={inner.w}
          height={inner.h}
          frame={c.frame}
          focus={c.focus}
          view={c.view}
          compact={!!c.compare}
          labelRecent={span * 0.3}
          animMs={script.timeUnit === 'step' ? span * 0.006 : script.timeUnit === 's' ? Math.min(span * 0.004, 60) : undefined}
          markLines={div !== undefined && c.t >= div ? [{at: div, label: '首次分歧'}] : []}
        />
      );
    case 'graph': {
      // graph:<名字>：先找 options.graphSets，再当作进程 id
      const only = a ? c.options?.graphSets?.[a] ?? (script.instances ?? []).filter((i) => i.process === a).map((i) => i.id) : undefined;
      return <InstanceGraphView script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} focus={c.focus} view={c.view} only={only} />;
    }
    case 'proc-seq':
      return <ProcessSequenceView script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} />;
    case 'lifecycle':
      return <LifecycleView script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} config={c.options?.lifecycle} />;
    case 'dispatch-rules':
      return <DispatchRuleView script={script} t={c.t} width={inner.w} height={inner.h} config={c.options?.dispatchRules} />;
    case 'view-tree':
      return <ViewTreeView script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} config={c.options?.viewTree} />;
    case 'dumpsys':
      return <DumpsysView script={script} t={c.t} width={inner.w} height={inner.h} since={c.prevTo} />;
    case 'callstack': {
      // callstack:<名字> 与 graph:<名字> 同样的过滤规则
      const only = a ? c.options?.graphSets?.[a] ?? (script.instances ?? []).filter((i) => i.process === a).map((i) => i.id) : undefined;
      return <CallStackView script={script} t={c.t} unit={script.timeUnit === 'step' ? '步' : 'ms'} only={only} />;
    }
    case 'objects':
      return <ObjectBoard script={script} t={c.t} within={Math.max(3, span * 0.05)} />;
    case 'screen':
      return <ScreenView script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} navBar={c.options?.screenNavBar} />;
    case 'code':
      return <CodeView key={c.stepIndex} code={c.step.code} localSec={c.local} />;
    case 'class-info':
      return <ClassInfoView id={c.focus[0]} />;
    case 'tree':
      return <DualTreeView script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} />;
    case 'task-stack':
      return <TaskStackView script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} {...c.options?.taskStack} />;
    case 'pool':
      return <ResourcePoolView script={script} t={c.t} focus={c.focus} compact />;
    case 'pipeline':
      return c.options?.pipeline ? (
        <PipelineView script={script} t={c.t} config={c.options.pipeline} width={inner.w} height={inner.h} frame={c.frame} focus={c.focus} />
      ) : (
        <div style={{color: colors.bad}}>pipeline 槽位需要 options.pipeline</div>
      );
    case 'res-state': {
      // 当前聚焦资源（缺省第一个）的状态机
      if (!script.pool) return <div style={{color: colors.muted}}>没有资源池</div>;
      const id = script.resources.find((r) => c.focus.includes(r.id))?.id ?? script.resources[0]?.id;
      const now = resourceAt(script, id, c.t);
      const before = resourceAt(script, id, now.since - 1e-6);
      const sm = getPool(script.pool.def).stateMachine;
      return <StateView machine={sm} current={now.state} prev={before.state} width={inner.w} height={inner.h} title={`${id} · ${getStateMachine(sm).title}`} />;
    }
    case 'vsync': {
      if (!script.clockProfile) return <div style={{color: colors.muted}}>没有 clockProfile</div>;
      const T = 1000 / getClockProfile(script.clockProfile).refreshHz;
      return (
        <SwimlaneView script={vsyncScript(script)} t={c.t} width={inner.w} height={inner.h} frame={c.frame} view={[c.t - 2.6 * T, c.t + 0.6 * T]} compact />
      );
    }
    case 'state-stage':
      return <StateStageView script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} object={a} view={c.view} />;
    case 'timers':
      return <TimerView script={script} t={c.t} />;
    case 'chapters':
      return (
        <ChapterBar
          chapters={script.chapters ?? []}
          range={script.window}
          t={c.t}
          view={c.view[0] !== script.window[0] || c.view[1] !== script.window[1] ? c.view : undefined}
          width={inner.w}
          height={inner.h}
          unit={script.timeUnit === 's' ? 's' : 'ms'}
        />
      );
    case 'services':
      return <ServiceGrid script={script} t={c.t} width={inner.w} height={inner.h} frame={c.frame} />;
    case 'props':
      return <PropBoard script={script} t={c.t} />;
    case 'diff':
      return c.compare ? <DiffView a={c.script} b={c.compare} t={c.t} /> : <div style={{color: colors.muted}}>diff 需要对比脚本</div>;
    case 'queue':
      return <MessageQueueView script={script} lane={a} t={c.t} />;
    case 'state': {
      const st = objectStateAt(script, b, c.t);
      const label = script.objects?.find((o) => o.id === b)?.label;
      return <StateView machine={a} current={st.state} prev={st.prev} width={inner.w} height={inner.h} title={label} />;
    }
    default:
      return <div style={{color: colors.bad}}>未知槽位 {rawSpec}</div>;
  }
};

/** 槽位的主类型（去掉 b: 前缀和参数），停点校验、图例选择用 */
export const slotKind = (spec?: string) => (spec ?? '').replace(/^b:/, '').split(':')[0];

export const renderSlot = (spec: string, r: Rect, c: SlotCtx): React.ReactNode => {
  const kind = slotKind(spec);
  if (BARE.has(kind)) {
    return (
      <div key={`${spec}@${r.x},${r.y}`} style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h}}>
        {renderInner(spec, c, {w: r.w, h: r.h})}
      </div>
    );
  }
  const pad = NO_PAD.has(kind) ? 0 : kind === 'state' || kind === 'res-state' ? 8 : 12;
  return (
    <div
      key={`${spec}@${r.x},${r.y}`}
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        padding: pad,
        boxSizing: 'border-box',
        background: colors.panel,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {renderInner(spec, c, {w: r.w - pad * 2, h: r.h - pad * 2})}
    </div>
  );
};

/** 沿用上一步的 layout / slots（Step 不写就继承） */
export const resolveStepLayout = (steps: Step[], index: number, fallback: {layout: LayoutId; slots: Record<string, string>}) => {
  let layout = fallback.layout;
  let slots = fallback.slots;
  for (let i = 0; i <= index && i < steps.length; i++) {
    if (steps[i].layout) layout = steps[i].layout as LayoutId;
    if (steps[i].slots) slots = steps[i].slots as Record<string, string>;
  }
  return {layout, slots};
};
