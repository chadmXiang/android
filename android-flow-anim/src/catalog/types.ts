export type Layer = 'hw' | 'kernel' | 'native' | 'system_server' | 'systemui' | 'app';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProcessDef {
  id: string;
  label: string;
  layer: Layer;
  /** 全景图上的固定坑位（1920 宽画布坐标） */
  box: Rect;
}

export interface ComponentDef {
  id: string;
  short: string;
  /** 全景图上显示的文字 */
  label: string;
  process: string;
  role: string;
  never?: string;
  classes?: string[];
  src?: string;
  stateMachines?: string[];
}

export interface SmEdge {
  from: string;
  to: string;
  via: string;
  code?: string;
}

export interface StateMachineDef {
  id: string;
  title: string;
  states: string[];
  edges: SmEdge[];
  /** 节点中心坐标（StateView viewBox 坐标系） */
  layout: Record<string, {x: number; y: number}>;
  size: {w: number; h: number};
}

export interface PoolQuota {
  state: string;
  param: string;
  allowExtra?: number;
  code?: string;
}

export interface PoolDef {
  id: string;
  title: string;
  stateMachine: string;
  freeState: string;
  quotas: PoolQuota[];
  onExhausted: {wait: string; code?: string};
}

export interface ClockProfile {
  id: string;
  label: string;
  refreshHz: number;
  /** null = 跟随周期（sysprop 为 -1 时的默认） */
  appWork: number | null;
  sfWork: number | null;
  note?: string;
}

export interface ScreenDef {
  id: string;
  title: string;
  bg: string;
  kind: 'grid' | 'list' | 'opening' | 'splash' | 'closing' | 'black' | 'logo' | 'bootanim' | 'button';
  /** button 界面：按钮是否按下 / 是否有焦点框 */
  pressed?: boolean;
  focused?: boolean;
  /** button 界面：有值时上方多一个 EditText（内容）；ime 有值时显示软键盘（候选栏内容） */
  edit?: string;
  ime?: string;
  /** opening / closing 动画时长（模拟时间单位），默认 4 */
  animMs?: number;
  /** logo 画面上的文字 */
  text?: string;
}

// —— 类级目录 ——
export type ClassOwner = 'app' | 'atms' | 'wms' | 'ams' | 'pms' | 'gfx' | 'zygote' | 'input' | 'view' | 'ime' | 'init';
export type ClassKind = 'service' | 'binder-stub' | 'container' | 'record' | 'controller' | 'helper' | 'data' | 'ui';

export interface ClassDef {
  id: string;
  name: string;
  owner: ClassOwner;
  kind: ClassKind;
  /** 路径缩写同文档：app/ view/ wm/ am/ pm/ … */
  file: string;
  role: string;
  methods?: string[];
  fields?: string[];
  /** 版本差异 / 需核对说明 */
  note?: string;
  /** 实例自带的状态机（流程里 state 事件可以直接作用在该类的实例上） */
  stateMachine?: string;
}

/** 由 fields 字符串 + 类关系推导出的结构化成员 */
export interface ClassField {
  name: string;
  type?: string;
  /** 指向的类（类型名匹配或关系 label 匹配） */
  ref?: string;
  relation?: RelationKind;
}

export type RelationKind = 'extends' | 'owns' | 'holds' | 'creates' | 'binder' | 'mirror' | 'children';

export interface ClassRelation {
  from: string;
  to: string;
  kind: RelationKind;
  label?: string;
}

export interface ClassMapDef {
  id: string;
  title: string;
  cardW: number;
  regions: {label: string; x: number; y: number; w: number; h: number; color?: string}[];
  /** 卡片左上角坐标（画布 1840 × 740） */
  classes: {id: string; x: number; y: number; w?: number}[];
  /** 只在这张图里成立的关系（如跨过未展示的中间层） */
  extraRelations?: ClassRelation[];
  /** 隐藏全局关系，key = 'from>to' */
  hide?: string[];
  /** 手工路由拐点，key = 'from>to' */
  vias?: Record<string, [number, number][]>;
}
