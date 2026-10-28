import {attr, batch, call, fork, mark, node, oneway, post, reparent, screen, socket, span, state} from '../../dsl/builders';
import type {FlowScript, FlowStory} from '../../dsl/types';

/**
 * 应用冷启动（示意时序，非实测）
 * 八个阶段：① 点击 ② 暂停并行拉进程 ③ fork ④ attach ⑤ 生命周期 ⑥ addWindow ⑦ 首帧 ⑧ 可见与焦点
 * 类名 / 方法名已对照 Android 17（SDK 37）源码核对。
 */
export const appLaunchScript: FlowScript = {
  id: 'app-launch',
  kind: 'timeline',
  title: '应用冷启动',
  subtitle: '示意时序 · 调度 → 进程 → 生命周期 → 首帧 → 焦点',
  window: [-10, 580],
  clockProfile: 'default-60',
  vsyncLanes: {app: 'foo:main', sf: 'sf'},
  processes: [
    {id: 'launcher', label: 'Launcher', layer: 'app'},
    {id: 'system_server', label: 'system_server', layer: 'system_server'},
    {id: 'zygote', label: 'zygote64', layer: 'native'},
    {id: 'foo', label: 'com.foo', layer: 'app'},
    {id: 'sfp', label: 'surfaceflinger', layer: 'native'},
  ],
  lanes: [
    {id: 'l:main', label: 'Launcher · main', sub: 'Instrumentation', process: 'launcher', component: 'launcher', cls: 'instrumentation'},
    {id: 'ss:binder', label: 'system_server · binder', sub: 'ATMS / ActivityStarter / AMS', process: 'system_server', component: 'atms', cls: 'atms'},
    {id: 'ss:am', label: 'system_server · AM', sub: 'ProcessList', process: 'system_server', component: 'ams', cls: 'process-list'},
    {id: 'ss:wm', label: 'system_server · WM', sub: 'Session / WMS / WindowState', process: 'system_server', component: 'wms', cls: 'wms'},
    {id: 'zygote', label: 'Zygote', sub: 'ZygoteConnection', process: 'zygote', component: 'zygote'},
    {id: 'foo:binder', label: 'com.foo · binder', sub: 'ApplicationThread', process: 'foo', cls: 'application-thread'},
    {id: 'foo:main', label: 'com.foo · main', sub: 'ActivityThread / ViewRootImpl', process: 'foo', component: 'activity-thread', cls: 'activity-thread'},
    {id: 'foo:rt', label: 'com.foo · RenderThread', sub: 'ThreadedRenderer / BBQ', process: 'foo', component: 'hwui', cls: 'threaded-renderer'},
    {id: 'sf', label: 'SurfaceFlinger', sub: 'commit · composite', process: 'sfp', component: 'sf-ce'},
    {id: 'disp', label: '屏幕', component: 'hwc'},
  ],
  resources: [],
  objects: [
    {id: 'ar-launcher', label: 'ActivityRecord · Launcher', stateMachine: 'activity-record'},
    {id: 'ar-foo', label: 'ActivityRecord · com.foo', stateMachine: 'activity-record'},
    {id: 'proc', label: 'ProcessRecord · com.foo', stateMachine: 'app-process'},
    {id: 'draw', label: 'mDrawState · com.foo 窗口', stateMachine: 'draw-state'},
  ],
  trees: [
    {id: 'wm', title: 'WMS 容器树（system_server）', root: 'wm:root'},
    {id: 'sft', title: 'SF Layer 树（surfaceflinger）', root: 'sf:display'},
  ],
  events: [
    // —— 初始：只有 Launcher ——
    state(-10, 'ar-launcher', 'RESUMED'),
    state(-10, 'proc', 'NONE'),
    screen(-10, 'launcher'),
    node(-10, 'wm', 'wm:root', 'RootWindowContainer（无 surface）', null, 'root'),
    node(-10, 'wm', 'wm:dc', 'DisplayContent', 'wm:root', 'container', 'sf:display'),
    node(-10, 'wm', 'wm:tda', 'TaskDisplayArea', 'wm:dc', 'container', 'sf:tda'),
    node(-10, 'wm', 'wm:task-l', 'Task · Launcher', 'wm:tda', 'container', 'sf:task-l'),
    node(-10, 'wm', 'wm:ar-l', 'ActivityRecord · Launcher', 'wm:task-l', 'container', 'sf:ar-l'),
    node(-10, 'wm', 'wm:ws-l', 'WindowState · Launcher', 'wm:ar-l', 'container', 'sf:ws-l'),
    attr(-9, 'wm', 'wm:ws-l', '焦点窗口'),
    node(-10, 'sft', 'sf:display', 'Display（layerStack）', null, 'root'),
    node(-10, 'sft', 'sf:tda', 'TaskDisplayArea', 'sf:display', 'container'),
    node(-10, 'sft', 'sf:task-l', 'Task · Launcher', 'sf:tda', 'container'),
    node(-10, 'sft', 'sf:ar-l', 'ActivityRecord · Launcher', 'sf:task-l', 'container'),
    node(-10, 'sft', 'sf:ws-l', 'WindowState · Launcher', 'sf:ar-l', 'container'),
    node(-10, 'sft', 'sf:buf-l', 'Launcher buffer 层', 'sf:ws-l', 'buffer'),
    span('disp', -10, 492, 'Launcher', 'display'),

    // —— ① 点击 → ActivityStarter ——
    mark(0, 'l:main', '① 点击图标', 'info'),
    span('l:main', 0, 18, '① execStartActivity', 'cpu'),
    call(18, 'l:main', 'ss:binder', 'IActivityTaskManager.startActivity', 44),
    span('ss:binder', 18, 26, 'ActivityStarter.executeRequest · 解析 / 校验', 'cpu'),
    mark(24, 'ss:binder', 'new ActivityRecord', 'info'),
    state(24, 'ar-foo', 'INITIALIZING'),
    span('ss:binder', 26, 33, 'startActivityInner · Task.startActivityLocked', 'cpu'),
    node(28, 'wm', 'wm:task-f', 'Task · com.foo', 'wm:tda', 'container', 'sf:task-f'),
    node(28, 'wm', 'wm:ar-f', 'ActivityRecord · com.foo', 'wm:task-f', 'container', 'sf:ar-f'),
    node(28, 'sft', 'sf:task-f', 'Task · com.foo', 'sf:tda', 'container'),
    node(28, 'sft', 'sf:ar-f', 'ActivityRecord · com.foo', 'sf:task-f', 'container'),
    mark(31, 'ss:binder', 'Task.moveToFront', 'info'),

    // —— ② 暂停 Launcher，同时提前拉进程 ——
    span('ss:binder', 34, 44, '② resumeTopActivity · startPausing', 'cpu'),
    post(38, 'ss:binder', 'ss:am', 'startProcess', 40),
    oneway(40, 'ss:binder', 'l:main', 'scheduleTransactionItem(PauseActivityItem)'),
    state(40, 'ar-launcher', 'PAUSING'),
    span('l:main', 46, 58, 'onPause', 'cpu'),
    call(58, 'l:main', 'ss:binder', 'activityPaused', 62),
    span('ss:binder', 58, 62, 'activityPaused', 'cpu'),
    state(61, 'ar-launcher', 'PAUSED'),

    // —— ③ 进程创建 ——
    span('ss:am', 40, 50, '③ ProcessList.startProcessLocked', 'cpu'),
    state(41, 'proc', 'STARTING'),
    socket(50, 'ss:am', 'zygote', 'ZygoteProcess：fork 请求'),
    span('zygote', 50, 60, 'processCommand · forkAndSpecialize', 'cpu'),
    fork(60, 'zygote', 'foo:main', 'foo'),
    span('foo:main', 60, 104, 'ZygoteInit → RuntimeInit → ActivityThread.main', 'cpu'),

    // —— ④ attachApplication → realStartActivityLocked ——
    call(104, 'foo:main', 'ss:binder', 'IActivityManager.attachApplication', 124),
    span('ss:binder', 104, 112, '④ AMS.attachApplicationLocked', 'cpu'),
    state(106, 'proc', 'ATTACHED'),
    oneway(110, 'ss:binder', 'foo:binder', 'bindApplication'),
    span('foo:binder', 110, 113, 'bindApplication', 'cpu'),
    post(112, 'foo:binder', 'foo:main', 'BIND_APPLICATION', 126),
    span('ss:binder', 113, 124, 'attachApplication → realStartActivityLocked', 'cpu'),
    oneway(119, 'ss:binder', 'foo:binder', 'scheduleTransactionItems(Launch + Resume)'),
    span('foo:binder', 119, 122, 'scheduleTransaction', 'cpu'),
    post(121, 'foo:binder', 'foo:main', 'EXECUTE_TRANSACTION', 252),
    mark(122, 'ss:binder', 'Task.setResumedActivity(com.foo)', 'ok'),
    state(122, 'ar-foo', 'RESUMED'),

    // —— ⑤ 主线程依次消费事务 ——
    span('foo:main', 126, 252, '⑤ handleBindApplication · Application.onCreate', 'cpu'),
    state(252, 'proc', 'RUNNING'),
    span('foo:main', 252, 352, 'performLaunchActivity · onCreate / setContentView', 'cpu'),
    span('foo:main', 352, 376, 'handleResumeActivity · onResume', 'cpu'),

    // —— ⑥ addWindow：WMS 建 WindowState ——
    call(368, 'foo:main', 'ss:wm', 'IWindowSession.addToDisplayAsUser', 384),
    span('ss:wm', 368, 384, '⑥ WMS.addWindow · new WindowState · 挂树', 'cpu'),
    node(374, 'wm', 'wm:ws-f', 'WindowState · com.foo', 'wm:ar-f', 'container', 'sf:ws-f'),
    node(374, 'sft', 'sf:ws-f', 'WindowState · com.foo（容器层）', 'sf:ar-f', 'container'),
    state(382, 'draw', 'NO_SURFACE'),

    // —— ⑦ 首帧：主线程 → RenderThread → SurfaceFlinger ——
    span('foo:main', 390, 393, '⑦ doFrame · TRAVERSAL', 'cpu', {frame: '首帧'}),
    call(393, 'foo:main', 'ss:wm', 'IWindowSession.relayout2', 408),
    span('ss:wm', 393, 408, 'relayoutWindow → WindowState.setClientSurface', 'cpu'),
    node(396, 'sft', 'sf:buf-f', 'com.foo buffer 层（应用自建）', null, 'buffer'),
    reparent(402, 'sft', 'sf:buf-f', 'sf:ws-f'),
    state(406, 'draw', 'DRAW_PENDING'),
    span('foo:main', 408, 444, 'performTraversals · measure / layout / draw', 'cpu', {frame: '首帧'}),
    span('foo:rt', 444, 466, 'RenderThread · GPU 绘制 → queueBuffer', 'cpu', {frame: '首帧'}),
    batch(466, 'foo:rt', 'sf', 'BLASTBufferQueue：setBuffer 事务'),
    oneway(468, 'foo:main', 'ss:wm', 'finishDrawing'),
    span('ss:wm', 470, 482, 'finishDrawingWindow → finishDrawingLocked', 'cpu'),
    state(476, 'draw', 'COMMIT_DRAW_PENDING'),
    span('sf', 468, 482, 'commit · latch 首帧 buffer', 'sf'),
    span('sf', 482, 490, 'composite · HWC present', 'sf'),

    // —— ⑧ 窗口可见 + 焦点切换 ——
    span('ss:wm', 484, 496, '⑧ performSurfacePlacement · performShowLocked', 'cpu'),
    state(484, 'draw', 'READY_TO_SHOW'),
    state(490, 'draw', 'HAS_DRAWN'),
    screen(492, 'app'),
    span('disp', 492, 580, 'com.foo', 'display'),
    mark(492, 'disp', '首帧可见', 'ok'),
    span('ss:wm', 500, 514, 'updateFocusedWindowLocked · setInputFocusLw', 'cpu'),
    attr(504, 'wm', 'wm:ws-l', '失去焦点'),
    attr(508, 'wm', 'wm:ws-f', '焦点窗口'),
    mark(514, 'ss:wm', '焦点 → com.foo 窗口', 'ok'),

    // —— Launcher 不可见 → stop ——
    oneway(520, 'ss:binder', 'l:main', 'scheduleTransactionItem(StopActivityItem)'),
    state(520, 'ar-launcher', 'STOPPING'),
    span('l:main', 530, 544, 'onStop', 'cpu'),
    call(544, 'l:main', 'ss:binder', 'activityStopped', 548),
    state(548, 'ar-launcher', 'STOPPED'),
  ],
};

/** 全链路分镜：一个阶段一个镜头，镜头窗口按阶段收紧，文字才放得下 */
export const launchStory: FlowStory = {
  steps: [
    {
      to: -5,
      view: [-10, 580],
      move: 1.5,
      hold: 6,
      caption: '冷启动全貌：5 个进程、10 条泳道，八个阶段依次推进。下面每一步对应泳道上标了序号的那段。',
      code: {
        file: '说明',
        note: '时序为示意，方法名与行号已对 Android 17（SDK 37）核对。\napp/ = core/java/android/app/   view/ = core/java/android/view/\nam/ wm/ = services/core/java/com/android/server/{am,wm}/',
      },
    },
    {
      to: 44,
      view: [-5, 62],
      move: 3,
      hold: 8,
      focus: ['activity-starter'],
      caption:
        '① 点击图标：Launcher 的 Instrumentation 同步调 ATMS.startActivity（蓝色实线，调用方阻塞）。ActivityStarter 解析 Intent、做权限检查、new ActivityRecord，startActivityInner 选定 Task 并置顶。',
      code: {
        file: 'wm/ActivityStarter.java:837 · :1540 · :2015',
        note: 'execute(:837) → executeRequest(:1087)\n→ new ActivityRecord.Builder(:1540)\n→ startActivityUnchecked(:1770) → startActivityInner(:2015)',
      },
    },
    {
      to: 62,
      view: [28, 96],
      move: 3,
      hold: 8,
      focus: ['task-fragment'],
      caption:
        '② resumeTopActivity 要 resume 新 Activity：先让 Launcher 进入 PAUSING；同时发现目标进程不在，把 startProcess 异步 post 给 AMS 线程——两件事并行，不等 pause 完成。',
      code: {
        file: 'wm/TaskFragment.java:1357 · resumeTopActivity',
        note: '源码注释（:1459-1463）：进程启动是异步的，\n已知下一个 Activity 的进程没起就提前启动，\n省掉等待当前 Activity pause 的时间。',
      },
    },
    {
      to: 104,
      view: [36, 112],
      move: 3,
      hold: 8,
      focus: ['process-list'],
      caption: '③ ProcessList.startProcessLocked 新建 ProcessRecord，经 ZygoteProcess 走 socket 请 Zygote fork；新进程从 ActivityThread.main 开始跑。',
      code: {
        file: 'am/ProcessList.java:1830 · startProcessLocked',
        note: 'Process.start(:2668) → android/os/ZygoteProcess.java:387\n→ ZygoteConnection.processCommand(:120)\n→ Zygote.forkAndSpecialize(:250)',
      },
    },
    {
      to: 126,
      view: [98, 136],
      move: 3,
      hold: 8.5,
      focus: ['activity-thread', 'lifecycle-manager'],
      caption:
        '④ attachApplication 是同步 binder：AMS 回 bindApplication，再经 RootWindowContainer → realStartActivityLocked 发出 LaunchActivityItem + ResumeActivityItem，ActivityRecord 直接进入 RESUMED。两条 oneway 先到 binder 线程，再 post 到主线程排队。',
      code: {
        file: 'am/ActivityManagerService.java:5192 · wm/ActivityTaskSupervisor.java:809',
        note: '组装 item（:1050/:1063）\n→ ClientLifecycleManager.scheduleTransactionItems(:1079)\n→ r.setState(RESUMED, "realStartActivityLocked")（:957）',
      },
    },
    {
      to: 378,
      view: [110, 392],
      move: 4,
      hold: 8,
      focus: ['transaction-executor', 'activity'],
      caption:
        '⑤ 主线程按顺序消费：handleBindApplication（Application.onCreate）→ LaunchActivityItem（onCreate / setContentView）→ ResumeActivityItem（onResume）。这一段最容易被应用自己拖慢。',
      code: {
        file: 'app/servertransaction/TransactionExecutor.java:72',
        note: 'execute(:72) → executeTransactionItems(:95)\n→ executeLifecycleItem(:146)\n→ handleLaunchActivity(:4733) / handleResumeActivity(:5997)',
      },
    },
    {
      to: 386,
      view: [360, 400],
      move: 3,
      hold: 8,
      focus: ['window-state'],
      caption: '⑥ onResume 之后 addView → WMS.addWindow：按 attrs.token 找到 ActivityRecord（它就是这个窗口的 WindowToken），new WindowState 并挂树，容器层 SurfaceControl 随之建出。',
      code: {
        file: 'wm/WindowManagerService.java:1672 · addWindow',
        note: 'Session.addToDisplayAsUser(:272) → WMS.addWindow\n→ new WindowState → token.addWindow\n此时窗口还没有像素：mDrawState = NO_SURFACE。',
      },
    },
    {
      to: 462,
      view: [386, 474],
      move: 3,
      hold: 9,
      focus: ['view-root-impl', 'threaded-renderer'],
      caption:
        '⑦ 首帧只有一跳：performTraversals 先走 relayout2，应用自建的 buffer 层被 setClientSurface reparent 到容器层下；主线程 draw 完交给 RenderThread，RenderThread queueBuffer 后由 BLASTBufferQueue 打成 setBuffer 事务直接提交给 SurfaceFlinger。',
      code: {
        file: 'view/ViewRootImpl.java:10303 · wm/WindowState.java:3431 · gui/BLASTBufferQueue.cpp:667',
        snippet: 'mWinAnimator.mSurfaceControl = ...;\ngetPendingTransaction().reparent(surface, mSurfaceControl);',
      },
    },
    {
      to: 524,
      view: [462, 556],
      move: 3,
      hold: 9,
      focus: ['wms'],
      caption:
        '⑧ SF latch 首帧并合成上屏；WMS 这边绘制状态推到 READY_TO_SHOW → HAS_DRAWN，窗口真正可见，随后 updateFocusedWindowLocked 把输入焦点交给新窗口。Launcher 不可见后才被 stop。',
      code: {
        file: 'wm/WindowManagerService.java · updateFocusedWindowLocked',
        note: '焦点在「窗口可见」之后才切；\nInputMonitor.setInputFocusLw 通知 InputDispatcher。\n不可见的 Activity 随后 STOPPING → STOPPED。',
      },
    },
  ],
};

/** 双树分镜：停点都在最后一个树事件之后 ≥ 2（树动画 1.5） */
export const launchTreeStory: FlowStory = {
  steps: [
    {
      to: -5,
      move: 1.5,
      hold: 5.5,
      caption: '起点：只有 Launcher。WMS 每个容器都有对应的 SF 容器层（虚线为一一对应），焦点在 Launcher 的窗口上。',
    },
    {
      to: 34,
      move: 2.5,
      hold: 6.5,
      caption: '① startActivity：WMS 建出 Task · com.foo 与 ActivityRecord，SF 侧同步出现容器层，新 Task 被置顶——此时还没有任何窗口。',
      code: {
        file: 'wm/ActivityStarter.java:2015 · startActivityInner',
        note: '新 Task 挂到 TaskDisplayArea 下；\n容器的 SurfaceControl 随 onParentChanged → createSurfaceControl 创建。',
      },
    },
    {
      to: 386,
      move: 3,
      hold: 6.5,
      caption: '⑥ onResume 之后 addWindow：WindowState 挂在 ActivityRecord（它同时是 WindowToken）下，容器层随之建出；此时窗口还没有像素。',
      code: {file: 'wm/WindowManagerService.java:1672 · addWindow'},
    },
    {
      to: 410,
      move: 2.5,
      hold: 7,
      caption: '⑦ 首次 relayout2：buffer 层由应用自己建（先不挂树），再被 setClientSurface reparent 到容器层下——像素层归应用，容器层归 WMS。',
      code: {
        file: 'wm/WindowState.java:3412-3433 · setClientSurface',
        snippet: 'mWinAnimator.mSurfaceControl = ...;\ngetPendingTransaction().reparent(surface, mSurfaceControl);',
      },
    },
    {
      to: 516,
      move: 3,
      hold: 6.5,
      caption: '⑧ 首帧画完、窗口可见之后，焦点从 Launcher 的窗口转到 com.foo 的窗口；Launcher 的 Task 仍留在树上，只是不可见。',
      code: {file: 'wm/WindowManagerService.java · updateFocusedWindowLocked'},
    },
  ],
};
