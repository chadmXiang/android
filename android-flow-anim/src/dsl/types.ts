import type {Layer} from '../catalog/types';

export type SpanStyle = 'cpu' | 'gpu' | 'sf' | 'wait' | 'display';
export type Tone = 'ok' | 'warn' | 'bad' | 'info';
export type SignalKind = 'acquire-fence' | 'release-fence' | 'present-fence';
export type TreeNodeKind = 'root' | 'container' | 'buffer' | 'leash';

/** 进程实例（不同于 catalog 里的进程"坑位"）：同一视频里可以有 Launcher、com.foo 两个 app 进程 */
export interface ProcessInstance {
  id: string;
  label: string;
  layer: Layer;
  /** 不填则由 fork 事件推断 */
  bornAt?: number;
}

export interface LaneDef {
  id: string;
  label: string;
  sub?: string;
  component?: string;
  process?: string;
  /** 泳道对应的类（类级时序图） */
  cls?: string;
  /** 泳道代表的实例：泳道上的 span / 调用都归到这个实例上（对象协作图用） */
  inst?: string;
}
export interface ResourceDef {
  id: string;
  label: string;
}
export interface ObjectDef {
  id: string;
  label: string;
  stateMachine: string;
}
/**
 * 类的实例：流程里"活"的对象。
 * 不写 new 事件 = 随进程诞生就存在；写了 new = 在那一刻被创建。
 * 若类自带状态机（ClassDef.stateMachine），state 事件可直接以实例 id 为 object。
 */
export interface InstanceDef {
  id: string;
  cls: string;
  process: string;
  /** 区分同类的多个实例，如 'com.foo' */
  label?: string;
  /** 协作图分列：同进程内按 group 分列（不写则按类的 owner 分列） */
  group?: string;
  /** 流程开始时已有的字段值：值是实例 id（画成引用）或任意文字 */
  fields?: Record<string, string>;
}
export interface TreeSpec {
  id: string;
  title: string;
  root: string;
}

// —— 通用 ——
export type SpanEvent = {
  type: 'span';
  lane: string;
  start: number;
  end: number;
  label: string;
  style: SpanStyle;
  resource?: string;
  frame?: string;
};
export type FlowMessage = {type: 'message'; at: number; from: string; to: string; label: string};
export type MarkerEvent = {type: 'marker'; at: number; lane: string; label: string; tone: Tone};
/** by：触发这次迁移的泳道（状态驱动模板里，事件从这条泳道"打"进状态机）；不写则取 at 时刻正在执行的泳道 */
export type StateEvent = {type: 'state'; at: number; object: string; to: string; by?: string};
/**
 * 超时计时器（ANR 等）：at 时由 lane 启动，duration 后到期；cancelAt 早于到期则视为取消。
 * object 可选：计时器挂在哪个状态机对象上（状态驱动模板把倒计时画在它旁边）。
 */
export type TimeoutEvent = {
  type: 'timeout';
  id: string;
  at: number;
  duration: number;
  lane: string;
  label: string;
  object?: string;
  cancelAt?: number;
};
export type TreeEvent = {
  type: 'tree';
  at: number;
  tree: string;
  op: 'add' | 'remove' | 'reparent' | 'attr';
  node: string;
  parent?: string | null;
  label?: string;
  kind?: TreeNodeKind;
  mapTo?: string;
  note?: string;
};
/** by 在 at 时刻 new 出 inst；带 field 时同时赋值 by.field = inst */
export type NewEvent = {type: 'new'; at: number; by: string; inst: string; field?: string};
/** 实例字段赋值：value 是实例 id 时画成引用线，否则当文字显示；null = 置空 */
export type SetEvent = {type: 'set'; at: number; inst: string; field: string; value: string | null};
/** dumpsys 快照的一行：section 如 'activity activities'；value 为 null 表示这一行消失 */
export type DumpEvent = {type: 'dump'; at: number; section: string; key: string; value: string | null};
export type ScreenEvent = {type: 'screen'; at: number; show: string};
/** 用户输入：在 SwimlaneView 上显示为标注；target 用于 ScreenView 判断按下了哪个按钮 */
export type InputEvent = {
  type: 'input';
  at: number;
  lane: string;
  kind: 'touch-down' | 'touch-up' | 'key-down' | 'key-up';
  label: string;
  target?: string;
};

/** 服务就绪：at 开始启动，end 就绪（不填视为瞬间就绪）；ServiceGrid 用 */
export type ServiceEvent = {type: 'service'; at: number; end?: number; name: string; group: string};
/** 启动阶段，如 SystemServiceManager.startBootPhase */
export type PhaseEvent = {type: 'phase'; at: number; value: number; label: string; lane?: string};
/** 系统属性变化（setprop / init.svc.*）；PropBoard 用 */
export type PropEvent = {type: 'prop'; at: number; lane: string; key: string; value: string};

export interface Chapter {
  id: string;
  title: string;
  start: number;
  end: number;
}
export interface ServiceGroup {
  id: string;
  label: string;
  layer: Layer;
}

// —— 系统流程原语 ——
/** 同步 binder：调用方从 at 阻塞到 returnAt */
export type CallEvent = {type: 'call'; at: number; from: string; to: string; method: string; returnAt?: number};
/** 进程内方法调用（类级时序图）：from 调 to.method，returnAt 返回 */
export type InvokeEvent = {type: 'invoke'; at: number; from: string; to: string; method: string; returnAt?: number};
/** oneway binder：只投递，不等返回 */
export type OnewayEvent = {type: 'oneway'; at: number; from: string; to: string; method: string};
export type SocketEvent = {type: 'socket'; at: number; from: string; to: string; label: string};
/** fork：process 指向 processes 里的子进程，to 是子进程的第一条泳道 */
export type ForkEvent = {type: 'fork'; at: number; from: string; to: string; process: string; label?: string; exec?: boolean};
/** Handler 消息：at 时投递到 to 线程的 MessageQueue，handledAt 时被 Looper 取出 */
export type PostEvent = {type: 'post'; at: number; from: string; to: string; msg: string; handledAt: number};
/** 引用子流程片段：时间整体平移 at，'$xxx' 占位泳道按 lanes 映射 */
export type IncludeEvent = {type: 'include'; at: number; fragment: string; lanes: Record<string, string>};

// —— 渲染抽象出的原语 ——
export type ResourceEvent = {type: 'resource'; id: string; at: number; state: string; owner: string};
export type BatchEvent = {type: 'batch'; at: number; from: string; to: string; label: string};
export type SignalEvent = {
  type: 'signal';
  id: string;
  kind: SignalKind;
  resource?: string;
  createdAt: number;
  signaledAt?: number;
};
export type CheckEvent = {type: 'check'; at: number; lane: string; signal: string; label: string};
export type JankEvent = {type: 'jank'; at: number; lane: string; label: string};

export type FlowEvent =
  | SpanEvent
  | FlowMessage
  | MarkerEvent
  | StateEvent
  | TreeEvent
  | ScreenEvent
  | CallEvent
  | OnewayEvent
  | SocketEvent
  | ForkEvent
  | PostEvent
  | InputEvent
  | IncludeEvent
  | ResourceEvent
  | BatchEvent
  | SignalEvent
  | CheckEvent
  | ServiceEvent
  | PhaseEvent
  | PropEvent
  | InvokeEvent
  | JankEvent
  | NewEvent
  | SetEvent
  | TimeoutEvent
  | DumpEvent;

export interface CodeRef {
  file: string;
  snippet?: string;
  note?: string;
}

export interface Step {
  to: number;
  move: number;
  hold: number;
  caption: string;
  /** 口播稿：缺省用 caption 洗掉装饰符号后朗读（见 engine/narration.ts 的 speechText） */
  speak?: string;
  code?: CodeRef;
  focus?: string[];
  /** 镜头时间窗：缺省沿用上一步（长流程用它做 L0 ↔ L2 缩放） */
  view?: [number, number];
  /** 布局模板（TemplateScene 用）：缺省沿用上一步 */
  layout?: 'timeline' | 'stage' | 'graph' | 'wide' | 'split' | 'phase' | 'full';
  /** 槽位 → 视图，如 {main: 'task-stack', s1: 'state:activity-record:ar-foo'}；缺省沿用上一步 */
  slots?: Record<string, string>;
}
export interface FlowStory {
  steps: Step[];
}

/** 流程性质：决定默认模板（布局 + 槽位 + 停点规则），见 layouts/templates.ts */
export type TemplateKind =
  | 'process'
  | 'call-chain'
  | 'pipeline'
  | 'structure'
  | 'mapping'
  | 'state'
  | 'lifecycle'
  | 'phase'
  | 'compare'
  | 'dumpsys'
  | 'view-tree'
  | 'timeline';

export interface FlowScript {
  id: string;
  kind?: TemplateKind;
  title: string;
  subtitle?: string;
  window: [number, number];
  clockProfile?: string;
  vsyncLanes?: {app?: string; sf?: string};
  pool?: {def: string; params: Record<string, number>};
  processes?: ProcessInstance[];
  lanes: LaneDef[];
  resources: ResourceDef[];
  objects?: ObjectDef[];
  instances?: InstanceDef[];
  trees?: TreeSpec[];
  events: FlowEvent[];
  /** 仅影响显示：'s' 显示秒、'step' 显示逻辑步骤（数据仍按数值写） */
  timeUnit?: 'ms' | 's' | 'step';
  chapters?: Chapter[];
  serviceGroups?: ServiceGroup[];
}
