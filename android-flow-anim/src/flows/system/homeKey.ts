import {
  attr,
  call,
  input,
  mark,
  msg,
  node,
  oneway,
  post,
  reparent,
  res,
  screen,
  span,
  state,
} from '../../dsl/builders';
import type {FlowScript, FlowStory} from '../../dsl/types';

/**
 * Home 键（示意时序，非实测）
 * 基线：**硬件 / 虚拟硬键** HOME —— EventHub 读到按键 → InputDispatcher 派发前询问策略
 * → PhoneWindowManager 拦截消费 → ATMS.startHomeOnDisplay → com.foo pause、Launcher resume。
 * 类名 / 方法名已对照 Android 17（SDK 37）源码核对。
 */
export const homeKeyScript: FlowScript = {
  id: 'home-key',
  kind: 'structure',
  title: '按下 Home 键之后',
  subtitle: '示意时序 · 硬件按键 · InputDispatcher → PhoneWindowManager → ATMS → Launcher',
  window: [-5, 320],
  clockProfile: 'default-60',
  vsyncLanes: {app: 'l:main', sf: 'sf'},
  pool: {def: 'input-events', params: {}},
  processes: [
    {id: 'system_server', label: 'system_server', layer: 'system_server'},
    {id: 'foo', label: 'com.foo', layer: 'app'},
    {id: 'launcher', label: 'Launcher', layer: 'app'},
    {id: 'sfp', label: 'surfaceflinger', layer: 'native'},
  ],
  lanes: [
    {id: 'ss:reader', label: 'system_server · InputReader', sub: 'EventHub / KeyboardInputMapper', process: 'system_server', component: 'ims'},
    {id: 'ss:dispatch', label: 'system_server · InputDispatcher', sub: 'inbound 队列 · 策略拦截', process: 'system_server', component: 'ims'},
    {id: 'ss:policy', label: 'system_server · PWM Handler', sub: 'PhoneWindowManager → ATMS', process: 'system_server', component: 'pwm'},
    {id: 'ss:binder', label: 'system_server · WM', sub: 'ATMS / WMS / WindowState', process: 'system_server', component: 'atms'},
    {id: 'foo:main', label: 'com.foo · main', sub: 'ActivityThread', process: 'foo', component: 'activity-thread'},
    {id: 'l:main', label: 'Launcher · main', sub: 'ActivityThread / ViewRootImpl', process: 'launcher', component: 'launcher'},
    {id: 'l:rt', label: 'Launcher · RenderThread', sub: 'ThreadedRenderer / BLASTBufferQueue', process: 'launcher', component: 'hwui'},
    {id: 'sf', label: 'SurfaceFlinger', sub: 'commit · composite', process: 'sfp', component: 'sf-ce'},
    {id: 'disp', label: '屏幕', component: 'hwc'},
  ],
  resources: [
    {id: 'kd', label: '↓'},
    {id: 'ku', label: '↑'},
  ],
  objects: [
    {id: 'ar-foo', label: 'ActivityRecord · com.foo', stateMachine: 'activity-record'},
    {id: 'ar-launcher', label: 'ActivityRecord · Launcher', stateMachine: 'activity-record'},
    {id: 'draw', label: 'WindowStateAnimator.mDrawState · Launcher', stateMachine: 'draw-state'},
  ],
  trees: [
    {id: 'wm', title: 'WMS 容器树（system_server）', root: 'wm:root'},
    {id: 'sft', title: 'SF Layer 树（surfaceflinger）', root: 'sf:display'},
  ],
  events: [
    state(-10, 'draw', 'NO_SURFACE'),
    state(-10, 'ar-foo', 'RESUMED'),
    state(-10, 'ar-launcher', 'STOPPED'),
    screen(-10, 'app'),
    res('kd', -100, 'NONE', 'ss:reader'),
    res('ku', -100, 'NONE', 'ss:reader'),
    node(-10, 'wm', 'wm:root', 'RootWindowContainer（无 surface）', null, 'root'),
    node(-10, 'wm', 'wm:dc', 'DisplayContent', 'wm:root', 'container', 'sf:display'),
    node(-10, 'wm', 'wm:tda', 'TaskDisplayArea', 'wm:dc', 'container', 'sf:tda'),
    node(-10, 'wm', 'wm:task-l', 'Task · Launcher（Home）', 'wm:tda', 'container', 'sf:task-l'),
    node(-10, 'wm', 'wm:ar-l', 'ActivityRecord · Launcher', 'wm:task-l', 'container', 'sf:ar-l'),
    node(-10, 'wm', 'wm:ws-l', 'WindowState · Launcher', 'wm:ar-l', 'container', 'sf:ws-l'),
    node(-10, 'wm', 'wm:task-f', 'Task · com.foo', 'wm:tda', 'container', 'sf:task-f'),
    node(-10, 'wm', 'wm:ar-f', 'ActivityRecord · com.foo', 'wm:task-f', 'container', 'sf:ar-f'),
    node(-10, 'wm', 'wm:ws-f', 'WindowState · com.foo', 'wm:ar-f', 'container', 'sf:ws-f'),
    attr(-9, 'wm', 'wm:ws-f', '焦点窗口'),
    node(-10, 'sft', 'sf:display', 'Display（layerStack）', null, 'root'),
    node(-10, 'sft', 'sf:tda', 'TaskDisplayArea', 'sf:display', 'container'),
    node(-10, 'sft', 'sf:task-l', 'Task · Launcher（Home）', 'sf:tda', 'container'),
    node(-10, 'sft', 'sf:ar-l', 'ActivityRecord · Launcher', 'sf:task-l', 'container'),
    node(-10, 'sft', 'sf:ws-l', 'WindowState · Launcher', 'sf:ar-l', 'container'),
    node(-10, 'sft', 'sf:buf-l', 'Launcher buffer 层', 'sf:ws-l', 'buffer'),
    node(-10, 'sft', 'sf:task-f', 'Task · com.foo', 'sf:tda', 'container'),
    node(-10, 'sft', 'sf:ar-f', 'ActivityRecord · com.foo', 'sf:task-f', 'container'),
    node(-10, 'sft', 'sf:ws-f', 'WindowState · com.foo', 'sf:ar-f', 'container'),
    node(-10, 'sft', 'sf:buf-f', 'com.foo buffer 层', 'sf:ws-f', 'buffer'),
    span('disp', -5, 196, 'com.foo', 'display'),

    // —— ① 按下：硬件 HOME 键进入输入管线 ——
    input(0, 'ss:reader', 'key-down', '硬件 HOME 键按下'),
    span('ss:reader', 0, 2, '① EventHub.getEvents → 映射 KEYCODE_HOME', 'cpu'),
    res('kd', 1, 'CREATED', 'ss:reader'),
    msg(2, 'ss:reader', 'ss:dispatch', 'notifyKey'),
    span('ss:dispatch', 2, 4, 'interceptKeyBeforeQueueing（PWM）→ PASS_TO_USER', 'cpu'),
    res('kd', 2.2, 'INJECTED', 'ss:dispatch'),
    res('kd', 4, 'QUEUED', 'ss:dispatch'),
    span('ss:dispatch', 5, 7, 'interceptKeyBeforeDispatching(↓) → 返回 -1，系统消费', 'cpu'),
    res('kd', 5, 'DISPATCHING', 'ss:dispatch'),
    res('kd', 7, 'CONSUMED', 'ss:dispatch'),

    // —— ② 抬起：同一路径；被消费时 post handleShortPressOnHome ——
    input(60, 'ss:reader', 'key-up', '硬件 HOME 键抬起'),
    span('ss:reader', 60, 62, '② EventHub.getEvents → KEYCODE_HOME（UP）', 'cpu'),
    res('ku', 61, 'CREATED', 'ss:reader'),
    msg(62, 'ss:reader', 'ss:dispatch', 'notifyKey'),
    span('ss:dispatch', 62, 64, 'interceptKeyBeforeQueueing → PASS_TO_USER', 'cpu'),
    res('ku', 62.2, 'INJECTED', 'ss:dispatch'),
    res('ku', 64, 'QUEUED', 'ss:dispatch'),
    span('ss:dispatch', 65, 67, 'interceptKeyBeforeDispatching(↑) → 消费', 'cpu'),
    res('ku', 65, 'DISPATCHING', 'ss:dispatch'),
    post(66, 'ss:dispatch', 'ss:policy', 'handleShortPressOnHome', 69),
    res('ku', 67, 'CONSUMED', 'ss:dispatch'),

    // —— ③ PhoneWindowManager → ATMS：把桌面 Task 带到前台 ——
    span('ss:policy', 69, 73, '③ handleShortPressOnHome → launchHomeFromHotKey', 'cpu'),
    mark(73, 'ss:policy', 'sendCloseSystemWindows(homekey)', 'info'),
    span('ss:policy', 73, 86, 'startDockOrHome → ATMS.startHomeOnDisplay', 'cpu'),
    span('ss:binder', 78, 90, 'startHomeOnDisplay · Task.moveToFront', 'cpu'),
    reparent(82, 'wm', 'wm:task-l', 'wm:tda'),
    reparent(83, 'sft', 'sf:task-l', 'sf:tda'),
    mark(84, 'ss:binder', 'Task · Launcher 置顶', 'info'),
    state(86, 'ar-foo', 'PAUSING'),
    oneway(86, 'ss:binder', 'foo:main', 'scheduleTransactionItem(PauseActivityItem)'),

    // —— ④ com.foo 暂停 → Launcher 恢复 ——
    span('foo:main', 90, 100, '④ onPause', 'cpu'),
    call(100, 'foo:main', 'ss:binder', 'activityPaused', 104),
    span('ss:binder', 100, 106, 'activityPaused → resumeTopActivity(Launcher)', 'cpu'),
    state(103, 'ar-foo', 'PAUSED'),
    oneway(106, 'ss:binder', 'l:main', 'scheduleTransactionItems(NewIntent + Resume)'),
    state(106, 'ar-launcher', 'STARTED'),
    state(108, 'ar-launcher', 'RESUMED'),
    mark(108, 'ss:binder', 'Task.setResumedActivity(Launcher)', 'ok'),
    span('l:main', 110, 134, 'onNewIntent · onRestart / onStart / onResume', 'cpu'),

    // —— ⑤ 桌面重绘一帧：主线程 → RenderThread → SurfaceFlinger ——
    span('l:main', 140, 142, '⑤ doFrame · TRAVERSAL', 'cpu', {frame: '桌面帧'}),
    call(142, 'l:main', 'ss:binder', 'IWindowSession.relayout2', 150),
    span('ss:binder', 142, 150, 'WMS.relayoutWindow · 窗口重新可见', 'cpu'),
    state(146, 'draw', 'DRAW_PENDING'),
    span('l:main', 150, 168, 'performTraversals · measure / layout / draw', 'cpu', {frame: '桌面帧'}),
    span('l:rt', 168, 182, 'RenderThread · GPU 绘制 → queueBuffer', 'cpu', {frame: '桌面帧'}),
    oneway(184, 'l:main', 'ss:binder', 'finishDrawing'),
    span('ss:binder', 185, 192, 'finishDrawingWindow → finishDrawingLocked', 'cpu'),
    state(188, 'draw', 'COMMIT_DRAW_PENDING'),
    span('sf', 182, 194, 'commit · latch 桌面 buffer', 'sf'),
    span('sf', 194, 200, 'composite · HWC present', 'sf'),

    // —— ⑥ 桌面可见 + 焦点回到桌面；com.foo 被 stop ——
    span('ss:binder', 194, 200, '⑥ performSurfacePlacement · performShowLocked', 'cpu'),
    state(194, 'draw', 'READY_TO_SHOW'),
    state(198, 'draw', 'HAS_DRAWN'),
    screen(196, 'launcher'),
    span('disp', 196, 320, 'Launcher', 'display'),
    mark(198, 'disp', '桌面可见', 'ok'),
    span('ss:binder', 202, 212, 'updateFocusedWindowLocked · setInputFocusLw', 'cpu'),
    attr(206, 'wm', 'wm:ws-f', '失去焦点'),
    attr(208, 'wm', 'wm:ws-l', '焦点窗口'),
    mark(212, 'ss:binder', '焦点 → Launcher 窗口', 'ok'),
    attr(214, 'sft', 'sf:task-f', '不可见'),
    state(216, 'ar-foo', 'STOPPING'),
    oneway(218, 'ss:binder', 'foo:main', 'scheduleTransactionItem(StopActivityItem)'),
    span('foo:main', 226, 238, 'onStop', 'cpu'),
    state(240, 'ar-foo', 'STOPPED'),
  ],
};

/** 输入管线视角（PipelineView）：令牌停点均在事件后 ≥ 0.6 */
export const homeInputStory: FlowStory = {
  steps: [
    {
      to: -1,
      move: 1.5,
      hold: 6.5,
      caption: 'HOME 键在输入管线里的旅程：硬件按键经 EventHub 进来，走「读取 → 入队 → 派发前拦截」三段。下方虚线是各阶段之间的流向，发生时会高亮。',
      code: {file: '说明', note: '基线：硬件 / 虚拟硬键 HOME。\n两次策略拦截发生在不同线程。'},
    },
    {
      to: 3,
      move: 2.5,
      hold: 7.5,
      focus: ['kd'],
      caption: '按下：InputReader 从 EventHub 读到原始事件，KeyboardInputMapper 按键盘布局映射成 KEYCODE_HOME，再 notifyKey 交给 InputDispatcher。',
      code: {
        file: 'inputflinger/reader/InputReader.cpp · mapper/KeyboardInputMapper.cpp',
        note: 'EventHub.getEvents 读 /dev/input/event*；\nKeyboardInputMapper 查 .kl 布局映射出 keyCode。',
      },
    },
    {
      to: 5,
      move: 2,
      hold: 7.5,
      focus: ['kd'],
      caption: '入队前先问一次策略：interceptKeyBeforeQueueing 决定这个键要不要唤醒屏幕、要不要继续传；放行后事件进入 inbound 队列。',
      code: {
        file: 'inputflinger/dispatcher/InputDispatcher.cpp · notifyKey',
        note: 'policy->interceptKeyBeforeQueueing\n→ PhoneWindowManager.interceptKeyBeforeQueueing\n返回 ACTION_PASS_TO_USER 才会入队。',
      },
    },
    {
      to: 9,
      move: 2.5,
      hold: 8,
      focus: ['kd'],
      caption: '派发线程取出事件时再问一次：interceptKeyBeforeDispatching，PhoneWindowManager 对 HOME 返回 -1 —— 系统自己消费，不会发给任何应用窗口。',
      code: {
        file: 'inputflinger/dispatcher/InputDispatcher.cpp · PhoneWindowManager.java',
        note: 'dispatchKeyLocked → doInterceptKeyBeforeDispatchingCommand\n→ PWM.interceptKeyBeforeDispatching\n→ KEYCODE_HOME 由 home 键处理器接管，返回 -1。',
      },
    },
    {
      to: 69.5,
      move: 4,
      hold: 8,
      focus: ['ku'],
      caption: '抬起：HOME ↑ 走同一条路径。被消费时，PhoneWindowManager 把 handleShortPressOnHome post 到自己的 Handler，不在派发线程里做重活。',
      code: {
        file: 'PhoneWindowManager.java · handleHomeButton',
        note: 'ACTION_UP 且非长按 / 非双击等待\n→ post handleShortPressOnHome\n（双击 Home 行为开启时会先 postDelayed 等待）',
      },
    },
  ],
};

/** 全链路（带镜头缩放） */
export const homeStory: FlowStory = {
  steps: [
    {
      to: -2,
      view: [-5, 320],
      move: 1.5,
      hold: 7,
      caption:
        '按 Home 的全貌（示意时序）：硬件按键进输入管线 → PhoneWindowManager 拦截消费 → ATMS 把桌面 Task 带到前台 → com.foo pause、Launcher resume → 桌面重绘一帧 → 焦点回到桌面。',
      code: {
        file: '说明',
        note: '方法名与行号已对 Android 17（SDK 37）核对。\nwm/ = services/core/java/com/android/server/wm/',
      },
    },
    {
      to: 9,
      view: [-2, 14],
      move: 3,
      hold: 8.5,
      caption: '① 按下这 7ms：EventHub 读取 → 映射 KEYCODE_HOME → 入队前拦截（PASS_TO_USER）→ 派发前拦截（返回 -1，消费）。左侧 buffer 列里的 ↓ 令牌一路跟着走。',
      code: {file: 'InputReader.cpp · InputDispatcher.cpp', note: '两次拦截发生在不同线程：\nBeforeQueueing 在 notifyKey 的调用线程，\nBeforeDispatching 在派发线程。'},
    },
    {
      to: 70,
      view: [55, 80],
      move: 3,
      hold: 7.5,
      caption: '② 抬起：同样的路径再走一遍。HOME ↑ 被消费时 post handleShortPressOnHome（紫色点线是消息在 PWM Handler 里排队）。',
      code: {file: 'PhoneWindowManager.java · handleHomeButton'},
    },
    {
      to: 92,
      view: [60, 120],
      move: 2.5,
      hold: 8,
      caption: '③ launchHomeFromHotKey → startDockOrHome：先发「关闭系统对话框」广播，再调 ATMS.startHomeOnDisplay。桌面 Task 被 moveToFront 置顶，com.foo 进入 PAUSING。',
      code: {
        file: 'PhoneWindowManager.java · startDockOrHome · wm/RootWindowContainer.java',
        note: 'sendCloseSystemWindows(homekey)\n→ ActivityTaskManagerInternal.startHomeOnDisplay\n→ RootWindowContainer.startHomeOnDisplay\n→ ActivityStartController.startHomeActivity',
      },
    },
    {
      to: 136,
      view: [85, 175],
      move: 2.5,
      hold: 8,
      caption: '④ com.foo onPause 后回报 activityPaused；ATMS 随即恢复 Launcher：NewIntent + Resume 一起下发，Launcher 走 onNewIntent / onRestart / onStart / onResume。和冷启动是同一套 pause → resume 骨架。',
      code: {
        file: 'app/ActivityThread.java · wm/TaskFragment.java:1357',
        note: 'TransactionExecutor 按 cycleToPath 补齐\nSTOPPED → onRestart → onStart → onResume。',
      },
    },
    {
      to: 200,
      view: [135, 215],
      move: 3,
      hold: 8.5,
      caption: '⑤ 桌面重绘一帧：主线程 relayout2 → measure/layout/draw，RenderThread 画完提交 buffer 给 SurfaceFlinger；finishDrawing 把 mDrawState 推到 COMMIT_DRAW_PENDING，SF latch 后合成上屏。',
      code: {
        file: 'view/ViewRootImpl.java:10303 · gui/BLASTBufferQueue.cpp:667',
        note: '桌面窗口早就存在，这里只是重新可见 + 重绘，\n不需要再走 addWindow。',
      },
    },
    {
      to: 250,
      view: [185, 270],
      move: 3,
      hold: 8.5,
      caption: '⑥ 桌面可见后，WMS 把输入焦点从 com.foo 的窗口切到 Launcher 的窗口；com.foo 不可见，随后被 stop。整个过程中，com.foo 从没收到过 HOME 键。',
      code: {
        file: 'wm/WindowManagerService.java · updateFocusedWindowLocked · wm/InputMonitor.java',
        note: '焦点在「窗口可见」之后才切；\nInputMonitor.setInputFocusLw 通知 InputDispatcher。',
      },
    },
  ],
};

/** 双树视角：停点在最后一个树事件之后 ≥ 2 */
export const homeTreeStory: FlowStory = {
  steps: [
    {to: -2, move: 1.5, hold: 6.5, caption: '按 Home 之前：com.foo 的 Task 排在 TaskDisplayArea 子节点列表的最后——越靠后 Z 序越高，所以它盖在桌面上面，焦点也在它的窗口上。'},
    {
      to: 88,
      move: 2.5,
      hold: 7.5,
      caption: 'startHomeOnDisplay：WMS 调 Task.moveToFront，把桌面 Task 挪到子节点列表最后（Z 序变成最高），两棵树同步换位。',
      code: {
        file: 'wm/RootWindowContainer.java · startHomeOnDisplay · wm/Task.java · moveToFront',
        note: 'Z 序由 assignChildLayers 按子节点顺序重算，\n随事务一起提交给 SF。',
      },
    },
    {
      to: 212,
      move: 3,
      hold: 8,
      caption: '桌面重绘完成、窗口可见后，焦点从 com.foo 的 WindowState 转到 Launcher 的 WindowState——焦点是窗口级别的属性。',
      code: {file: 'wm/WindowManagerService.java · updateFocusedWindowLocked'},
    },
    {
      to: 245,
      move: 2.5,
      hold: 7.5,
      caption: 'com.foo 的 Task 标记为不可见、Activity 进入 STOPPING → STOPPED；它的容器层和 buffer 层仍留在树上，下次切回来可以直接复用。',
      code: {file: 'wm/TaskFragment.java · completePause → makeInvisible'},
    },
  ],
};

/**
 * 按阶段切换模板：输入 / 重绘看"时序"（timeline），换前台 / 焦点看"结构"（stage + Task 栈）。
 * 取代原来固定的 Overview（泳道）+ Tree（双树）两段；Task 栈停点在 reparent 之后 ≥ 3（TaskStackView 的换位动画时长）。
 */
const TIMELINE = {main: 'swimlane', s1: 'screen', s2: 'objects', s3: 'queue:ss:policy', s4: 'code'};
const STAGE = (stateSlot: string) => ({main: 'task-stack', s1: stateSlot, s2: 'screen', s3: 'code'});

export const homeTemplateStory: FlowStory = {
  steps: [
    {...homeStory.steps[0], layout: 'timeline', slots: TIMELINE},
    homeStory.steps[1],
    homeStory.steps[2],
    {
      to: 80,
      view: [60, 120],
      move: 2.5,
      hold: 7,
      layout: 'stage',
      slots: STAGE('state:activity-record:ar-foo'),
      caption:
        '③ PhoneWindowManager.launchHomeFromHotKey → startDockOrHome：先发「关闭系统对话框」广播，再调 ATMS.startHomeOnDisplay。此刻 com.foo 的 Task 还在栈顶，输入焦点也在它的窗口上。',
      code: homeStory.steps[3].code,
    },
    {
      to: 89,
      move: 4,
      hold: 7.5,
      caption:
        'Task.moveToFront：桌面 Task 被挪到 TaskDisplayArea 子节点列表的最后——Z 序最高，成为栈顶；com.foo 进入 PAUSING。注意焦点还留在 com.foo 的窗口上，要等桌面画出来才切。',
      code: homeTreeStory.steps[1].code,
    },
    {
      ...homeStory.steps[4],
      slots: STAGE('state:activity-record:ar-launcher'),
    },
    {
      ...homeStory.steps[5],
      layout: 'timeline',
      slots: {...TIMELINE, s3: 'state:draw-state:draw'},
    },
    {
      to: 214,
      view: [185, 270],
      move: 2.5,
      hold: 9,
      layout: 'stage',
      slots: STAGE('state:draw-state:draw'),
      caption:
        '⑥ 桌面窗口 HAS_DRAWN、可见之后，WMS updateFocusedWindowLocked 才把输入焦点从 com.foo 的 WindowState 切到 Launcher 的 WindowState——焦点是窗口级属性，经 InputMonitor.setInputFocusLw 通知 InputDispatcher。',
      code: homeStory.steps[6].code,
    },
    {
      to: 245,
      move: 2.5,
      hold: 8,
      slots: STAGE('state:activity-record:ar-foo'),
      caption:
        '收尾：com.foo 的 Activity 进入 STOPPING → STOPPED，但它的 Task、窗口和图层都还留在树上，下次切回来可以直接复用。整个过程中，com.foo 从没收到过 HOME 键。',
      code: homeTreeStory.steps[3].code,
    },
  ],
};
