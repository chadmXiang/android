import type {FlowScript, TemplateKind} from '../dsl/types';
import {callStackAt, instancesOf} from '../engine/instances';
import {eventsOf} from '../engine/state';
import {MSG_ANIM_MS, TOKEN_ANIM_MS} from '../engine/text';
import {crossProcessRows} from '../views/ProcessSequenceView';
import {defaultStateObject, stateStagePulse} from '../views/StateStageView';
import type {LayoutId} from './slots';

/**
 * 模板 = 流程性质 → 默认布局 + 默认槽位 + 停点规则。
 * 脚本写 kind，场景用 makeTemplateScene({script, story}) 即可；Step 上写 layout / slots 可以局部覆盖（如 Home 键中途切到时序）。
 */

export interface TemplateDef {
  name: string;
  /** 适用的流程 */
  examples: string;
  /** 主视图要回答的问题 */
  question: string;
  layout: LayoutId;
  slots: Record<string, string>;
  /** 停点建议（文字版，校验器实现见 stopIssues） */
  stopRule: string;
}

export const TEMPLATES: Record<TemplateKind, TemplateDef> = {
  process: {
    name: '进程交互型',
    examples: '冷启动的进程视角、Binder 往返链路',
    question: '涉及哪些进程、按什么顺序互相调用、谁在阻塞等待',
    layout: 'timeline',
    slots: {main: 'proc-seq', s1: 'screen', s2: 'objects', s3: 'chapters', s4: 'code'},
    stopRule: '最后一行交互画完再停（行时刻 + 全窗口宽 × 0.6%）',
  },
  lifecycle: {
    name: '生命周期型（前台切换）',
    examples: '冷启动 / Home 键 / 返回键里两个 Activity 的交接',
    question: '每个 Activity 走到了哪个回调、服务端状态是什么、谁可见谁有焦点',
    layout: 'stage',
    slots: {main: 'lifecycle', s1: 'task-stack', s2: 'screen', s3: 'code'},
    stopRule: '无特殊要求；建议停在两个 Activity 状态"交接"的时刻',
  },
  'view-tree': {
    name: '视图树型（应用布局内部）',
    examples: 'touch / key 在 View 树里的分发、点击后的重新布局与重绘',
    question: '事件走到了哪个 View、谁的标志位变了、变化怎么冒泡到 ViewRootImpl、下一帧怎么遍历',
    layout: 'graph',
    slots: {main: 'view-tree', s1: 'callstack', s2: 'code'},
    stopRule: '停在调用进行中（同协作图）：调用栈不能为空',
  },
  dumpsys: {
    name: 'dumpsys 视角',
    examples: '流程前后 dumpsys activity / window / SurfaceFlinger 的变化',
    question: '每一步之后，系统里能 dump 出来的状态变了哪些',
    layout: 'full',
    slots: {main: 'dumpsys'},
    stopRule: '每一步对比的是"上一步停点 → 本步停点"之间的变化',
  },
  'call-chain': {
    name: '调用链型',
    examples: 'startActivity、addWindow、bindService',
    question: '此刻谁在调谁、栈有多深、对象之间怎么引用',
    layout: 'graph',
    slots: {main: 'graph', s1: 'callstack', s2: 'code'},
    stopRule: '停在调用栈最深处（协作图看"此刻"），不要停在一段调用全部返回之后',
  },
  pipeline: {
    name: '流水线 / 周期型',
    examples: '一帧渲染、输入分发',
    question: '令牌走到了哪一段、谁在等谁、离下一个 VSYNC 还有多久',
    layout: 'wide',
    slots: {main: 'pipeline', s1: 'res-state', s2: 'vsync', s3: 'code'},
    stopRule: '资源迁移后至少 TOKEN_ANIM_MS（0.6）再停',
  },
  structure: {
    name: '结构变化型',
    examples: 'Home 键、多窗口、Task 切换',
    question: '谁在栈顶、谁可见、焦点在哪个窗口',
    layout: 'stage',
    slots: {main: 'task-stack', s1: 'objects', s2: 'screen', s3: 'code'},
    stopRule: 'reparent 之后至少 3（Task 栈换位动画）再停',
  },
  mapping: {
    name: '映射型',
    examples: 'WMS 容器层 ↔ SF Layer',
    question: '两边的节点怎样一一对应、谁只存在于一边',
    layout: 'stage',
    slots: {main: 'tree', s1: 'objects', s2: 'screen', s3: 'code'},
    stopRule: '树操作之后至少 1.5（树节点移动动画）再停',
  },
  state: {
    name: '状态驱动型',
    examples: 'Activity 生命周期、Service ANR',
    question: '对象现在处于什么状态、是谁把它推过去的、离超时还有多久',
    layout: 'stage',
    slots: {main: 'state-stage', s1: 'timers', s2: 'objects', s3: 'code'},
    stopRule: '状态迁移之后至少 2% 时间窗（迁移箭头飞行时长的一半）再停',
  },
  phase: {
    name: '阶段型',
    examples: '开机',
    question: '现在在哪一章、哪些服务已经就绪、关键属性是什么',
    layout: 'phase',
    slots: {chapters: 'chapters', main: 'services', s1: 'screen', s2: 'props', s3: 'code'},
    stopRule: '无特殊要求；主视图换成泳道时按泳道规则',
  },
  compare: {
    name: '对比 / bug 还原',
    examples: '双缓冲 vs 三缓冲、正常 vs ANR',
    question: '两份流程从哪一刻开始不同、不同在哪',
    layout: 'split',
    slots: {main: 'swimlane', sa: 'objects', b: 'b:swimlane', sb: 'b:objects', s1: 'diff'},
    stopRule: '两边共用同一时间轴；停点按泳道规则',
  },
  timeline: {
    name: '时序型（默认）',
    examples: '冷启动全链路、跨进程并发',
    question: '跨进程谁先谁后、谁在等谁',
    layout: 'timeline',
    slots: {main: 'swimlane', s1: 'screen', s2: 'objects', s3: 'callstack', s4: 'code'},
    stopRule: '箭头事件之后至少 animMs 再停',
  },
};

/**
 * 按脚本里有什么数据微调默认槽位：没有手机画面就换成类详情，没有实例就不放调用栈，
 * 状态驱动模板自动选挂了计时器的对象。
 */
export const templateFor = (script: FlowScript, kind?: TemplateKind) => {
  const k = kind ?? script.kind ?? 'timeline';
  const def = TEMPLATES[k];
  const hasScreen = eventsOf(script, 'screen').length > 0;
  const hasInst = instancesOf(script).length > 0;
  const slots: Record<string, string> = {};
  Object.entries(def.slots).forEach(([area, spec]) => {
    let v = spec;
    if (v === 'screen' && !hasScreen) v = k === 'state' ? 'timers' : 'class-info';
    if (v === 'callstack' && !hasInst) v = 'class-info';
    if (v === 'state-stage') {
      const obj = defaultStateObject(script);
      v = obj ? `state-stage:${obj}` : 'objects';
    }
    slots[area] = v;
  });
  return {kind: k, def, layout: def.layout, slots};
};

/** 一个停点在给定主视图下的问题（空数组 = 没问题） */
export const stopIssues = (
  mainKind: string,
  script: FlowScript,
  t: number,
  view: [number, number],
  ctx: {stepIndex: number; container?: string},
): string[] => {
  const out: string[] = [];
  const span = view[1] - view[0];
  const within = (at: number, d: number) => at < t && t - at < d - 1e-6;
  switch (mainKind) {
    case 'graph':
    case 'view-tree':
      if (ctx.stepIndex > 0 && callStackAt(script, t).frames.length === 0) {
        out.push('协作图停点处没有未返回的同步调用：应停在调用栈最深处，而不是一段调用结束之后');
      }
      break;
    case 'task-stack': {
      const container = ctx.container ?? 'wm:tda';
      eventsOf(script, 'tree')
        .filter((e) => e.op === 'reparent' && e.parent === container && within(e.at, 3))
        .forEach((e) => out.push(`Task 栈换位（${e.node}@${e.at}）的动画还没结束：停点应晚于 ${e.at + 3}`));
      break;
    }
    case 'tree':
      eventsOf(script, 'tree')
        .filter((e) => within(e.at, 1.5))
        .forEach((e) => out.push(`树操作 ${e.op} ${e.node}@${e.at} 的动画还没结束：停点应晚于 ${e.at + 1.5}`));
      break;
    case 'pipeline':
      eventsOf(script, 'resource')
        .filter((e) => within(e.at, TOKEN_ANIM_MS))
        .forEach((e) => out.push(`资源 ${e.id}→${e.state}@${e.at} 的令牌动画还没结束：停点应晚于 ${e.at + TOKEN_ANIM_MS}`));
      break;
    case 'state-stage': {
      const pulse = stateStagePulse(view);
      eventsOf(script, 'state')
        .filter((e) => within(e.at, pulse * 0.5))
        .forEach((e) => out.push(`状态迁移 ${e.object}→${e.to}@${e.at} 的箭头还在飞：停点应晚于 ${(e.at + pulse * 0.5).toFixed(1)}`));
      break;
    }
    case 'proc-seq': {
      // 进程时序图的行按"全窗口宽 × 0.6%"画出，停点要等最后一行画完
      const anim = (script.window[1] - script.window[0]) * 0.006;
      crossProcessRows(script).forEach((r, i) => {
        if (within(r.at, anim)) out.push(`进程时序图第 ${i + 1} 行（${r.label}@${r.at}）还没画完：停点应晚于 ${(r.at + anim).toFixed(1)}`);
      });
      break;
    }
    case 'swimlane': {
      const anim = script.timeUnit === 'step' ? span * 0.006 : script.timeUnit === 's' ? Math.min(span * 0.004, 60) : MSG_ANIM_MS;
      [...eventsOf(script, 'call'), ...eventsOf(script, 'oneway'), ...eventsOf(script, 'message'), ...eventsOf(script, 'invoke')]
        .filter((e) => within(e.at, anim))
        .forEach((e) => out.push(`箭头@${e.at} 还没画完：停点应晚于 ${(e.at + anim).toFixed(2)}`));
      break;
    }
    default:
      break;
  }
  return out;
};
