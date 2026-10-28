import type {CodeRef, FlowStory} from '../../dsl/types';
import type {DispatchRuleConfig} from '../../views/DispatchRuleView';
import type {ViewTreeConfig} from '../../views/ViewTreeView';
import {SCREEN, TOUCH} from './inputFlow';

/**
 * 输入流程的分镜与视图配置。脚本：inputFlow.ts（建通道 + touch + key）、imeKey.ts（key + 输入法对照）。
 * 停点：协作图 / View 树停在调用进行中（调用栈不为空）；其余停在一段结束之后。
 */

const C = (file: string, note?: string): CodeRef => ({file, note});
const IF = 'inputflinger/dispatcher/InputDispatcher.cpp';

// ─────────── 视图配置 ───────────

export const INPUT_GRAPH_SETS: Record<string, string[]> = {
  channel: ['wms', 'session', 'ws', 'imon', 'ims', 'dispatcher', 'winfo', 'focus', 'ich-server', 'conn', 'publisher', 'vri', 'ich', 'looper', 'wier', 'nier', 'consumer'],
  reader: ['eventhub', 'reader', 'tmapper', 'kmapper', 'blocker', 'pchoreo', 'processor', 'filter', 'dispatcher', 'nim', 'pwm'],
  app: ['looper', 'nier', 'consumer', 'wier', 'vri', 'npre', 'vpre', 'ime', 'epost', 'npost', 'vpost', 'syn', 'act', 'pwin', 'decor'],
  ime: ['looper', 'vri', 'ime', 'imm', 'ime-sender', 'ric', 'eic', 'edit', 'ime-receiver', 'ime-session', 'pinyin', 'remote-ic'],
};

export const INPUT_DISPATCH_RULES: DispatchRuleConfig = {
  touch: {
    at: 218,
    step: 1,
    point: `(${TOUCH.x}, ${TOUCH.y})`,
    columns: ['同一 display', '可见\n!NOT_VISIBLE', '可触摸\n!NOT_TOUCHABLE', 'touchableRegion\n含该点'],
    windows: [
      {name: 'NavigationBar0', checks: [true, true, true, false], note: '只占屏幕底部'},
      {name: 'StatusBar', checks: [true, true, true, false], note: '只占屏幕顶部'},
      {name: 'com.foo/com.foo.MainActivity', checks: [true, true, true, true], hit: true},
      {name: 'Wallpaper', checks: [null, null, null, null]},
    ],
    note:
      'DOWN 决定整个手势的目标：记进 TouchState，之后的 MOVE / UP 直接发给它，不再命中检测。\nspy 窗口（如系统手势监听）不参与这轮查找，另外各收一份。\n窗口列表来自 SurfaceFlinger 下发的 windowInfos，不是 WMS 直接给的。',
  },
  key: {
    at: 1016.5,
    step: 0.8,
    rows: [
      {label: 'interceptKeyBeforeQueueing（入队前 · PhoneWindowManager）', pass: true, detail: 'ENTER 不是系统键 → ACTION_PASS_TO_USER'},
      {label: 'interceptKeyBeforeDispatching（派发前 · PhoneWindowManager）', pass: true, detail: '返回 0 → 继续；返回 -1 = 系统消费（如 HOME）'},
      {label: 'WMS 发过 FocusRequest', pass: true, detail: 'InputMonitor.requestFocus → setFocusedWindow → SF → InputDispatcher'},
      {label: '焦点窗口存在', pass: true, detail: 'FocusResolver：否则 NO_WINDOW'},
      {label: '可见（!NOT_VISIBLE）', pass: true},
      {label: '可获焦（!NOT_FOCUSABLE）', pass: true},
    ],
    result: '发给 com.foo/com.foo.MainActivity（焦点窗口）',
    note: '没有焦点窗口时按键会排队等待，等不到就是 ANR。\n进入应用后还要经过 ImeInputStage（有输入法会话才先给 IME），再沿 ViewGroup.mFocused 链交给获焦的 View。',
  },
};

export const INPUT_VIEW_TREE: ViewTreeConfig = {
  views: ['vri', 'decor', 'content', 'root', 'button'],
  screen: SCREEN,
  touches: [
    {...TOUCH, at: 200, until: 400, label: '按住'},
    {...TOUCH, at: 400, until: 480, label: '抬起'},
  ],
};

// ═══════════════ 整体：跨了哪些进程 ═══════════════
export const inputOverviewStory: FlowStory = {
  steps: [
    {
      to: -5,
      move: 1.5,
      hold: 8,
      caption: '一个 Button 的界面，一次点击、两次 ENTER：涉及 内核输入驱动 → system_server（InputReader / InputDispatcher 都在这个进程里）→ com.foo，画面再经 SurfaceFlinger 上屏。这张图只画跨进程的交互。',
      code: C('说明', 'inputflinger 不是独立进程：\nInputManager（native）跑在 system_server 里，\n有 InputReader、InputDispatcher 两个线程'),
    },
    {
      to: 75,
      move: 2.5,
      hold: 9,
      caption: '① 通道在 addWindow 时就建好了：WMS 让 InputDispatcher 建一对 socket，服务端留下，客户端经 binder 交给应用；窗口信息和焦点再经 SurfaceFlinger 同步给 InputDispatcher。',
      code: C('wm/WindowState.java · openInputChannel → input/InputManagerService.createInputChannel', `${IF} · createInputChannel\n→ InputChannel::openInputChannelPair（socketpair）`),
    },
    {
      to: 274,
      move: 3,
      hold: 9,
      caption: '② 手指按下：驱动通知 EventHub → InputDispatcher 用 socket 把 DOWN 发给 com.foo；应用处理完回一个 FINISHED。之后每个事件都是这样一来一回。',
      code: C('native/libs/input/InputTransport.cpp · InputPublisher::publishMotionEvent / InputConsumer::sendFinishedSignal'),
    },
    {
      to: 315,
      move: 2,
      hold: 7,
      caption: 'Button 进入按下态只是标记了"需要重画"：下一个 VSYNC 应用画完一帧，交给 SurfaceFlinger 合成上屏，用户才看到按钮变色。',
      code: C('view/View.java · setPressed → refreshDrawableState → invalidate'),
    },
    {
      to: 505,
      move: 3,
      hold: 9,
      caption: '③ 抬起：同样一来一回。点击不在这次分发里执行——Button 只是 post 了 PerformClick，等事件处理完、主线程空下来才 onClick → setText。',
      code: C('view/View.java · onTouchEvent(ACTION_UP)', 'if (!post(mPerformClick)) performClickInternal();'),
    },
    {
      to: 615,
      move: 2.5,
      hold: 8,
      caption: '④ setText 让布局失效：下一帧 measure → layout → draw，再给 SurfaceFlinger；按下态解除后又画一帧。系统进程不参与布局，全在应用里。',
      code: C('view/ViewRootImpl.java · performTraversals'),
    },
    {
      to: 905,
      move: 3,
      hold: 9,
      caption: '⑤ 第一次按 ENTER：同样的进程路径，但应用此刻处在触摸模式——这一下只用来"离开触摸模式"并让 Button 获得焦点，被吃掉了，不会点击。',
      code: C('view/ViewRootImpl.java · checkForLeavingTouchModeAndConsume', 'ENTER / DPAD_CENTER / 方向键 / TAB 都算导航键：\n触摸模式下第一下 ensureTouchMode(false) 并消费'),
    },
    {
      to: 1245,
      move: 3,
      hold: 9,
      caption: '⑥ 第二次 ENTER：按下、抬起各一来一回；onKeyUp 里同步 performClick → setText → 下一帧重新布局上屏。按键和触摸在进程层面走同一条路，区别在 InputDispatcher 怎么选窗口、应用里怎么找 View。',
      code: C('view/View.java · onKeyUp → performClickInternal'),
    },
  ],
};

// ═══════════════ system_server：建立通道 ═══════════════
export const inputChannelStory: FlowStory = {
  steps: [
    {
      to: -5,
      view: [-10, 80],
      move: 1.5,
      hold: 7,
      caption: '通道是怎么建起来的：ViewRootImpl.setView 时先 new 一个空的 InputChannel，作为 addToDisplayAsUser 的出参交给 WMS。',
      code: C('view/ViewRootImpl.java · setView', 'inputChannel = new InputChannel();\nmWindowSession.addToDisplayAsUser(…, inputChannel, …)'),
    },
    {
      to: 10.8,
      move: 3,
      hold: 9,
      focus: ['input-dispatcher', 'input-channel', 'connection'],
      caption: 'WMS.addWindow → WindowState.openInputChannel → InputManagerService.createInputChannel → native InputDispatcher::createInputChannel：socketpair 出一对 InputChannel，服务端包成 Connection（带 InputPublisher）并 addFd 到自己的 Looper。',
      code: C(`${IF} · createInputChannel`, 'InputChannel::openInputChannelPair(name, server, client)\nmConnectionManager.createConnection(server, …, handleReceiveCallback)'),
    },
    {
      to: 16.8,
      move: 2,
      hold: 8,
      focus: ['window-state', 'input-channel'],
      caption: 'WindowState 记下这个 channel 的 token（mInputChannelToken，也写进 InputWindowHandle），客户端 channel copyTo 到出参，随 binder 返回给应用。',
      code: C('wm/WindowState.java · openInputChannel', 'mInputChannelToken = channel.getToken();\nmInputWindowHandle.setToken(mInputChannelToken);\nchannel.copyTo(outInputChannel);'),
    },
    {
      to: 29.7,
      move: 2.5,
      hold: 8,
      focus: ['wier', 'nier', 'input-consumer'],
      caption: '应用拿到客户端 channel：new WindowInputEventReceiver(inputChannel, Looper.myLooper())，native 层 NativeInputEventReceiver 把 fd 加进主线程 Looper——之后事件一到，主线程就被唤醒。',
      code: C('core/jni/android_view_InputEventReceiver.cpp · NativeInputEventReceiver::initialize → setFdEvents'),
    },
    {
      to: 32.4,
      move: 2,
      hold: 8,
      focus: ['view-root-impl'],
      caption: '同一个 setView 里 setUpInputStages：从后往前 new 出 7 个 InputStage，用 mNext 串成链，mFirstInputStage 指向第一个。',
      code: C('view/ViewRootImpl.java · setView（setUpInputStages）'),
    },
    {
      to: 46.5,
      move: 2.5,
      hold: 8,
      focus: ['input-monitor'],
      caption: '窗口信息：InputMonitor 把每个窗口的 InputWindowHandle（位置、可触摸区域、flags、token）放进 SurfaceControl 事务交给 SurfaceFlinger，并请求输入焦点。',
      code: C('wm/InputMonitor.java · setInputWindowInfoIfNeeded · requestFocus → mInputTransaction.setFocusedWindow'),
    },
    {
      to: 64.5,
      move: 2.5,
      hold: 9,
      focus: ['window-info', 'focus-resolver'],
      caption: 'SurfaceFlinger 汇总 windowInfos 后通知 InputDispatcher（WindowInfosListener），焦点请求也经它转过来：FocusResolver 判定 com.foo 可获焦，成为焦点窗口，随后给应用发一个 FocusEvent。',
      code: C(`${IF} · onWindowInfosChanged · setFocusedWindow`, 'FocusResolver::isTokenFocusable：\nNO_WINDOW / NOT_VISIBLE / NOT_FOCUSABLE'),
    },
  ],
};

// ═══════════════ system_server：InputReader 线程（硬件 → 软件） ═══════════════
export const inputReaderStory: FlowStory = {
  steps: [
    {
      to: 195,
      view: [190, 220],
      move: 1.5,
      hold: 7,
      caption: '硬件事件怎么变成软件事件：触摸 IC 中断 → 内核 evdev 驱动把坐标写成一串 input_event（ABS_MT_*、BTN_TOUCH，最后 SYN_REPORT），/dev/input/event* 变为可读。',
      code: C('说明', '内核只上报原始数据：槽位、坐标、压力；\n"DOWN / MOVE / UP"是 InputReader 算出来的'),
    },
    {
      to: 202.5,
      move: 2.5,
      hold: 8,
      focus: ['input-reader', 'event-hub'],
      caption: 'InputReader 线程在 loopOnce 里阻塞于 EventHub.getEvents：epoll_wait 返回后 read 出这批 input_event，打包成 RawEvent。',
      code: C('inputflinger/reader/EventHub.cpp · getEvents', 'epoll_wait(mEpollFd, …) → read(device->fd, readBuffer, …)'),
    },
    {
      to: 206.8,
      move: 2,
      hold: 8,
      focus: ['mt-mapper'],
      caption: '按设备交给它的 Mapper：MultiTouchInputMapper 累积每个槽位的坐标，收到 SYN_REPORT 时 TouchInputMapper::sync 换算到屏幕坐标、判定动作，生成 NotifyMotionArgs(ACTION_DOWN)。',
      code: C('inputflinger/reader/mapper/TouchInputMapper.cpp · sync → dispatchMotion'),
    },
    {
      to: 212.9,
      move: 2.5,
      hold: 9,
      focus: ['unwanted-blocker', 'pointer-choreographer', 'input-processor', 'input-filter', 'input-dispatcher', 'native-input-manager'],
      caption: '然后穿过一条监听链：UnwantedInteractionBlocker（防误触）→ PointerChoreographer（指针）→ InputProcessor（分类）→ InputFilter（无障碍）→ InputDispatcher.notifyMotion。入队前先问策略：亮屏时触摸直接 PASS_TO_USER，不进 Java。',
      code: C('inputflinger/InputManager.cpp · InputManager()', '构造顺序（下游在前）：\nDispatcher ← InputFilter ← MetricsCollector ←\nInputProcessor ← PointerChoreographer ←\nUnwantedInteractionBlocker ← InputReader'),
    },
    {
      to: 812.9,
      view: [798, 830],
      move: 3,
      hold: 9,
      focus: ['key-mapper', 'native-input-manager', 'pwm'],
      caption: '按键同理，换成 KeyboardInputMapper：scanCode 按 .kl 映射成 KEYCODE_ENTER，生成 NotifyKeyArgs。不同的是入队前的策略一定会进 Java：PhoneWindowManager.interceptKeyBeforeQueueing（Power 等键在这里就被拦了）。',
      code: C('services/core/jni/com_android_server_input_InputManagerService.cpp · interceptKeyBeforeQueueing'),
    },
  ],
};

// ═══════════════ system_server：InputDispatcher 线程（分发标准） ═══════════════
export const inputDispatchStory: FlowStory = {
  steps: [
    {
      to: 214,
      view: [210, 232],
      move: 1.5,
      hold: 7,
      caption: 'InputDispatcher 线程被唤醒，从 inbound 队列取出 DOWN：先决定发给谁。左边是触摸的标准，右边是按键的标准。',
      code: C(`${IF} · dispatchOnce → dispatchOnceInnerLocked → dispatchMotionLocked`),
    },
    {
      to: 221.8,
      move: 3,
      hold: 11,
      caption: 'touch 看坐标：findTouchedWindowAt 按 Z 序从前往后，每个窗口检查 同一 display、可见、可触摸、touchableRegion 是否包含这个点。导航栏、状态栏都不包含该点，第一个命中的是 com.foo 的窗口。',
      code: C(`${IF} · DispatcherWindowInfo::windowAcceptsTouchAt`, '本机 native 树在这里有厂商补丁（Banma：逻辑屏 /\n物理屏合并、融合窗口跳过 NO_INPUT_CHANNEL 等），\n画的是 AOSP 主干判断'),
    },
    {
      to: 226.8,
      move: 2,
      hold: 8,
      caption: '目标定了：放进这个窗口 Connection 的 outboundQueue，startDispatchCycle 用 InputPublisher 写进 socket，同时挪进 waitQueue 等应用回 FINISHED——5 秒不回就是输入 ANR。',
      code: C(`${IF} · startDispatchCycleLocked`, 'DEFAULT_INPUT_DISPATCHING_TIMEOUT =\nUNMULTIPLIED_DEFAULT_DISPATCHING_TIMEOUT_MILLIS（5000）\n× HW_TIMEOUT_MULTIPLIER'),
    },
    {
      to: 1021.8,
      view: [1010, 1032],
      move: 3,
      hold: 11,
      caption: 'key 不看坐标：派发前再问一次策略（interceptKeyBeforeDispatching，HOME 等在这里被系统消费），然后只看 FocusResolver 记录的焦点窗口——它来自 WMS 的焦点请求，并且要存在、可见、可获焦。',
      code: C(`${IF} · dispatchKeyLocked → findFocusedWindowTargetLocked`),
    },
    {
      to: 1026.9,
      move: 2,
      hold: 7,
      caption: '之后和触摸一样：publishKeyEvent 写进同一个 socket，进 waitQueue 等 FINISHED。一个窗口只有一条 InputChannel，触摸和按键共用。',
      code: C('native/libs/input/InputTransport.cpp · InputPublisher::publishKeyEvent'),
    },
  ],
};

// ═══════════════ com.foo：接收 + InputStage 链 ═══════════════
export const inputAppStory: FlowStory = {
  steps: [
    {
      to: 228,
      view: [225, 275],
      move: 1.5,
      hold: 7,
      caption: '进入 com.foo：socket 可读，主线程 Looper 被唤醒（和处理 Handler 消息是同一个线程、同一个 Looper）。',
      code: C('core/jni/android_view_InputEventReceiver.cpp · handleEvent'),
    },
    {
      to: 233.5,
      move: 2,
      hold: 7,
      focus: ['nier', 'input-consumer'],
      caption: 'NativeInputEventReceiver.consumeEvents：InputConsumer 读出 InputMessage，还原成 MotionEvent（MOVE 会按帧批处理，等 Choreographer 的 INPUT 回调再一起交出）。',
      code: C('native/libs/input/InputConsumer.cpp · consume'),
    },
    {
      to: 240.5,
      move: 2.5,
      hold: 9,
      focus: ['view-root-impl', 'stage-native-pre', 'stage-view-pre', 'stage-ime', 'stage-early-post', 'stage-native-post'],
      caption: '回调 Java：WindowInputEventReceiver.onInputEvent → ViewRootImpl.enqueueInputEvent → deliverInputEvent 进入 InputStage 链。每一级 forward 都是同步调用下一级，所以调用栈一层套一层。触摸在前几级直接放行，ImeInputStage 发现没有输入法会话也放行。',
      code: C('view/ViewRootImpl.java · setUpInputStages', 'NativePreIme → ViewPreIme → Ime → EarlyPostIme\n→ NativePostIme → ViewPostIme → Synthetic'),
    },
    {
      to: 255,
      move: 2.5,
      hold: 9,
      focus: ['stage-view-post', 'decor-view', 'activity', 'phone-window'],
      caption: 'ViewPostImeInputStage.processPointerEvent → mView.dispatchPointerEvent：DecorView 先把事件交给 Window.Callback（就是 Activity），Activity 再经 PhoneWindow 交回 DecorView 的 ViewGroup 分发——所以 Activity.dispatchTouchEvent 能最先拦截。',
      code: C('internal/policy/DecorView.java · dispatchTouchEvent', 'cb.dispatchTouchEvent(ev)  // Activity\n→ getWindow().superDispatchTouchEvent(ev)\n→ mDecor.superDispatchTouchEvent(ev)'),
    },
    {
      to: 265.5,
      move: 2,
      hold: 8,
      focus: ['stage-synthetic', 'nier', 'input-consumer'],
      caption: 'View 树返回"已处理"：事件带着 FLAG_FINISHED 走到最后一级，finishInputEvent → sendFinishedSignal，FINISHED 写回 socket，InputDispatcher 把它从 waitQueue 移除（ANR 计时解除）。',
      code: C('view/ViewRootImpl.java · finishInputEvent → InputEventReceiver.finishInputEvent'),
    },
    {
      to: 845.5,
      view: [828, 870],
      move: 3,
      hold: 9,
      focus: ['stage-early-post'],
      caption: '按键 ENTER #1：前三级同样放行；到 EarlyPostImeInputStage 时发现应用在触摸模式、ENTER 又是导航键——ensureTouchMode(false) 让 Button 获得焦点，返回 FINISH_HANDLED，后面的阶段和 View 树都收不到。',
      code: C('view/ViewRootImpl.java · EarlyPostImeInputStage.processKeyEvent → checkForLeavingTouchModeAndConsume'),
    },
    {
      to: 1050,
      view: [1028, 1080],
      move: 3,
      hold: 8,
      focus: ['stage-view-post', 'decor-view'],
      caption: '按键 ENTER #2：已不在触摸模式，一路走到 ViewPostImeInputStage.processKeyEvent → mView.dispatchKeyEvent，同样先经 Activity 再交回 View 树。',
      code: C('view/ViewRootImpl.java · ViewPostImeInputStage.processKeyEvent'),
    },
  ],
};

// ═══════════════ 应用布局内部：View 树 ═══════════════
export const inputViewTreeStory: FlowStory = {
  steps: [
    {
      to: 236,
      view: [230, 320],
      move: 1.5,
      hold: 7,
      caption: '进入应用布局：DecorView → FrameLayout（android:id/content）→ LinearLayout（布局根）→ Button。左边是按 bounds 画的界面，右边是 View 树和每个 View 的标志位。',
      code: C('说明', '蓝色箭头 = 向下（分发 / measure / layout / draw）\n橙色箭头 = 向上（invalidate / requestLayout 冒泡）'),
    },
    {
      to: 249.6,
      move: 3,
      hold: 9,
      focus: ['button'],
      caption: 'DOWN 的分发：ViewGroup.dispatchTouchEvent 先问 onInterceptTouchEvent（不拦），再倒序遍历子 View，用 isTransformedTouchPointInView 找包含触摸点的那个，层层传到 Button.onTouchEvent——父容器不延迟按下态，Button 立刻 PRESSED。',
      code: C('view/ViewGroup.java · dispatchTouchEvent', 'intercepted = onInterceptTouchEvent(ev);\nbuildTouchDispatchChildList() → isTransformedTouchPointInView\n→ dispatchTransformedTouchEvent → addTouchTarget'),
    },
    {
      to: 252.4,
      move: 2,
      hold: 8,
      caption: '按下态要重画：setPressed → invalidate，invalidateChild → onDescendantInvalidated 一路冒泡到 ViewRootImpl，scheduleTraversals 等下一个 VSYNC。此刻什么都还没画。',
      code: C('view/View.java · invalidateInternal → ViewGroup.onDescendantInvalidated → ViewRootImpl.onDescendantInvalidated'),
    },
    {
      to: 296,
      move: 3,
      hold: 8,
      caption: '下一帧：只有 DIRTY 没有 FORCE_LAYOUT，所以只走 draw——从 ViewRootImpl 往下 updateDisplayListIfDirty，只有 Button 重新录制显示列表。DOWN 时每层 ViewGroup 都记下了 mFirstTouchTarget。',
      code: C('view/ViewRootImpl.java · performTraversals → performDraw'),
    },
    {
      to: 447.5,
      view: [438, 500],
      move: 3,
      hold: 9,
      focus: ['button'],
      caption: 'UP：每层 ViewGroup 直接沿 mFirstTouchTarget 往下发，不再命中检测。Button.onTouchEvent(UP) 不当场点击，而是 post(PerformClick)、postDelayed(UnsetPressedState)，让按下态的视觉先显示出来。',
      code: C('view/View.java · onTouchEvent(ACTION_UP)', 'mPerformClick = new PerformClick();\nif (!post(mPerformClick)) performClickInternal();'),
    },
    {
      to: 493.5,
      move: 3,
      hold: 10,
      focus: ['button', 'click-listener'],
      caption: '主线程取出 PerformClick → onClick → setText("已点击 1 次")：checkForRelayout 判定尺寸可能变，requestLayout 沿 mParent 一路往上，每一层都打上 FORCE_LAYOUT，最后 ViewRootImpl.mLayoutRequested = true → scheduleTraversals。',
      code: C('view/View.java · requestLayout', 'mPrivateFlags |= PFLAG_FORCE_LAYOUT;\nif (mParent != null && !mParent.isLayoutRequested())\n    mParent.requestLayout();'),
    },
    {
      to: 526,
      view: [515, 560],
      move: 2.5,
      hold: 8,
      caption: '下一帧 performTraversals 先 measure：从 ViewRootImpl 往下，带 FORCE_LAYOUT 的 View 都会重新 onMeasure——Button 文字变长，宽度要重新算。',
      code: C('view/ViewRootImpl.java · performMeasure → View.measure'),
    },
    {
      to: 535,
      move: 2,
      hold: 7,
      caption: '再 layout：按新尺寸摆位置，做完清掉 FORCE_LAYOUT；最后 draw 重新录制显示列表，交给 RenderThread → SurfaceFlinger。',
      code: C('view/ViewRootImpl.java · performLayout → View.layout'),
    },
    {
      to: 845.5,
      view: [828, 870],
      move: 3,
      hold: 9,
      focus: ['button'],
      caption: '换成按键：第一下 ENTER 离开触摸模式，Button 获得焦点——每层 ViewGroup 的 mFocused 指向通往 Button 的那个子 View。按键之后就沿这条 mFocused 链往下找，不看坐标。',
      code: C('view/ViewGroup.java · dispatchKeyEvent', 'if (mFocused != null && …)\n    return mFocused.dispatchKeyEvent(event);'),
    },
    {
      to: 1160,
      view: [1140, 1200],
      move: 3,
      hold: 10,
      focus: ['button', 'click-listener'],
      caption: '第二下 ENTER：沿 mFocused 到 Button，onKeyDown 设 PRESSED；抬起时 onKeyUp 同步 performClickInternal（不 post）→ onClick → setText → 同样的 requestLayout 冒泡，下一帧重新 measure / layout / draw。',
      code: C('view/View.java · onKeyUp', 'if (KeyEvent.isConfirmKey(keyCode) …) {\n  if (… isPressed()) { setPressed(false); …\n    return performClickInternal(); } }'),
    },
  ],
};

// ═══════════════ key + 输入法 ═══════════════
export const imeOverviewStory: FlowStory = {
  steps: [
    {
      to: -5,
      move: 1.5,
      hold: 8,
      caption: '对照场景：同一界面多一个获得焦点的 EditText，软键盘显示。这时多了一个 IME 进程，按键会先绕到它那里。',
      code: C('说明', '只有窗口有输入法会话时才会这样；\n只有一个 Button 的界面，按键不经过 IME'),
    },
    {
      to: 190,
      move: 3,
      hold: 9,
      caption: '① 硬件 N：前半段和普通按键一样到达 com.foo；应用把它经另一条 InputChannel 转给 IME，IME 拼写 "n"、更新自己的候选栏，回答"已处理"，应用再向 InputDispatcher 回 FINISHED。EditText 什么都没收到。',
      code: C('view/inputmethod/InputMethodManager.java · dispatchInputEvent → ImeInputEventSender'),
    },
    {
      to: 495,
      move: 3,
      hold: 10,
      caption: '② SPACE：IME 选中第一个候选，commitText("你") 经 binder（oneway）发给应用；应用的 EditText 修改文字、下一帧重画。这里能看到 IME 进程和应用之间两条通道：InputChannel 传按键，binder 传编辑命令。',
      code: C('inputmethodservice/RemoteInputConnection.java · commitText', 'IRemoteInputConnection 是 oneway interface'),
    },
  ],
};

export const imeGraphStory: FlowStory = {
  steps: [
    {
      to: 128,
      view: [120, 200],
      move: 1.5,
      hold: 7,
      caption: '进入 IME 相关的对象：app 侧 InputMethodManager / ImeInputEventSender / RemoteInputConnectionImpl / EditableInputConnection，IME 进程侧 ImeInputEventReceiver / InputMethodSession / PinyinIME / RemoteInputConnection。',
      code: C('说明', 'app ↔ IME 的 InputChannel 在绑定输入法时建好'),
    },
    {
      to: 139.5,
      move: 2.5,
      hold: 9,
      focus: ['stage-ime', 'imm', 'ime-sender'],
      caption: 'ImeInputStage → ImeFocusController.onProcessImeInputStage → InputMethodManager.dispatchInputEvent：有会话，就用 ImeInputEventSender 写进 app ↔ IME 的 InputChannel，返回 DISPATCH_IN_PROGRESS——这一级异步挂起（defer），主线程先返回。',
      code: C('view/inputmethod/InputMethodManager.java · sendInputEventOnMainLooperLocked', 'mCurSender = new ImeInputEventSender(mCurChannel, …)\nmCurSender.sendInputEvent(seq, event)'),
    },
    {
      to: 165,
      move: 2.5,
      hold: 9,
      focus: ['ime-receiver', 'ime-session', 'pinyin-ime'],
      caption: 'IME 进程：ImeInputEventReceiver.onInputEvent → AbstractInputMethodSessionImpl.dispatchKeyEvent → event.dispatch(InputMethodService) → PinyinIME.onKeyDown → processKey：空闲状态收到字母，进入拼写、查候选、更新候选栏。',
      code: C('inputmethodservice/AbstractInputMethodService.java · dispatchKeyEvent', 'boolean handled = event.dispatch(…);\ncallback.finishedEvent(seq, handled);'),
    },
    {
      to: 180,
      move: 2,
      hold: 8,
      focus: ['ime-sender', 'imm', 'stage-ime'],
      caption: 'handled = true 经同一条 InputChannel 回到 app：ImeInputEventSender.onInputEventFinished → ImeInputStage.onFinishedInputEvent → finish，事件就此结束，不再交给 View 树；没处理的键才会 forward 到 ViewPostImeInputStage。',
      code: C('view/ViewRootImpl.java · ImeInputStage.onFinishedInputEvent', 'if (handled) { finish(q, true); return; }\nforward(q);'),
    },
    {
      to: 360,
      view: [330, 420],
      move: 3,
      hold: 9,
      focus: ['pinyin-ime', 'remote-ic'],
      caption: 'SPACE：PinyinIME 选中候选 → commitResultText("你") → InputConnection.commitText——IME 侧这个 InputConnection 是 RemoteInputConnection，经 oneway binder 发给应用。',
      code: C('PinyinIME.java · commitResultText → ic.commitText(resultText, 1)'),
    },
    {
      to: 437,
      view: [420, 490],
      move: 2.5,
      hold: 9,
      focus: ['remote-ic-impl', 'editable-ic', 'edit-text'],
      caption: '应用侧 RemoteInputConnectionImpl 在 binder 线程收到，切到主线程交给 EditText 的 EditableInputConnection：commitText → Editable.replace → 文字变化 → invalidate，下一帧重画。',
      code: C('view/inputmethod/RemoteInputConnectionImpl.java · commitText → dispatchWithTracing'),
    },
  ],
};
