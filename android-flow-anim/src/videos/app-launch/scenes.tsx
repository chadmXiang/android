import React from 'react';
import {appLaunchScript, launchStory, launchTreeStory} from '../../flows/system/appLaunch';
import {COLD_LAUNCH_GRAPH_SETS, COLD_LAUNCH_TASK_BIND, coldLaunchScript} from '../../flows/launch/coldLaunch';
import {appStory, dumpsysStory, lifecycleStory, processStory, systemServerStory, zygoteStory} from '../../flows/launch/stories';
import {makeMapScene} from '../../layouts/MapStory';
import {makeTemplateScene} from '../../layouts/TemplateScene';
import {colors} from '../../theme';
import {SummaryCard, TitleCard} from '../../views/Cards';

const BLUE = '#60a5fa';

export const LaunchTitleScene: React.FC = () => (
  <TitleCard
    kicker="AOSP · 从 Launcher 冷启动应用（示意时序，类名 / 方法名 / 字段名对照源码）"
    title="应用冷启动：四个维度"
    subtitle="① 进程之间 · ② 进程里面 · ③ 用户看到的前台切换 · ④ dumpsys 的变化"
    chips={['进程', '类', '生命周期', 'dumpsys']}
  />
);

// ─────────── 四个维度：同一份脚本 coldLaunchScript，换模板看 ───────────
const SUB = '同一份脚本 · 示意时序';

/** ① 进程维度：进程时序图，只看跨进程交互 */
export const LaunchProcessScene = makeTemplateScene({
  script: coldLaunchScript,
  story: processStory,
  title: '① 进程维度：谁和谁交互',
  subtitle: SUB,
});

const GRAPH = {options: {graphSets: COLD_LAUNCH_GRAPH_SETS}, kind: 'call-chain' as const};

/** ② 进入进程：按进程过滤的对象协作图 */
export const LaunchSystemServerScene = makeTemplateScene({
  ...GRAPH,
  script: coldLaunchScript,
  story: systemServerStory,
  title: '② 进入 system_server：新建了哪些对象',
  subtitle: SUB,
  slots: {main: 'graph:system_server', s1: 'callstack:system_server', s2: 'code'},
});
export const LaunchZygoteScene = makeTemplateScene({
  ...GRAPH,
  script: coldLaunchScript,
  story: zygoteStory,
  title: '② 进入 zygote：新进程的第一口气',
  subtitle: SUB,
  slots: {main: 'graph:zygote', s1: 'callstack:zygote', s2: 'code'},
});
export const LaunchAppProcessScene = makeTemplateScene({
  ...GRAPH,
  script: coldLaunchScript,
  story: appStory,
  title: '② 进入 com.foo：从 Application 到首帧',
  subtitle: SUB,
  slots: {main: 'graph:app', s1: 'callstack:app', s2: 'code'},
});

/** ③ 用户层面：两个 Activity 的生命周期交接 */
export const LaunchLifecycleScene = makeTemplateScene({
  script: coldLaunchScript,
  story: lifecycleStory,
  kind: 'lifecycle',
  title: '③ 用户层面：前台从 Launcher 换到 com.foo',
  subtitle: SUB,
  options: {
    taskStack: {bind: COLD_LAUNCH_TASK_BIND},
    lifecycle: {
      rows: [
        {title: 'Launcher', sub: 'com.android.launcher3 · 桌面', color: '#60a5fa', client: 'l-life', server: 'ar-l', windowNode: 'wm:ws-l', visibleUntil: 494},
        {title: 'com.foo', sub: 'MainActivity · 新进程', color: '#4ade80', client: 'f-life', server: 'ar', windowNode: 'wm:ws-f', visibleWhenDrawn: 'wsa'},
      ],
      milestones: ['首帧可见', '焦点窗口 → com.foo'],
    },
  },
});

/** ④ dumpsys 视角 */
export const LaunchDumpsysScene = makeTemplateScene({
  script: coldLaunchScript,
  story: dumpsysStory,
  kind: 'dumpsys',
  title: '④ dumpsys 视角：每一步变了什么',
  subtitle: SUB,
});

// 拐点坐标依赖 layoutMap 的堆叠结果；改组件顺序或进程坑位时需同步
export const LaunchMap = makeMapScene({
  title: '冷启动经过的进程',
  components: ['launcher', 'activity-thread', 'atms', 'ams', 'wms', 'zygote', 'sf-ce'],
  intro: 'Launcher、system_server（ATMS / AMS / WMS）、Zygote、新进程、SurfaceFlinger 五方参与一次冷启动。',
  outro: '一句话分工：ATMS 管调度与 Task，AMS 管进程，Zygote 管孵化，应用管首帧像素，WMS 管容器层与焦点。',
  legend: [
    {label: 'binder', color: BLUE},
    {label: 'Handler post / buffer', color: colors.orange},
    {label: 'socket', color: colors.lime},
    {label: 'fork', color: colors.pink},
  ],
  edges: [
    {
      from: 'launcher', to: 'atms', label: 'startActivity', color: BLUE,
      desc: 'Launcher 同步调用 IActivityTaskManager.startActivity，进入 system_server 的 binder 线程。',
    },
    {
      from: 'atms', to: 'ams', label: 'post startProcess', color: colors.orange,
      via: [[630, 219], [630, 266]], labelAt: [628, 188],
      desc: '目标进程不存在：ATMS 把 startProcess 异步 post 给 AMS 线程，不阻塞 binder 线程。',
    },
    {
      from: 'ams', to: 'zygote', label: 'socket：fork 请求', color: colors.lime,
      via: [[650, 266], [650, 684]], labelAt: [650, 630],
      desc: 'AMS 经 ZygoteProcess 走 socket 把 fork 参数发给 Zygote。',
    },
    {
      from: 'zygote', to: 'activity-thread', label: 'fork → ActivityThread.main', color: colors.pink, labelAt: [340, 530],
      desc: 'Zygote fork 出新进程，从 RuntimeInit 一路走到 ActivityThread.main。',
    },
    {
      from: 'activity-thread', to: 'ams', label: 'attachApplication', color: BLUE,
      via: [[630, 380], [1160, 380], [1160, 270]], labelAt: [850, 380],
      desc: '新进程同步调用 attachApplication，向 AMS 报到。',
    },
    {
      from: 'ams', to: 'activity-thread', label: 'oneway ×2', color: BLUE,
      via: [[700, 290], [700, 375]], labelAt: [700, 410],
      desc: 'AMS 回 bindApplication，ATMS 发 scheduleTransactionItems（Launch + Resume），都是 oneway。',
    },
    {
      from: 'activity-thread', to: 'wms', label: 'addWindow · relayout2 · finishDrawing', color: BLUE,
      via: [[620, 392], [620, 575], [1195, 575], [1195, 313]], labelAt: [905, 575],
      desc: '应用 addWindow 建 WindowState，首帧前走 relayout2（A17 新接口，关掉 use_client_surface 时仍是 relayout），画完发 oneway finishDrawing 通知 WMS。',
    },
    {
      from: 'activity-thread', to: 'sf-ce', label: 'setBuffer 事务（RenderThread）', color: colors.orange,
      via: [[640, 440], [1240, 440], [1240, 300]], labelAt: [940, 440],
      desc: 'RenderThread 画完 queueBuffer，BLASTBufferQueue 把 buffer 打成一个事务直接提交给 SurfaceFlinger——不经过 system_server。',
    },
    {
      from: 'wms', to: 'sf-ce', label: '容器层事务 · 可见性', color: colors.orange,
      desc: 'WMS 只发层级 / 几何 / 可见性命令：窗口画完后 performShowLocked 让容器层可见，并把输入焦点切到新窗口。',
    },
  ],
});

/** 时序模板：右侧四格换成 手机 / 对象 / 主线程 MessageQueue / 源码 */
export const LaunchOverviewScene = makeTemplateScene({
  script: appLaunchScript,
  story: launchStory,
  slots: {main: 'swimlane', s1: 'screen', s2: 'objects', s3: 'queue:foo:main', s4: 'code'},
});

/** 映射模板：WMS 容器层 ↔ SF Layer，冷启动里正好有"先建容器层、后有 buffer 层" */
export const LaunchTreeScene = makeTemplateScene({
  script: appLaunchScript,
  story: launchTreeStory,
  kind: 'mapping',
  title: '冷启动中的窗口层级',
  subtitle: 'WMS 容器树 ↔ SF Layer 树',
  slots: {main: 'tree', s1: 'state:draw-state:draw', s2: 'screen', s3: 'code'},
});

export const LaunchEndingScene: React.FC = () => (
  <SummaryCard
    heading="冷启动的四个维度"
    lines={[
      ['进程之间', 'Launcher 暂停与 fork 新进程并行；同步 binder 阻塞调用方，oneway 再 post 到主线程排队'],
      ['进程里面', 'system_server 建 ActivityRecord / Task / ProcessRecord / WindowState；应用建 LoadedApk → Application → Activity → PhoneWindow → DecorView → ViewRootImpl'],
      ['用户看到的', 'Launcher onPause → com.foo onCreate / onStart / onResume → 首帧可见 → 焦点切换 → Launcher onStop'],
      ['dumpsys 里', 'mFocusedApp 先切、mCurrentFocus 后切；mDrawState 走到 HAS_DRAWN；Launcher 降到 home'],
    ]}
  />
);
