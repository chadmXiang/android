下面是整理好的 `README.md`，放在项目根目录即可。它覆盖以下内容：

- 项目结构和核心概念
- 环境与命令
- 怎么做一个新视频（含最小模板）
- 怎么添加各类东西
- 怎么调整画面、节奏、布局
- 常见问题

````markdown
# android-flow-anim

> 最后更新: 2026-10-26 · 无对应代码提交（VGUI 视频与实测日志说明）

用代码生成 **Android 系统流程讲解动画**，用于学习 AOSP 原理和还原 bug。

基于 [Remotion](https://www.remotion.dev/)（React → MP4）。一份流程脚本（DSL）配上一份分镜，就能渲染成视频；同一份脚本可以用多种视图来展示，比如时序泳道、管线图、状态机、容器树、手机画面、类图等。

已登记的视频合成（含保留的旧版）：

| Composition | 内容 |
|---|---|
| `FrameLifecycle` | 一帧是怎么渲染出来的（VSYNC / BufferQueue / SF / 三级缓冲 / WMS 树） |
| `AppLaunch` | 从 Launcher 冷启动应用：① 进程 ② 进程内部（system_server / zygote / com.foo）③ 生命周期 ④ dumpsys |
| `AppLaunchLegacy` | 冷启动旧版（全景图 + 线程泳道 + 双树），仅用于对比 |
| `HomeKey` | Home 键（主场景按阶段切换"时序 / Task 栈"模板） |
| `HomeKeyLegacy` | Home 键旧版（固定 泳道 + 双树），仅用于对比，确认后可删 |
| `Boot` | 开机流程：① 进程接力 ② init / zygote / system_server 内部 ③ 服务与 boot phase ④ getprop / service list / ps / SurfaceFlinger |
| `BootLegacy` | 开机旧版（全景图 + 泳道 + 服务网格），仅用于对比 |
| `KeyClasses` | AMS / ATMS / WMS / PMS 关键类与类级时序（含协作图版本） |
| `InputFlow` | touch / key 事件的完整响应（一个 Button）：整体跨进程 → 建通道 / InputReader / 分发标准 / 应用 InputStage → View 树 → key + 输入法 |
| `ServiceAnr` | Service 启动与 Service ANR（状态驱动模板 + 对比模板） |
| `VguiFlow` | 四章 VGUI 注册与命中链路 + 合成「制热」九步教学示例 |

> **准确性约定**
> - 时序数字默认都是**示意**，会在标题或字幕里标出。
> - 代码引用（`CodeRef`）**只写已核对的行号**。未核对的只写文件和方法名，或标注“需核对”。
> - 源码基线：AOSP Android 17。

### VguiFlow：原理与合成制热示例

- 渲染：`npm run render:vgui` → `out/vgui-flow.mp4`；默认静音，1920×1080、30fps。
- 前四章保留语雀链路全景及 Android 注册/命中原理，使用示意时序；每镜头最多六个完整事件行，右侧展示方法级出处。
- 教学分镜：`src/flows/vgui/heatingCase.ts`。九步数据完全合成，不来自实车日志；角色、查询标识、页面、节点和控制字段均为泛化演示，不代表任何实际业务环境。
- 示例从文本注入「制热」开始，而非麦克风录音；使用明确的演示关联标识贯穿本地处理、云端命中、执行与反馈。时间栏只标阶段，不提供实测时间或延迟。
- 本地处理设定词表为空、匹配为空和 `tools=[] / ishit=false`，随后同一演示查询由云端命中。注册送达与当前查询的本地命中是不同环节，不能相互替代。

| 教学环节 | 通用核对原则 |
|---|---|
| 注册 | 对比应用与引擎收到的词条字面量及 `Touchable` 类型；注册成功不等于当前查询命中 |
| 文本查询与本地处理 | 确认入口类型、关联标识和当前 NLU 输入词表，区分本地未命中与其它处理阶段 |
| 云端到框架 | 对齐同一查询的云端 tool 与框架动作，核对 `item / viewType / action` 映射 |
| 仲裁与执行 | 区分候选页面、胜出页面、Compose 宿主与虚拟节点；节点 `CLICK` 成功不等于车控成功 |
| 车控下发与回读 | 分别核对点击回调、控制请求、接收响应、模式与目标状态回读；不把下发成功当作实际温升 |
| 并行语音反馈 | 分别核对 `hitBack`、反馈上报与同一 utterance 的 `onStart / onDone`，不以语音播放完成代替设备状态回读 |

九步按教学顺序展示，车控与语音反馈在逻辑上是并行分支，播放完成不依赖模式回读。演示用状态和目标温度符号不构成任何实测证据；真实排查时，控制状态更新仍不能单独证明实际温升或发热功率。

画面验证：在 Remotion Studio 逐停点检查完整换行和面板边界，再运行 `node scripts/qa.mjs out/vgui-flow.mp4` 并抽取实际成片帧。

案例面板的资料栏指向实际存在的教学数据文件，并明确标注“非实车日志”，不引用外部证据路径或未经核对的日志行号。演示事件行自然换行而不裁切；反馈区分别展示 `hitBack` 与 `reportVGUIFeedback`，车控分支分别展示响应和状态回读。

---

## 目录

1. [快速开始](#1-快速开始)
2. [项目结构](#2-项目结构)
3. [核心概念](#3-核心概念)
4. [怎么做一个新视频](#4-怎么做一个新视频)
5. [怎么添加一类东西](#5-怎么添加一类东西)
6. [怎么调整](#6-怎么调整)
7. [校验器](#7-校验器)
8. [常见问题](#8-常见问题)
9. [参考：原语 / 视图 / 字段速查](#9-参考)

---

## 1. 快速开始

```bash
npm i
npm run dev            # 打开 Remotion Studio：http://localhost:3000
npm run still          # 导出一帧 PNG，检查布局
npm run check          # 渲染前门禁：脚本 / 停点 / 节奏 三套校验，有 error 退出码 1
npm run render         # 渲染 FrameLifecycle
npm run render:launch  # AppLaunch
npm run render:home    # HomeKey
npm run render:boot    # Boot
npm run render:classes # KeyClasses
npm run render:service # ServiceAnr
npm run render:input   # InputFlow
npm run render:vgui    # VguiFlow → out/vgui-flow.mp4
npm run qa             # 渲染后自审：ffprobe + 抽帧黑帧 + 音量检测，有 critical 退出码 1
npm run explorer       # 交互式浏览页 → 打开 out/explorer/index.html
```

标准流程：`npm run check` → `npm run render:*` → `npm run qa`。

**旁白默认关闭**（技术文档的机器朗读听感差、还会把片长拉长 ~25%）。想要时显式打开：

```bash
npm run narrate              # 一次性合成旁白音频（之后可反复用）
npm run check:tts            # 用带旁白的时间轴跑门禁
npm run dev:tts              # Studio 里预览带旁白版本
npm run render:service:tts   # 渲染带旁白版本 → out/service-anr-tts.mp4
REMOTION_NARRATION=1 npm run render:boot   # 其它视频照这个前缀加
```

开关只有一个环境变量 `REMOTION_NARRATION=1`，它同时决定三件事：音轨挂不挂、`hold` 按不按音频时长回填、字幕要不要逐字点亮。不开 = 和加旁白之前完全一样的默片。

- **交互式浏览页**（不是视频）：选流程 → 切视图（协作图 / 泳道 / Task 栈 / 双树 / 服务网格）→ 拖时间轴或点分镜编号；左侧类索引可反查"这个类出现在哪些流程、首次在什么时刻"，点卡片可选中类。支持深链：`index.html?flow=home-key&view=task-stack&t=214&cls=task&story=0`（加 `still` 关闭动画循环，便于截图）。新流程要出现在浏览页，在 `src/explorer/registry.ts` 里加一项。

- **只调一个场景**：Studio 左侧每个视频的场景都单独注册了，名字形如 `Frame-Map`、`Launch-Overview`、`Classes-WmMap`。
- **Linux 中文字体**：渲染前需要安装，否则中文会显示成方块：
  ```bash
  sudo apt install fonts-noto-cjk
  ```
- **先看控制台**：启动后浏览器控制台会打印每份脚本的校验结果（`[flow:xxx] 校验通过` 或具体错误），建议先确认这一项。

---

## 2. 项目结构

```
src/
├── index.ts                  # registerRoot
├── Root.tsx                  # 注册所有视频（VIDEOS 列表）+ 启动时运行校验器
├── theme.ts                  # 颜色、字体、分辨率、FPS、状态色、帧血缘色
│
├── catalog/                  # ① 目录：Android 里"有什么"（写一次，全系列共用）
│   ├── types.ts              #   所有目录类型定义
│   ├── processes.ts          #   进程坑位（全景图上的固定位置）
│   ├── render.ts / system.ts / boot.ts   # 组件
│   ├── statemachines.ts      #   状态机（BufferSlot / Transition / ActivityRecord …）
│   ├── pools.ts              #   资源池（BufferQueue / KeyEvent …）
│   ├── clocks.ts             #   VSYNC 时钟配置（60Hz / 120Hz / 厂商绝对值）
│   ├── screens.ts            #   手机画面（Launcher / Splash / 开机动画 …）
│   ├── classes.ts            #   关键类 + 类关系
│   ├── classmaps.ts          #   类图布局
│   └── index.ts              #   getComponent / getProcess / getStateMachine …
│
├── dsl/                      # ② 流程原语
│   ├── types.ts              #   FlowScript / FlowEvent / Step / FlowStory
│   ├── builders.ts           #   span() / call() / res() / spawn() … 简写
│   └── validate.ts           #   校验器
│
├── engine/                   # ③ 引擎：任意时刻 t 的状态求值
│   ├── camera.ts             #   分镜 → 关键帧、镜头缩放 viewAt
│   ├── clock.ts              #   clock profile → VSYNC 刻度 / 流水线深度
│   ├── state.ts              #   资源 / fence / 树 / 对象 / 属性 在 t 时刻的状态
│   ├── resolve.ts            #   include 子流程展开
│   ├── geom.ts / text.ts     #   几何、文字宽度、动画常量
│
├── views/                    # ④ 视图：同一份脚本的不同画法
│   ├── SwimlaneView.tsx      #   时序泳道（主力）
│   ├── PipelineView.tsx      #   阶段 + 流向
│   ├── ResourcePoolView.tsx  #   资源池状态板
│   ├── StateView.tsx         #   状态机图
│   ├── DualTreeView.tsx      #   WMS 树 ↔ SF 树
│   ├── ScreenView.tsx        #   手机画面
│   ├── MapView.tsx           #   进程 / 组件全景图
│   ├── ClassMapView.tsx      #   类图
│   ├── ClassInfoView.tsx     #   类详情
│   ├── FormulaView.tsx       #   公式推导表
│   ├── ChapterBar.tsx        #   长流程章节条
│   ├── ServiceGrid.tsx       #   服务点亮网格 + boot phase
│   ├── PropBoard.tsx / ObjectBoard.tsx / MessageQueueView.tsx
│   ├── Chrome.tsx            #   Header / Panel / Caption / Legend / ArrowLegend
│   ├── CodeView.tsx / Cards.tsx / FenceFlag.tsx
│
├── layouts/
│   ├── StoryScene.tsx        #   分镜驱动的场景容器（最常用）
│   └── MapStory.tsx          #   makeMapScene：全景图场景工厂
│
├── flows/                    # ⑤ 流程脚本：每个场景一份
│   ├── render/  frame.ts · tripleBuffer.ts · firstFrame.ts（子流程片段）
│   ├── system/  appLaunch.ts · homeKey.ts · boot.ts
│   ├── wm/      surfaceTree.ts
│   ├── classes/ startActivity.ts · addWindow.ts · lanes.ts
│   ├── fragments.ts          #   子流程片段注册表
│   └── index.ts              #   ALL_SCRIPTS（全部参与校验）
│
└── videos/                   # ⑥ 视频：若干场景 + 时长
    ├── frame-lifecycle/  app-launch/  home-key/  boot/  key-classes/
    │   ├── scenes.tsx        #   场景组件（摆放视图）
    │   └── index.ts          #   XXX_SCENES: SceneEntry[]
```

**分层原则**：

- **脚本只描述“发生了什么”**（`flows/`）。
- **视图只负责“怎么画”**（`views/`）。
- **场景负责“画面上摆哪些视图”**（`videos/*/scenes.tsx`）。
- **目录负责“东西是什么”**（`catalog/`）。

改动尽量落在对应的那一层。

---

## 3. 核心概念

### 3.1 FlowScript：流程脚本

```ts
interface FlowScript {
  id: string;                     // 唯一 id（也用作 SVG id 前缀）
  title: string; subtitle?: string;
  window: [number, number];       // 模拟时间范围
  timeUnit?: 'ms' | 's' | 'step'; // 仅影响显示：ms / 秒 / 逻辑步骤
  clockProfile?: string;          // 'default-60' 等，自动画 VSYNC 刻度
  vsyncLanes?: {app?: string; sf?: string};
  pool?: {def: string; params: Record<string, number>};  // 资源池及其配额参数
  processes?: ProcessInstance[];  // 进程实例（可由 fork / spawn 诞生）
  lanes: LaneDef[];               // 泳道：线程 / 组件 / 类
  resources: ResourceDef[];       // 资源令牌（buffer、KeyEvent …）
  objects?: ObjectDef[];          // 有状态机的对象（ActivityRecord、Transition …）
  trees?: TreeSpec[];             // DualTreeView 用的两棵树
  chapters?: Chapter[];           // 长流程章节
  serviceGroups?: ServiceGroup[]; // ServiceGrid 分组
  events: FlowEvent[];            // 所有事件
}
```

### 3.2 时间：模拟时间 vs 视频时间

- **模拟时间 `t`**：脚本里写的数字，单位由流程决定（渲染流程用 ms、开机用 ms 但显示为秒、类级时序用“步”）。
- **视频时间**：由分镜 `Step` 的 `move` / `hold`（秒）决定。

### 3.3 Step / FlowStory：分镜

```ts
interface Step {
  to: number;              // 播放头移动到的模拟时间
  move: number;            // 移动耗时（秒）
  hold: number;            // 停留时长（秒）
  caption: string;         // 字幕
  code?: CodeRef;          // 右侧源码面板
  focus?: string[];        // 聚焦：资源 id / 类 id（高亮、ClassInfoView 显示第一个）
  view?: [number, number]; // 镜头时间窗（缩放）；不写则沿用上一步
}
```

一个场景对应一份 `FlowStory`（即 `steps` 数组）。同一份脚本可以配多份分镜，例如 `frame.ts` 里就有 `pipelineStory` 和 `frameStory` 两份。

### 3.4 视图与场景

场景组件通过 `StoryScene` 拿到当前状态，然后自己摆放视图：

```tsx
<StoryScene story={myStory} startT={script.window[0]} defaultView={script.window}
  render={({frame, t, seg, local, focus, total, view}) => (
    <>
      <Header title=... right={`${seg.index + 1} / ${total}`} />
      <Panel x={40} y={96} w={1300} h={736}>
        <SwimlaneView script={script} t={t} view={view} width={1300} height={736} frame={frame} focus={focus} />
      </Panel>
      <Caption key={seg.index} text={seg.step.caption} localSec={local} />
    </>
  )} />
```

`render` 回调拿到的字段：

| 字段 | 含义 |
|---|---|
| `t` | 当前模拟时间 |
| `view` | 当前镜头时间窗（只有传了 `defaultView` 才有值） |
| `seg` | 当前镜头；`seg.step` 就是当前 Step，`seg.index` 是序号 |
| `local` | 进入当前镜头后过去的视频秒数（字幕淡入等用） |
| `focus` | 当前 Step 的 focus |
| `frame` | 视频帧号（呼吸灯等动画用） |
| `total` | 镜头总数 |

---

## 4. 怎么做一个新视频

以“Service 启动”为例，完整步骤如下。

### Step 1：确认目录里有需要的东西

列出流程会经过的进程、组件、类、状态机、资源，到 `catalog/` 里检查。缺什么就按[第 5 节](#5-怎么添加一类东西)补上。

### Step 2：写流程脚本 `flows/<分类>/<名字>.ts`

```ts
import {call, invoke, mark, oneway, post, span, state} from '../../dsl/builders';
import type {FlowScript, FlowStory} from '../../dsl/types';

export const serviceStartScript: FlowScript = {
  id: 'service-start',
  title: 'Service 启动',
  subtitle: '示意时序（非实测）',
  window: [0, 200],
  processes: [
    {id: 'client', label: 'com.client', layer: 'app'},
    {id: 'system_server', label: 'system_server', layer: 'system_server'},
    {id: 'svc', label: 'com.svc', layer: 'app'},
  ],
  lanes: [
    {id: 'c:main', label: 'com.client · main', process: 'client'},
    {id: 'ss:binder', label: 'system_server · binder', process: 'system_server', component: 'ams'},
    {id: 's:main', label: 'com.svc · main', process: 'svc'},
  ],
  resources: [],
  objects: [],
  events: [
    span('c:main', 0, 10, 'startService', 'cpu'),
    call(10, 'c:main', 'ss:binder', 'IActivityManager.startService', 30),
    span('ss:binder', 10, 30, 'ActiveServices.startServiceLocked', 'cpu'),
    oneway(28, 'ss:binder', 's:main', 'scheduleCreateService'),
    // …
  ],
};

export const serviceStartStory: FlowStory = {
  steps: [
    {to: 0, view: [0, 200], move: 1.5, hold: 5, caption: '全貌……'},
    {to: 30, view: [0, 60], move: 3, hold: 6, caption: '……', code: {file: 'am/ActiveServices.java · startServiceLocked'}},
  ],
};
```

**写脚本的技巧**：

- 先在纸上列出时间线，把每个跨进程交互、每段工作、每次状态变化写成一行。
- 用 `processes` + `fork` / `spawn` 表示进程诞生。诞生前的泳道会自动画成灰色斜纹，校验器也会检查诞生前不能有活动。
- 子流程可以复用：`include(at, 'first-frame', {$main: 'xxx', ...})`。片段在 `flows/fragments.ts` 注册。

### Step 3：注册到校验器

在 `flows/index.ts` 的 `ALL_SCRIPTS` 里加上新脚本。启动 Studio 后控制台会显示校验结果。

### Step 4：写场景 `videos/<视频>/scenes.tsx`

最常见的布局（**泳道 + 右侧信息栏 + 底部字幕**）可以直接参考 `videos/app-launch/scenes.tsx` 里的 `LaunchOverviewScene`。

可复用的场景工厂：

| 工厂 | 位置 | 用途 |
|---|---|---|
| `makeMapScene(cfg)` | `layouts/MapStory.tsx` | 进程框依次出现 + 连线逐条画出 |
| `makeClassMapScene(map, story, subtitle)` | `videos/key-classes/scenes.tsx` | 类图逐组点亮 |
| `makeClassFlowScene(script, story)` | `videos/key-classes/scenes.tsx` | 类级时序 + 类详情 |

> 如果多个视频都要用后两个工厂，建议移到 `layouts/` 下。

片头片尾用 `TitleCard` / `SummaryCard`（`views/Cards.tsx`）。

### Step 5：写场景列表 `videos/<视频>/index.ts`

```ts
import {storySeconds} from '../../engine/camera';
import {FPS} from '../../theme';
import type {SceneEntry} from '../frame-lifecycle';

const f = (s: number) => Math.round(s * FPS);

export const SERVICE_SCENES: SceneEntry[] = [
  {id: 'Title', Component: ServiceTitleScene, frames: f(4)},
  {id: 'Overview', Component: ServiceOverviewScene, frames: f(storySeconds(serviceStartStory.steps) + 0.5)},
  {id: 'Ending', Component: ServiceEndingScene, frames: f(8)},
];
```

时长规则：分镜驱动的场景用 `storySeconds(steps) + 0.5`；固定内容的场景直接写秒数。

### Step 6：注册视频 `Root.tsx`

```ts
import {SERVICE_SCENES} from './videos/service';

const VIDEOS = [
  // …
  {id: 'ServiceStart', prefix: 'Service', scenes: SERVICE_SCENES},
];
```

`id` 和 `prefix` 只能包含字母、数字、`-`。`package.json` 里可以加一条渲染命令：

```json
"render:service": "remotion render src/index.ts ServiceStart out/service.mp4"
```

### 新视频检查清单

- [ ] `npm run check` 退出码 0（脚本 / 停点 / 节奏三套校验；字幕超 3 行、镜头短过旁白都在这里拦）
- [ ] 每个镜头停留时没有冻结在半截动画上（见 [6.2](#62-节奏与动画)）
- [ ]（只在要出带旁白版本时）`npm run narrate -- --match <流程>` 合成完，`npm run check:tts` 无 error
- [ ] 示意数据在标题或字幕里注明“示意”
- [ ] CodeRef 的行号已核对；未核对的不写行号
- [ ] `npm run still` 抽几帧检查有没有重叠
- [ ] 渲染后 `npm run qa` 退出码 0（时长 / 分辨率 / 黑帧 / 音量）

---

## 5. 怎么添加一类东西

### 5.1 组件（全景图 / 泳道关联用）

文件：`catalog/render.ts`、`system.ts`、`boot.ts`，也可以新建文件，再到 `catalog/index.ts` 合并进 `COMPONENTS`。

```ts
{
  id: 'input-monitor',             // 全局唯一
  short: 'InputMonitor',
  label: 'InputMonitor · 输入窗口信息',  // 全景图上显示的文字
  process: 'system_server',        // 必须是 processes.ts 里的 id
  role: '把窗口的输入信息同步给 InputDispatcher',
  never: '…',                      // 可选：绝不做什么
  src: 'wm/InputMonitor.java',
}
```

### 5.2 进程坑位（全景图上的位置）

文件：`catalog/processes.ts`。坑位是**全局固定**的，所有视频共用，所以加新坑位前先看画布上的空位。

```ts
{id: 'kernel', label: 'Linux Kernel', layer: 'kernel', box: {x: 700, y: 610, w: 440, h: 120}},
```

`layer` 决定颜色（`theme.ts` 的 `layerColors`），可选值：`hw` / `kernel` / `native` / `system_server` / `systemui` / `app`。

### 5.3 状态机

文件：`catalog/statemachines.ts`。

```ts
{
  id: 'service-record',
  title: 'ServiceRecord（示意）',
  states: ['NEW', 'CREATING', 'STARTED', 'DESTROYED'],
  size: {w: 720, h: 240},                    // StateView 的 viewBox 尺寸
  layout: {NEW: {x: 100, y: 120}, CREATING: {x: 300, y: 120}, /* … */},  // 节点中心坐标
  edges: [
    {from: 'NEW', to: 'CREATING', via: 'bringUpServiceLocked', code: 'am/ActiveServices.java'},
    // …
  ],
}
```

使用方式：

- 在脚本里声明对象：`objects: [{id: 'svc', label: '…', stateMachine: 'service-record'}]`
- 用事件驱动状态变化：`state(at, 'svc', 'CREATING')`
- 展示：`<StateView machine="service-record" current=… prev=… />` 或 `<ObjectBoard />`

校验器会检查每次迁移都是 `edges` 里存在的边。

### 5.4 资源池（令牌类资源）

文件：`catalog/pools.ts`。适合“有状态、会在泳道之间流动”的东西，例如 buffer、KeyEvent、binder 线程。

```ts
{
  id: 'binder-threads',
  title: 'system_server binder 线程池',
  stateMachine: 'binder-thread',      // 资源的状态机
  freeState: 'IDLE',                  // 空闲状态（不计入“在用”）
  quotas: [{state: 'BUSY', param: 'maxThreads'}],  // 配额：参数名在脚本 pool.params 里给值
  onExhausted: {wait: '等待空闲线程'},
}
```

在脚本中使用：

```ts
pool: {def: 'binder-threads', params: {maxThreads: 4}},
resources: [{id: 'T1', label: '1'}, …],
events: [res('T1', 10, 'BUSY', 'ss:binder'), …]
```

资源颜色在 `theme.ts` 的 `RESOURCE_PALETTE` 里加；状态色在 `stateColors` 里加。

### 5.5 时钟配置

文件：`catalog/clocks.ts`。`appWork` / `sfWork` 为 `null` 表示随周期缩放（对应 sysprop 为 -1 的默认值）。

```ts
{id: 'default-90', label: '90Hz · 默认 -1', refreshHz: 90, appWork: null, sfWork: null},
```

脚本里写 `clockProfile: 'default-90'`，VSYNC 刻度和唤醒点会自动生成，`FormulaView` 也能直接用。

### 5.6 手机画面

文件：`catalog/screens.ts`，渲染逻辑在 `views/ScreenView.tsx` 的 `renderScreen`。

- **复用已有 kind**：在 `SCREENS` 里加一项即可。已有的 kind：`grid` / `list` / `opening` / `closing` / `splash` / `black` / `logo` / `bootanim`。
- **新增 kind**：先在 `catalog/types.ts` 的 `ScreenDef.kind` 里加上，再在 `renderScreen` 的 `switch` 里加一个分支。

脚本里用 `screen(at, 'id')` 切换画面。需要三键导航栏时，给 `<ScreenView navBar />` 加上 `navBar`。

### 5.7 关键类 / 类关系

文件：`catalog/classes.ts`。

```ts
C('input-monitor', 'InputMonitor', 'wms', 'controller', 'wm/InputMonitor.java',
  '把窗口的输入信息（InputWindowHandle）同步给 InputDispatcher',
  ['updateInputWindowsLw'], ['mDisplayContent'], '可选：版本差异说明'),

R('display-content', 'owns', 'input-monitor', 'mInputMonitor'),
```

关系类型及画法：

| 类型 | 含义 | 画法 |
|---|---|---|
| `extends` | 继承 | 空心三角 |
| `owns` | 持有（组合） | 菱形起点 |
| `holds` | 引用 | 箭头 |
| `creates` | 创建 | 绿色虚线 |
| `binder` | 跨进程 | 蓝色虚线，始终显示标签 |
| `mirror` | 一一对应 | 粉色点线 |
| `children` | 运行时子节点 | 橙色点线 |

**关系全局只写一次**，每张类图会自动筛出“两端都在图里”的关系。

### 5.8 类图

文件：`catalog/classmaps.ts`。画布尺寸 1840 × 740，卡片高 52，建议行距 70。

```ts
export const MY_MAP: ClassMapDef = {
  id: 'my-map', title: '…', cardW: 210,
  regions: [{label: 'system_server', x: 10, y: 20, w: 1820, h: 700, color: '#f59e0b'}],
  classes: [{id: 'wms', x: 40, y: 80}, {id: 'session', x: 40, y: 150}],  // 左上角坐标
  extraRelations: [],     // 只在这张图成立的关系
  hide: ['wms>window-state'],                    // 隐藏某条全局关系
  vias: {'a>b': [[x1, y1], [x2, y2]]},           // 跨列连线的手工拐点
};
```

**连线自动规则**（不写 `vias` 时）：

| 情况 | 画法 |
|---|---|
| 同一列（x 相同）且相邻（`|dy| ≤ 卡片高 + 60`） | 竖直直线 |
| 同一列但不相邻 | 走卡片左侧 10px 的“脊线”。同一个父类的多条关系会合成一棵树 |
| 其他情况 | 两张卡片边框之间连直线 |

**排版建议**：同一模块的类竖着放成一列，持有者放在顶部，这样基本不用写拐点。只有跨列、并且会穿过其他卡片的线才需要写 `vias`。

### 5.8.1 实例（对象协作图用）

脚本里用 `instances` 声明"活"的对象，泳道用 `inst` 指向实例（类级脚本里泳道 id 与实例 id 相同即可）：

```ts
instances: [
  {id: 'atms', cls: 'atms', process: 'system_server', fields: {mTaskSupervisor: 'supervisor'}},
  {id: 'ar', cls: 'activity-record', process: 'system_server', label: 'com.foo'},
],
lanes: [...].map((l) => ({...l, inst: l.id})),
events: [newInst(20, 'starter', 'ar'), set(89, 'ar', 'app', 'wpc'), state(95, 'ar', 'RESUMED')],
```

- `group` 可选：同进程内按 group 分列（不写则按类的 owner 分列，如 ATMS / WMS / AMS / PMS）。
- 没有 `new` 事件的实例随进程诞生；有的在 `new` 时刻出现（之前画成虚框）。
- 类在目录里声明了 `stateMachine`（ActivityRecord / ProcessRecord / WindowStateAnimator），实例就能直接被 `state` 驱动，`ObjectBoard` 自动收录，不必再写 `objects`。
- 卡片字段行 = 脚本里赋值过的字段 + 类目录 `fields` 里的其余成员（`fieldsOf` 把 `'mFoo: Bar'` 拆成结构化成员，并按关系 label / 类型名解析指向的类）。
- 校验器会检查：实例的类 / 进程存在、创建前不能被调用或赋值、不能重复 new。
- **停点**：协作图展示"此刻"，分镜应停在调用栈最深处，而不是一段调用结束之后（见 `startActivityGraphStory`）。

### 5.9 DSL 原语（新增一种事件）

以新增 `xxx` 事件为例，按顺序改：

1. **`dsl/types.ts`**：定义 `XxxEvent` 类型，并加入 `FlowEvent` 联合类型。
2. **`dsl/builders.ts`**：加一个简写函数。
3. **`dsl/validate.ts`**：检查它引用的泳道、对象是否存在。
4. **视图**：在需要展示它的视图里，用 `eventsOf(script, 'xxx')` 取出事件并绘制。
5. **时间字段平移**：如果新事件有新的时间字段，要加到 `engine/resolve.ts` 的 `TIME_KEYS`，否则 include 展开时不会平移；泳道字段同理，加到 `LANE_KEYS`。

**新增箭头样式**：在 `SwimlaneView.tsx` 的 `ArrowKind` 和 `ARROW_STYLES` 里加一项，再在 `arrows` 数组里做映射。`ArrowLegend` 会自动认识新样式。

### 5.10 视图

在 `views/` 下新建组件即可，约定如下：

- **入参**：通常是 `script` + `t` + 尺寸，状态统一用 `engine/state.ts` 里的函数求值，不要在视图里重复写时间逻辑。
- **坐标**：用 SVG 时，传入 `width` / `height`，坐标系从 0 开始。需要缩放的视图（如 StateView）用 `viewBox`。
- **SVG id**：`<defs>` 里的 id 要带 `script.id` 或其他前缀，避免同一画面里出现两个视图时 id 冲突。

### 5.11 子流程片段

在 `flows/render/xxx.ts` 定义 `Fragment`：时间从 0 开始，泳道用 `$main`、`$rt` 这类占位符。然后在 `flows/fragments.ts` 注册。

主脚本里引用：

```ts
include(384, 'first-frame', {$main: 'foo:main', $rt: 'foo:rt', $wms: 'ss:binder', $sf: 'sf'})
```

并用 `resolveIncludes(script, FRAGMENTS)` 包住整个脚本（参考 `flows/system/appLaunch.ts`）。

---

## 6. 怎么调整

### 6.1 内容与字幕

| 想改 | 改哪里 |
|---|---|
| 字幕、源码面板 | 分镜 `steps[i].caption` / `code` |
| 某一段工作的标签或时长 | 脚本里对应的 `span(...)` |
| 跨进程调用的名字或时刻 | `call` / `oneway` / `invoke` / `msg` 等事件 |
| 片头、片尾文字 | `videos/*/scenes.tsx` 里的 `TitleCard` / `SummaryCard` |
| 场景顺序或删掉某个场景 | `videos/*/index.ts` 的 `XXX_SCENES` 数组 |

字幕超过 3 行会溢出。字幕框高 160px、字号 29。要么缩短文字，要么调整 `Caption` 的 `height` 和 `fontSize`。

### 6.2 节奏与动画

| 想改 | 改哪里 |
|---|---|
| 某个镜头更快或更慢 | `step.move`（移动秒数）/ `step.hold`（停留秒数） |
| 整个场景的时长 | 自动等于 `storySeconds(steps)`，改 `move` / `hold` 即可 |
| 令牌移动、消息箭头的动画时长 | `engine/text.ts` 的 `TOKEN_ANIM_MS`（0.6）/ `MSG_ANIM_MS`（0.5） |
| 秒级 / 步级流程的箭头出现速度 | `<SwimlaneView animMs={...} />`，一般设为 `视窗宽度 × 0.004 ~ 0.006` |
| 树节点的移动动画 | `views/DualTreeView.tsx` 的 `TREE_ANIM_MS`（1.5） |

> ⚠️ **停点规则**
>
> 动画进度由**模拟时间**决定。如果镜头停在某个事件之后不足动画时长的位置，画面会**冻结在动画中途**。所以：
> - 资源迁移后，停点至少要晚 `TOKEN_ANIM_MS`（0.6）。
> - 树操作后，停点至少要晚 1.5，建议晚 2。
> - 箭头事件后，停点至少要晚 `animMs`。

### 6.3 镜头缩放（长流程）

- **缩放**：在 `Step` 上写 `view: [起, 止]`；不写则沿用上一步。场景要给 `StoryScene` 传 `defaultView={script.window}`，并把 `view` 传给 `SwimlaneView`。
- **VSYNC 刻度**：当视窗宽度不超过 30 个刷新周期时自动出现，放大到某一帧附近就能看到。
- **长流程标签收敛**：给 `<SwimlaneView labelRecent={视窗宽度 × 0.3} />`，只给最近发生的箭头显示文字，其余的变淡、不显示标签。
- **章节条**：给 `<ChapterBar view={v} />` 传入当前视窗，会显示虚线镜头框。

- **边界标签**：marker / 事件标签会限制在时间窗左右边界内；调整 label 文案时仍要渲染最左、最右停点确认不裁字。

### 6.4 画面布局

- **整体尺寸**：画布 1920 × 1080。各场景的 `Panel` 都是绝对定位（`x` / `y` / `w` / `h`），直接改数字即可。
- **常用布局**：

| 布局 | 坐标 |
|---|---|
| 左侧主视图 | `Panel x=40 y=96 w=1300 h=736` |
| 右侧信息栏 | `x=1370 w=510` |
| 图例 | `y≈844` |
| 字幕 | `top=884 h=160` |
| 全宽主视图（类图 / 管线） | `Panel x=40 y=92 w=1840 h=540~740` |

- **泳道太挤**：泳道高度 = `(面板高 - 44) / 泳道数`。低于 60px 时会自动进入紧凑模式：隐藏副标题、缩小标注。可以减少泳道、合并泳道，或者加大面板高度。
- **分屏对比**：参考 `videos/frame-lifecycle/scenes.tsx` 的 `CompareScene`。两个 `SwimlaneView` 都加 `compact`，共用同一份分镜。

### 6.4.1 模板：按流程性质选展示形式

不同性质的流程用不同的主视图，不再一律"泳道 + 双树"。**脚本写 `kind`，场景只要一行**：

```ts
// flows/am/serviceStart.ts
export const serviceAnrScript: FlowScript = {id: 'service-anr', kind: 'state', /* … */};
// videos/service-anr/scenes.tsx
export const ServiceStateScene = makeTemplateScene({script: serviceAnrScript, story: serviceAnrStateStory});
```

#### 有哪些模板（`layouts/templates.ts` 的 `TEMPLATES`）

| kind | 模板 | 适用 | 主视图要回答的问题 | 默认布局 / 槽位 | 现有例子 |
|---|---|---|---|---|---|
| `call-chain` | 调用链型 | startActivity、addWindow、bindService | 此刻谁在调谁、栈多深、对象怎么引用 | `graph`：协作图 + 调用栈 + 源码 | `Classes-StartActivityGraph` `Classes-AddWindowGraph` |
| `pipeline` | 流水线 / 周期型 | 一帧渲染、输入分发 | 令牌走到哪一段、离下一个 VSYNC 多久 | `wide`：Pipeline + 资源状态机 + VSYNC 条 + 源码 | `Frame-Pipeline` |
| `structure` | 结构变化型 | Home 键、多窗口、Task 切换 | 谁在栈顶、焦点在哪个窗口 | `stage`：Task 栈 + 对象 + 手机 + 源码 | `Home-Story` |
| `mapping` | 映射型 | WMS 容器层 ↔ SF Layer | 两边节点怎样一一对应 | `stage`：双树 + 对象 + 手机 + 源码 | `Frame-Tree` `Launch-Tree` |
| `state` | 状态驱动型 | Activity 生命周期、Service ANR | 现在什么状态、谁推的、离超时多久 | `stage`：状态机舞台 + 倒计时 + 对象 + 源码 | `Service-State` |
| `phase` | 阶段型 | 开机 | 在哪一章、哪些服务就绪 | `phase`：章节条 + 服务网格 + 手机 + 属性 + 源码 | `Boot-Grid` `Boot-Overview` |
| `process` | 进程交互型 | 冷启动的进程视角、binder 往返 | 涉及哪些进程、按什么顺序调用、谁在阻塞 | `timeline`：进程时序图 + 手机 + 对象 + 章节条 + 源码 | `Launch-Process` |
| `lifecycle` | 生命周期型 | 冷启动 / Home / 返回里两个 Activity 的交接 | 每个 Activity 走到哪个回调、服务端状态、谁可见谁有焦点 | `stage`：生命周期 + Task 栈 + 手机 + 源码 | `Launch-Lifecycle` |
| `view-tree` | 视图树型 | 事件在 View 树里的分发、点击后的重新布局 | 事件走到哪个 View、标志位怎么变、怎么冒泡到 ViewRootImpl、下一帧怎么遍历 | `graph`：View 树 + 调用栈 + 源码 | `Input-ViewTree` |
| `dumpsys` | dumpsys 视角 | 流程前后系统状态 | 每一步之后 dump 出来的东西变了哪些 | `full`：四个 dumpsys 面板 | `Launch-Dumpsys` |
| `compare` | 对比 / bug 还原 | 双缓冲 vs 三缓冲、正常 vs ANR | 从哪一刻开始不同、不同在哪 | `split`：A 泳道 / B 泳道 + 各自侧格 + 差异 | `Frame-Compare` `Service-Compare` |
| `timeline` | 时序型（默认） | 冷启动全链路、跨进程并发 | 跨进程谁先谁后、谁在等谁 | `timeline`：泳道 + 右侧四格 | `Launch-Overview` |

`templateFor(script)` 会按脚本数据微调默认槽位：没有手机画面就换成类详情；没有实例就不放调用栈；状态驱动模板自动选挂了计时器的对象。

#### 怎么用

1. **选 kind**：先问"这段流程最想让人看懂什么"，按上表选；写在脚本上（`kind: 'state'`）。
2. **写场景**：`makeTemplateScene({script, story})`。需要时：
   - `kind`：临时换模板（同一份脚本既能当 `timeline` 又能当 `mapping`，见 `Launch-Tree`）；
   - `slots` / `layout`：整段覆盖默认槽位（如冷启动把 s3 换成 `queue:foo:main`）；
   - `compare`：对比模板的 B 脚本，槽位写 `b:xxx` 用 B；两边共用时间轴，自动画"首次分歧"线；
   - `options`：视图配置，如 `{pipeline: FRAME_PIPELINE}`、`{taskStack: {bind}}`；
   - `arrowKinds`：泳道主视图的箭头图例种类。
3. **分镜里中途换模板**：Step 上写 `layout` / `slots`，不写就沿用上一步（见 `homeTemplateStory`：输入段用时序、换前台用 Task 栈、重绘再回时序）。
4. **按模板选停点**，然后看控制台的 `[story:…]` 停点检查。

#### 一份脚本、多个维度：冷启动（`flows/launch/`）

`coldLaunch.ts` 的泳道是**实例**（一个对象一条泳道，`lane.inst`），并带 `lane.process`，所以同一份数据可以按不同粒度看：

| 维度 | 场景 | 怎么从脚本里取数据 |
|---|---|---|
| ① 进程之间 | `Launch-Process` | `proc-seq`：按 `lane.process` 聚合，只保留跨进程的 call / oneway / socket / fork / batch，按顺序编号；左侧按 `chapters` 分组 |
| ② 进程里面 | `Launch-SystemServer` `Launch-Zygote` `Launch-AppProcess` | `graph:<进程 id 或集合名>`：协作图只画这个进程的对象，和它有跨进程往来的对象放进"其他进程"列；集合在 `COLD_LAUNCH_GRAPH_SETS` |
| ③ 用户层面 | `Launch-Lifecycle` | `lifecycle`：客户端生命周期对象（状态机 `activity-lifecycle`，状态名 = `ActivityLifecycleItem` 常量）+ 服务端 `ActivityRecord` + 窗口焦点（树节点 note）|
| ④ dumpsys | `Launch-Dumpsys` | `dumpsys`：`dump(at, section, key, value)` 事件；视图标出"上一步 → 本步"的新增 / 改值 / 消失，Δ 标出与启动前不同 |

分镜在 `stories.ts`，每个维度一份（② 有三份）；同一时刻在四个维度里看到的是同一件事。

#### 输入流程（`flows/input/`）

和冷启动同样的拆法：`inputFlow.ts`（建通道 + touch 点击 + 两次 ENTER）与 `imeKey.ts`（key + 输入法对照）都是实例级泳道，重复的链路由三个函数生成：`readerChain`（硬件 → InputReader → 监听链 → 入队）、`dispatchChain`（InputDispatcher 选窗口 → publish → 等 FINISHED，带 5s 超时计时）、`appChain`（Looper → InputStage 嵌套链 → finished）。

| 场景 | 主视图 | 看什么 |
|---|---|---|
| `Input-Overview` | `proc-seq` | 跨了哪些进程：内核 → system_server（inputflinger 在这里）→ com.foo → SurfaceFlinger，每个事件一来一回 |
| `Input-Channel` | `graph:channel` | addWindow 时 socketpair、Connection、客户端 fd 回传、窗口信息 / 焦点经 SurfaceFlinger 同步 |
| `Input-Reader` | `graph:reader` | EventHub → Mapper → UnwantedInteractionBlocker → PointerChoreographer → InputProcessor → InputFilter → InputDispatcher |
| `Input-Dispatch` | `dispatch-rules` | 分发标准：touch 逐窗口命中检测，key 两次策略拦截 + FocusResolver |
| `Input-App` | `graph:app` | 7 个 InputStage 的嵌套调用、Activity 先于 View 树拦截、finishInputEvent |
| `Input-ViewTree` | `view-tree` | 命中路径 / mFirstTouchTarget / mFocused，PRESSED / FORCE_LAYOUT / DIRTY，冒泡与下一帧遍历 |
| `Input-ImeOverview` `Input-ImeGraph` | `proc-seq` / `graph:ime` | 按键先经 app ↔ IME 的 InputChannel 给 IME，提交文字走 oneway binder |

视图配置（窗口命中表、View 树的根与触摸点、协作图集合）在 `flows/input/stories.ts`：`INPUT_DISPATCH_RULES`、`INPUT_VIEW_TREE`、`INPUT_GRAPH_SETS`。View 树视图的数据来自实例字段：`mParent`（树形）、`bounds`（界面框图）、`isPressed()` / `isFocused()` / `PFLAG_FORCE_LAYOUT` / `PFLAG_DIRTY`（标志位）、`mFirstTouchTarget` / `mFocused`（分发路径）。

#### 开机流程（`flows/boot/`）

`bootFull.ts` 同样是实例级泳道；服务网格 / boot phase 事件直接复用旧脚本 `flows/system/boot.ts`（时刻一致），所以「阶段」维度不用重写。

| 场景 | 主视图 | 看什么 |
|---|---|---|
| `Boot-Process` | `proc-seq` | Bootloader → Kernel → init → servicemanager / surfaceflinger / bootanimation / zygote → system_server → Launcher / SystemUI 的交接；servicemanager 是所有 addService 的汇聚点 |
| `Boot-Init` | `graph:init` | FirstStageMain → SetupSelinux → SecondStageMain（execv 自身）、Parser → ActionManager / ServiceList、触发器链、class_start、ctl.start 经 PropertyService 启动 disabled 服务 |
| `Boot-Zygote` | `graph:zygote` | app_process → AndroidRuntime（startVm / startReg）→ ZygoteInit.main → preload → ZygoteServer → forkSystemServer → runSelectLoop |
| `Boot-SystemServer` | `graph:system_server` | createSystemContext、SystemServiceManager.startService → onStart → publishBinderService、startBootPhase → onBootPhase、systemReady → startHomeOnAllDisplays → startSystemUi、performEnableScreen → finishBooting |
| `Boot-Phase` | `services` | 服务网格 + boot phase（旧版保留） |
| `Boot-Props` | `dumpsys` | getprop（init.svc.* / service.bootanim.exit / sys.boot_completed）、service list、ps -A、SurfaceFlinger --list 逐步变化 |

来源：init 与 init.rc 对照 AOSP main（`android.googlesource.com/platform/system/core`，本机没有该仓库）；其余对照本机 base / native。本机源码里 `startSystemUi` 在 `AMS.systemReady(...)` 返回后才调用，所以先 fork Launcher、再 fork SystemUI。

调用栈槽位也支持过滤：`callstack:<进程 id 或集合名>`，和 `graph:` 用同样的规则，避免其他进程里"永不返回"的调用（如 `ZygoteInit.main`）混进来。

#### 布局与槽位（`layouts/slots.tsx`）

布局：`timeline` · `stage` · `graph` · `wide` · `split`（main / sa / b / sb / s1）· `phase`（chapters / main / s1–s3）· `full`（只有 main）。

| 槽位 | 视图 | 槽位 | 视图 |
|---|---|---|---|
| `swimlane` | 时序泳道 | `graph` / `callstack` | 对象协作图 / 调用栈 |
| `pipeline` / `pool` / `res-state` | 流水线 / 资源池 / 当前资源的状态机 | `vsync` | 当前时刻前后 ~3 个周期的 VSYNC 条 |
| `task-stack` | Task 栈 | `tree` | WMS ↔ SF 双树 |
| `state-stage[:对象]` / `timers` | 状态机舞台 / 超时倒计时 | `state:<状态机>:<对象>` | 小号状态机 |
| `chapters` / `services` / `props` | 章节条 / 服务网格 / 属性 | `diff` | A/B 差异 |
| `dispatch-rules` | 分发标准（需要 `options.dispatchRules`） | `view-tree` | View 树（需要 `options.viewTree`） |
| `proc-seq` | 进程时序图 | `lifecycle` | 两个 Activity 的生命周期（需要 `options.lifecycle`） |
| `dumpsys` | dumpsys 面板 | `graph:<进程 / 集合>` | 按进程过滤的协作图（集合在 `options.graphSets`） |
| `objects` / `screen` / `code` / `class-info` / `queue:<泳道>` | 通用辅助 | `b:<任意>` | 用对比脚本 B 渲染 |

#### 停点规则（`stopIssues`，Root 启动时对所有模板场景自动检查）

| 主视图 | 规则 | 原因 |
|---|---|---|
| `graph` / `view-tree` | 停点处调用栈不能为空（第 1 步除外） | 协作图看"此刻"；停在一段调用全部返回之后画面是空的 |
| `task-stack` | reparent 之后 ≥ 3 | 换位动画时长 |
| `tree` | 树操作之后 ≥ 1.5 | 节点移动动画 |
| `pipeline` | 资源迁移之后 ≥ 0.6 | 令牌动画 |
| `state-stage` | 状态迁移之后 ≥ 时间窗 2% | 迁移箭头飞行（时长按窗宽比例） |
| `swimlane` | 箭头事件之后 ≥ animMs | 箭头绘制 |
| `proc-seq` | 最后一行交互之后 ≥ 全窗口宽 × 0.6% | 行的绘制 |

同一份脚本换模板时停点通常要重选（例：`startActivityGraphStory` 字幕沿用、停点改到调用栈最深处）。把泳道版停点直接用于协作图，检查会报出第 5 / 6 / 8 步。

#### 状态驱动 / 对比模板需要的原语

- `timeout(id, at, duration, lane, label, {object, cancelAt})`：超时计时器。`cancelAt` 早于到期即"已取消"，否则到期"已超时"。`TimerView` 和 `StateStageView` 的倒计时环都读它。
- `state(at, object, to, by?)`：`by` 指明是哪条泳道推动了这次迁移（状态机舞台上箭头从它飞出）；不写则取当时正在执行的泳道。
- 对比的差异按"事件签名"（类型 + 泳道 + 文字，不含时间）配对：只在一边出现 = 仅 A / 仅 B；两边都有但时刻差 > 窗宽 0.2% = 时刻不同；计时器按状态对比。时间窗开始前的事件视为初始布置，不计入。

### 6.5 全景图（MapView）连线对不齐

组件在进程框里的位置是**自动堆叠**出来的，计算规则如下：

| 进程框 | 堆叠方式 | 计算 |
|---|---|---|
| 框高 ≥ 160 | 竖排 | `h = min(64, (框高 - 60)/n - 12)`，`y = 框.y + 52 + i·(h + 12)`，`x = 框.x + 30`，`w = 框.w - 60` |
| 框高 < 160 | 横排 | `w = (框宽 - 60 - 12(n-1))/n`，`y = 框.y + 46`，`h = 框高 - 64` |

`edges[i].via` 里的拐点是按这个规则手算的。**修改组件列表或顺序后，拐点要同步调整**；`labelAt` 控制标签位置。

全景图按 `edges` 数组顺序自动编号：当前连线显示“序号 + 完整标签”，已出现的旧连线只保留低对比度序号。标签在线条绘制超过 92% 后才出现，避免动画中标签悬空。线多时优先调 `via` / `labelAt`，不要把多条完整标签同时铺在画布上。

> 调试小技巧：临时把 `MapView` 里的组件矩形坐标用 `console.log` 打印出来，再按坐标调拐点。

### 6.6 类图（ClassMapView）

- **位置**：改 `classmaps.ts` 里的 `x` / `y` / `w`。
- **连线**：线穿过卡片时，在 `vias` 里加拐点，或者用 `hide` 隐藏这条关系。
- **聚焦卡片**：卡片保持固定高度，只用描边和呼吸光强调当前类，避免展开方法后遮住邻接线；方法与职责放在右侧 `ClassInfoView`。
- **关系播放**：每个 `Step.activeRelationKey` 只高亮一条关系，其他已出现关系降为低对比度；`dimInactiveRelations` 可让总结镜头也保持降噪状态。

### 6.7 颜色、字体、分辨率

全部在 `theme.ts` 里改：

| 项 | 变量 |
|---|---|
| 基础色板 | `colors` |
| 进程层颜色 | `layerColors` |
| 资源颜色 | `RESOURCE_PALETTE` |
| slot / 对象状态颜色 | `stateColors` |
| 帧血缘色 | `FRAME_HUES` |
| 字体 | `font` / `mono` |
| 分辨率、帧率 | `WIDTH` / `HEIGHT` / `FPS` |

改分辨率后，各场景里写死的面板坐标需要按比例调整。

类图里的“归属颜色”在 `views/ClassMapView.tsx` 的 `OWNER_COLORS`；关系线样式在 `RELATION_STYLES`。

### 6.8 旁白与字幕

**默认不带旁白。** 打开开关（`REMOTION_NARRATION=1`）才会挂音轨、按音频时长回填 `hold`、字幕逐字点亮；
关着时 `clipFor()` 一律返回 undefined，三件事同时退回默片行为，`src/generated/narration.ts` 和 `public/narration/` 留着也不影响。

旁白本身是**离线预处理**出来的，渲染链路只消费静态产物（mp3 + 一张时长表），不破坏「视图是模拟时间 t 的纯函数」这条底线。

```
Step.caption ──speechText()洗掉①→·等装饰──▶ 本地 TTS ──▶ public/narration/<key>.mp3
                                                  │
                                   ffprobe 量时长 ─┴─▶ src/generated/narration.ts
                                                              │
            effectiveHold(step) = max(hold, 音频时长 + 0.5 − move) ◀┘
```

| 想做 | 怎么做 |
|---|---|
| 生成/更新旁白 | `npm run narrate`（已存在的音频跳过，`--force` 重做） |
| 只做某个流程 | `npm run narrate -- --match serviceStart`（正则匹配源码路径或故事名） |
| 先看要念什么 | `npm run narrate -- --dry` |
| 换引擎 / 音色 / 语速 | `--engine edge\|piper\|say`、`--voice <音色>`、`--rate <速率>`（见下表） |
| caption 里符号太多念着怪 | 在 `Step` 上写 `speak: '另一份口播稿'`，优先于 caption |
| 打开 / 关闭旁白 | 环境变量 `REMOTION_NARRATION=1`（`npm run dev:tts` / `render:service:tts` / `check:tts` 已经带上）；不设就是默片 |
| 清空旁白 | 删掉 `src/generated/narration.ts`（下次构建自动兜底成空表）和 `public/narration/` |

> **`src/generated/narration.ts` 与 `public/narration/*.mp3` 都不进仓**（后者 49 MB）。
> 缺少时 `scripts/ensure-generated.mjs` 会兜底生成一份空表 —— 空表 = 没有旁白 = 默片，构建不会断。
> 兜底挂在三处：`remotion.config.ts`（studio / render / still）、`scripts/bundle.mjs`（check / narrate）、`package.json` 的 `prepare`（`npm i`）。
> 克隆下来想要旁白：`npm run narrate` 重新合成即可。

- **时长回填**：`engine/narration.ts` 的 `effectiveHold` 被 `storySeconds` 与 `buildKeyframes` 共用，所以场景帧数与镜头关键帧永远一致；手写的 `hold` 只是下限。
- **音轨挂载**：`layouts/StoryScene.tsx` 为每个停点生成 `<Sequence from=停点起始帧><Audio/></Sequence>`，音频从镜头移动（move）就开始念。
- **字幕逐字点亮**：`views/Chrome.tsx` 的 `Caption` 查到该句有音频时逐字由暗转亮（当前字用 `colors.info`）；edge 引擎会带句边界 `marks`，按真实句子起点推进，否则按时长线性推；没有音频就退回整块淡入。
- **响度**：所有引擎的产物统一过 `highpass=80 → 2.5kHz +2.5dB → loudnorm I=-16:LRA=11:TP=-1.5 → 48kHz 单声道 mp3`，电平口径与 OpenMontage 的交付标准一致。

#### 语音引擎

默认优先级：**edge（装了 `.venv-tts` 就用）→ piper → say**。

| 引擎 | 音色 | 质量 | 联网 | 装法 |
|---|---|---|---|---|
| `edge`（默认，推荐） | `zh-CN-YunyangNeural`（新闻男声）、`XiaoxiaoNeural`（暖女声）、`YunxiNeural`（年轻男声）、`YunjianNeural`、`XiaoyiNeural` 等 8 个 | 神经网络，接近真人 | **合成时要联网**（渲染不用） | `uv venv --python 3.12 .venv-tts && uv pip install --python .venv-tts/bin/python edge-tts`；批量合成走 `scripts/edge_tts_batch.py`（asyncio 并发 + 自动重试 + 句边界） |
| `piper` | `zh_CN-huayan-medium`（唯一中文模型） | 中等，机械感明显 | 否（首次下模型要） | `pip install piper-tts`，`PIPER_MODEL` 或 `--voice` 指模型 |
| `say` | `Tingting` / `Sinji`(粤) / `Meijia`(台) | 差，明显机器音 | 否 | macOS 自带，零安装 |

想完全离线又要好音色，可换成这几个开源模型（都能在 M 系 Mac 跑，接法照 `--engine piper` 那条分支加一个子进程调用即可）：**Kokoro-82M**（Apache-2.0，`kokoro-onnx` + `misaki[zh]`，CPU 实时率高）、**CosyVoice2-0.5B**（阿里，Apache-2.0，支持音色克隆）、**IndexTTS-2** / **F5-TTS**（零样本克隆，质量最好但要 torch + 几 GB 模型）。

---

## 7. 校验器

三套校验。Studio 启动时只打印到浏览器控制台（不阻断），**`npm run check` 才是门**：有 error 退出码 1，适合挂在提交前 / CI。

| 校验 | 文件 | 级别 |
|---|---|---|
| 脚本（引用完整性、时序合法性） | `dsl/validate.ts` 的 `validateScript` | error |
| 停点（动画有没有冻在半截） | `layouts/validateStory.ts` 的 `validateStory` | warn |
| 节奏 / 文字密度 / 幻灯片感 | `dsl/validatePacing.ts` 的 `validatePacing` | error + warn |

节奏校验的阈值都在 `PACING`（借 OpenMontage `styles/minimalist-diagram.yaml` 的 `pacing_rules`，按中文调保守）：

| 判据 | 阈值 | 级别 |
|---|---|---|
| caption 估算行数（按 `engine/text.ts` 的字宽启发式） | > 3 行溢出字幕框 | error |
| 停点时长（`move + effectiveHold`） | < 2.5s 看不清 / > 26s 该拆 | warn |
| 阅读速率（默片时） | > 7 阅读单位/秒读不完。单位 = 中文一字一个、连续拉丁标识符每 4 字符一个（`readingUnits`，避免 `bumpServiceExecutingLocked` 被按 26 字算） | warn |
| 旁白被截断（开了旁白时） | 镜头时长 < 音频时长 | error |
| 画面空转 | 停点 > 6s 且 < 1 阅读单位/秒 | warn |
| 幻灯片感 | 连续 3 步结构 / 模拟时刻 / 镜头都没变 | warn |

警告默认按类聚合，每类只列前 5 条；`npm run check -- --verbose` 打全部，`--warn-as-error` 把警告也当门禁。

`validateScript` 的检查项：

| 类别 | 检查内容 |
|---|---|
| 泳道 | 事件引用的泳道必须存在；泳道的 `process` 必须在 `processes` 里；泳道的 `cls` 必须在类目录里 |
| 进程 | 进程诞生（`fork` / `spawn` / `bornAt`）之前，它的泳道上不能有 span |
| 资源 | 状态迁移必须是状态机里的合法边；不能超过配额（会计入 `allowExtra`）；资源进入 ACQUIRED 时，它的 acquire fence 必须已经 signal |
| 信号 | `check` 引用的 signal 必须存在 |
| 调用 | `call` / `invoke` 的返回不能早于调用；`post` 的取出不能早于投递；`fork` 的子进程必须声明 |
| 树 | 操作的节点、reparent 的父节点必须存在 |
| 对象 | 状态必须在状态机里；迁移必须合法 |
| 其他 | service 分组必须存在；boot phase 只能递增；include 必须已经展开 |

**用来还原 bug**：可以故意违反某条规则，构造一个“错误版本”的脚本，再和正确版本分屏对比。例如：
- 把 setBuffer 和几何拆成两个事务
- 让 latch 发生在 fence signal 之前

---

## 8. 常见问题

**Module not found**
文件缺失或路径不对。确认文件在 `src/` 对应目录下，扩展名是 `.ts` / `.tsx`；旧目录 `src/components`、`src/scripts`、`src/scenes` 应该已经删除。

**Studio 还显示旧报错**
`Ctrl+C` 停掉后重新执行 `npm run dev`。

**中文显示成方块**
缺中文字体，Linux 下执行 `sudo apt install fonts-noto-cjk`。

**画面冻结在半截动画**
停点离事件太近，见 [6.2 停点规则](#62-节奏与动画)。

**标签互相重叠**
可以依次尝试：
1. 缩短标签文字。
2. 放大镜头（`view`）。
3. 设置 `labelRecent`。
4. 把事件时间稍微错开。
5. 加大面板高度。

**两个视图同屏时样式错乱**
SVG `<defs>` 里的 id 冲突了。给 marker / pattern 的 id 加上 `script.id` 前缀。

**类图连线穿过卡片**
调整卡片位置，让它们同列排布；或者写 `vias` 拐点；或者用 `hide` 隐藏这条关系。

**渲染很慢**
先用 `npm run still` 或单场景 composition 调试。完整渲染时可以加 `--concurrency` 参数（见 Remotion 文档）。

---

## 9. 参考

### 9.1 DSL 原语（`dsl/builders.ts`）

| 简写 | 事件 | 说明 / 视觉 |
|---|---|---|
| `span(lane, start, end, label, style, {resource?, frame?})` | span | 泳道上的一段工作。`style` 可选 `cpu` / `gpu` / `sf` / `wait` / `display` |
| `msg(at, from, to, label)` | message | 普通消息 / 回调（白色实线） |
| `call(at, from, to, method, returnAt?)` | call | 同步 binder（蓝色实线 + 调用方阻塞条 + 返回虚线） |
| `oneway(at, from, to, method)` | oneway | oneway binder（空心箭头虚线） |
| `invoke(at, from, to, method, returnAt?)` | invoke | 进程内方法调用（浅灰实线），用于类级时序 |
| `socket(at, from, to, label)` | socket | socket（双线），如 Zygote、InputChannel |
| `fork(at, from, to, process, label?)` | fork | fork 子进程（粉色粗线），子进程泳道从此“诞生” |
| `spawn(at, from, to, process, label?)` | fork(exec) | init 拉起服务（绿色虚线粗线） |
| `post(at, from, to, msg, handledAt)` | post | Handler 消息：紫色点线表示排队，◆ 表示被取出 |
| `batch(at, from, to, label)` | batch | SurfaceControl.Transaction（橙色虚线 + 信封图标） |
| `res(id, at, state, owner)` | resource | 资源状态迁移，令牌在泳道 / 阶段之间移动 |
| `sig(id, kind, resource, createdAt, signaledAt?)` | signal | fence：🚩 红色表示 acquire 未 signal，黄色表示 release 未 signal |
| `check(at, lane, signal, label)` | check | 消费方检查 fence，引擎自动标 ✓ / ✗ |
| `mark(at, lane, label, tone)` | marker | 标注气泡。`tone` 可选 `ok` / `warn` / `bad` / `info` |
| `jank(at, lane, label)` | jank | 卡顿 / 重复帧（ScreenView 会抖动并显示徽标） |
| `state(at, object, to, by?)` | state | 对象状态迁移；`by` = 推动迁移的泳道（状态机舞台用） |
| `node / reparent / remove / attr(...)` | tree | 树操作（DualTreeView） |
| `screen(at, id)` | screen | 切换手机画面 |
| `input(at, lane, kind, label, target?)` | input | 用户输入（`target: 'nav-home'` 时导航栏 Home 键会高亮） |
| `service(at, name, group, end?)` | service | 服务启动 / 就绪（ServiceGrid） |
| `phase(at, value, label, lane?)` | phase | 启动阶段（ServiceGrid 底部） |
| `prop(at, lane, key, value)` | prop | 系统属性变化（PropBoard） |
| `include(at, fragment, lanes)` | include | 引用子流程片段（需要 `resolveIncludes`） |
| `dump(at, section, key, value)` | dump | dumpsys 快照的一行；`value = null` 表示这一行消失（DumpsysView） |
| `timeout(id, at, duration, lane, label, {object?, cancelAt?})` | timeout | 超时计时器（ANR 等）：倒计时环 / 进度条，取消或到期 |
| `newInst(at, by, inst, field?)` | new | `by` 实例 new 出 `inst`；带 `field` 时同时赋值 `by.field = inst`（InstanceGraphView 绿色虚线） |
| `set(at, inst, field, value)` | set | 实例字段赋值；`value` 是实例 id 时画成引用线，否则显示文字 |

### 9.2 视图

| 视图 | 主要 props | 用途 |
|---|---|---|
| `SwimlaneView` | `script t width height frame focus? compact? view? labelRecent? animMs?` | 时序主视图 |
| `PipelineView` | `script t config width height frame focus?` | 阶段 + 流向（`config` 见 `PipelineConfig`） |
| `ResourcePoolView` | `script t focus? compact?` | 资源池状态板 |
| `StateView` | `machine current prev width height title?` | 状态机图 |
| `ObjectBoard` | `script t within?` | 所有对象的当前状态 |
| `DualTreeView` | `script t width height frame` | 两棵树 + 一一对应线 |
| `ScreenView` | `script t width height frame navBar?` | 手机画面 |
| `MessageQueueView` | `script lane t` | 某线程的 Looper 队列 |
| `MapView` | `components edges sec active?` | 全景图（通常经 `makeMapScene` 使用） |
| `ClassMapView` | `map visible focus fresh local frame width height` | 类图 |
| `ClassInfoView` | `id` | 类详情 |
| `InstanceGraphView` | `script t width height frame focus? view? animMs? pulse? only?` | 对象协作图：实例卡片（字段值 / 状态 / 正在执行）+ 调用动画，按进程 / owner 自动分列 |
| `CallStackView` | `script t` | 未返回的同步调用（按嵌套缩进）+ MessageQueue 排队 |
| `ProcessSequenceView` | `script t width height frame` | 进程时序图：一列一个进程，只画跨进程交互 |
| `LifecycleView` | `script t width height frame config` | 两个 Activity 的回调阶梯 + 服务端状态 + 可见 / 前台 / 焦点 + 先后顺序轴 |
| `DumpsysView` | `script t width height since?` | dumpsys 面板，标出 since → t 的变化 |
| `DispatchRuleView` | `script t width height config` | 窗口命中 / 焦点规则逐行判定 |
| `ViewTreeView` | `script t width height frame config` | 界面框图 + View 树 + 上下行调用 |
| `StateStageView` | `script t width height frame object? view?` | 状态机居中，参与线程在四周，迁移从来源泳道飞入，倒计时环 |
| `TimerView` | `script t` | 所有超时计时器的进度 |
| `DiffView` | `a b t` | 两份脚本的差异 + 首次分歧时刻 |
| `TaskStackView` | `script t width height frame tree? container? bind?` | Task 栈：容器子节点按 Z 序叠放，reparent 时"抽出→置顶"动画；`bind` 把树节点绑到状态机对象，显示 Activity 状态 / mDrawState / 输入焦点 |
| `FormulaView` | `profiles maxDequeued sec` | 由 clock profile 推导 buffer 级数 |
| `ChapterBar` | `chapters range t view? width height unit?` | 章节条 |
| `ServiceGrid` | `script t width height frame` | 服务点亮网格 |
| `PropBoard` | `script t within?` | 属性面板 |
| `CodeView` | `code localSec` | 源码面板 |
| `Header` / `Panel` / `Caption` / `Legend` / `ArrowLegend` / `RelationLegend` | — | 画面框架与图例 |

### 9.3 路径缩写（CodeRef 用）

| 缩写 | 实际路径 |
|---|---|
| `view/` | `frameworks/base/core/java/android/view/` |
| `window/` | `frameworks/base/core/java/android/window/` |
| `app/` | `frameworks/base/core/java/android/app/` |
| `os/` | `frameworks/base/core/java/android/os/` |
| `internal-os/` | `frameworks/base/core/java/com/android/internal/os/` |
| `wm/` | `frameworks/base/services/core/java/com/android/server/wm/` |
| `am/` | `frameworks/base/services/core/java/com/android/server/am/` |
| `pm/` | `frameworks/base/services/core/java/com/android/server/pm/` |
| `server/` | `frameworks/base/services/java/com/android/server/` |
| `shell/` | `frameworks/base/libs/WindowManager/Shell/src/com/android/wm/shell/` |
| `hwui/` | `frameworks/base/libs/hwui/` |
| `gui/` | `frameworks/native/libs/gui/` |
| `sf/` | `frameworks/native/services/surfaceflinger/` |
| `sched/` | `frameworks/native/services/surfaceflinger/Scheduler/` |
| `ce/` | `frameworks/native/services/surfaceflinger/CompositionEngine/src/` |
| `init/` | `system/core/init/` |
| `rootdir/` | `system/core/rootdir/` |

---

## 后续规划

- [ ] 车机分支：CarSystemUI 的 Home 键、AAOS 开机（EVS / 早期音频 / CarService），需要 `branch` 原语和分屏布局
- [ ] Service 启动 / 绑定 / Service ANR 的类级时序
- [ ] Perfetto trace → DSL 转换器：用真实时间替换示意数字，作为 bug 还原的基础
- [x] TTS 配音：用 `caption` 生成语音，再按音频时长回填 `hold` —— 已落地，见 [6.8](#68-旁白与字幕)
- [ ] `@remotion/player` 嵌入文档站，提供可交互版本
````

几点补充：

- README 里的场景工厂位置（`makeClassMapScene` / `makeClassFlowScene` 在 `videos/key-classes/scenes.tsx`）与当前代码一致。如果后续把它们移到 `layouts/`，记得同步修改 4.4 节的表格。
- 第 6.5 节的堆叠公式直接对应 `MapView.tsx` 里 `layoutMap` 的实现。以后改了这个函数，也要同步更新 README。
- 需要的话，我可以再配一个 `CONTRIBUTING.md`，内容可以包括：写脚本的命名规范（泳道 id 用 `进程:线程` 格式、类 id 用 kebab-case）、提交前检查项、新视频的 PR 模板。
