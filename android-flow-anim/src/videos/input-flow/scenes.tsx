import React from 'react';
import {imeKeyScript} from '../../flows/input/imeKey';
import {inputFlowScript} from '../../flows/input/inputFlow';
import {
  imeGraphStory,
  imeOverviewStory,
  INPUT_DISPATCH_RULES,
  INPUT_GRAPH_SETS,
  INPUT_VIEW_TREE,
  inputAppStory,
  inputChannelStory,
  inputDispatchStory,
  inputOverviewStory,
  inputReaderStory,
  inputViewTreeStory,
} from '../../flows/input/stories';
import {makeTemplateScene} from '../../layouts/TemplateScene';
import {SummaryCard, TitleCard} from '../../views/Cards';

const SUB = '示意时序 · 一个 Button 的界面';
const OPTS = {graphSets: INPUT_GRAPH_SETS, dispatchRules: INPUT_DISPATCH_RULES, viewTree: INPUT_VIEW_TREE};
const graph = (set: string) => ({kind: 'call-chain' as const, options: OPTS, slots: {main: `graph:${set}`, s1: `callstack:${set}`, s2: 'code'}});

export const InputTitleScene: React.FC = () => (
  <TitleCard
    kicker="AOSP · frameworks/base + frameworks/native（inputflinger）· 示意时序"
    title="touch / key 事件的完整响应"
    subtitle="整体跨进程 → 每个进程里怎么处理 → 应用布局内部怎么响应（以一个 Button 为例）"
    chips={['通道', '分发', 'InputStage', 'View 树', 'IME']}
  />
);

/** 整体：进程时序图（只画跨进程交互） */
export const InputOverviewScene = makeTemplateScene({
  script: inputFlowScript,
  story: inputOverviewStory,
  title: '整体：touch / key 跨了哪些进程',
  subtitle: SUB,
  // 这个流程没有状态机对象，右侧放每个事件的输入超时计时（waitQueue 等 FINISHED，5s）
  slots: {main: 'proc-seq', s1: 'screen', s2: 'timers', s3: 'chapters', s4: 'code'},
});

/** system_server：建立通道 */
export const InputChannelScene = makeTemplateScene({
  ...graph('channel'),
  script: inputFlowScript,
  story: inputChannelStory,
  title: '① 应用和 InputDispatcher 怎么建立通道',
  subtitle: 'addWindow 时：socketpair · 窗口信息 · 焦点',
});

/** system_server：InputReader 线程 */
export const InputReaderScene = makeTemplateScene({
  ...graph('reader'),
  script: inputFlowScript,
  story: inputReaderStory,
  title: '② 硬件事件怎么变成软件事件',
  subtitle: 'InputReader 线程：EventHub → Mapper → 监听链 → InputDispatcher',
});

/** system_server：InputDispatcher 线程，主视图是分发标准 */
export const InputDispatchScene = makeTemplateScene({
  script: inputFlowScript,
  story: inputDispatchStory,
  kind: 'call-chain',
  options: OPTS,
  layout: 'stage',
  slots: {main: 'dispatch-rules', s1: 'callstack', s2: 'screen', s3: 'code'},
  title: '③ 分发给哪个窗口：标准是什么',
  subtitle: 'InputDispatcher 线程：touch 看坐标，key 看焦点',
});

/** com.foo：接收 + InputStage */
export const InputAppScene = makeTemplateScene({
  ...graph('app'),
  script: inputFlowScript,
  story: inputAppStory,
  title: '④ 应用进程收到事件后怎么处理',
  subtitle: 'Looper → NativeInputEventReceiver → ViewRootImpl → 7 个 InputStage',
});

/** 应用布局内部：View 树 */
export const InputViewTreeScene = makeTemplateScene({
  script: inputFlowScript,
  story: inputViewTreeStory,
  kind: 'view-tree',
  options: OPTS,
  title: '⑤ 应用布局内部：View 树',
  subtitle: 'touch 走命中路径 · key 走 mFocused · 变化向上冒泡，下一帧向下遍历',
});

/** key + 输入法 */
export const ImeOverviewScene = makeTemplateScene({
  script: imeKeyScript,
  story: imeOverviewStory,
  title: '⑥ key + 输入法：按键先给 IME',
  subtitle: '对照场景：多一个获得焦点的 EditText · AOSP PinyinIME',
});
export const ImeGraphScene = makeTemplateScene({
  ...graph('ime'),
  script: imeKeyScript,
  story: imeGraphStory,
  title: '⑥ 输入法内部：消费按键、提交文字',
  subtitle: 'app ↔ IME：InputChannel 传按键，binder 传编辑命令',
});

export const InputEndingScene: React.FC = () => (
  <SummaryCard
    heading="touch / key 的要点"
    lines={[
      ['一条通道', 'addWindow 时 InputDispatcher 建 socketpair，服务端留下、客户端给应用；窗口信息和焦点经 SurfaceFlinger 同步'],
      ['两种标准', 'touch：Z 序前→后找第一个可见、可触摸、区域包含该点的窗口（DOWN 定终身）；key：两次策略拦截后发给焦点窗口'],
      ['一条 InputStage 链', '7 级依次处理，有输入法会话时 ImeInputStage 先异步交给 IME；处理完回 FINISHED，5 秒不回就 ANR'],
      ['View 树', 'touch 走命中路径并记 mFirstTouchTarget，key 走 mFocused；点击后 requestLayout / invalidate 冒泡，下一帧 measure → layout → draw'],
    ]}
  />
);
