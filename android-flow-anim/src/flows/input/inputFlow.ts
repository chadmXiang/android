import {batch, input, invoke, mark, msg, newInst, post, screen, set, socket, span, timeout} from '../../dsl/builders';
import type {FlowEvent, FlowScript, InstanceDef, LaneDef} from '../../dsl/types';
import {clsLane} from '../classes/lanes';

/**
 * touch / key 事件的完整响应（示意时序 ms，非实测）——界面上只有一个 Button。
 * 类名 / 方法名对照 frameworks/base + frameworks/native（inputflinger）源码；
 * 注：本机 native 树带厂商补丁（Banma Patch：逻辑屏 / 物理屏合并、融合窗口等），这里只画 AOSP 主干逻辑。
 *
 * 阶段：① addWindow 时建立 InputChannel、同步窗口信息与焦点
 *       ② touch DOWN：硬件 → InputReader → 监听链 → InputDispatcher 命中检测 → 应用 → InputStage → View 树 → 按下态
 *       ③ touch UP：沿用 TouchState → Button.onTouchEvent(UP) → post PerformClick → onClick → setText
 *       ④ 布局响应：requestLayout / invalidate 冒泡 → 下一帧 measure / layout / draw
 *       ⑤ key ENTER #1：触摸模式下第一下只"离开触摸模式"、Button 获得焦点（被消费，不点击）
 *       ⑥ key ENTER #2：焦点窗口 → InputStage（无输入法会话，ImeInputStage 直接放行）→ mFocused 链 → onKeyDown / onKeyUp → performClick
 */

const L = (id: string, cls: string, process: string, label?: string): LaneDef => ({...clsLane(id, cls, process, label), inst: id});
const I = (id: string, cls: string, process: string, group?: string, label?: string, fields?: Record<string, string>): InstanceDef => ({
  id,
  cls,
  process,
  group,
  label,
  fields,
});

export const SCREEN = {w: 1080, h: 2340};
export const TOUCH = {x: 540, y: 1180};

// ─────────── 可复用的链路片段 ───────────

/** ① 硬件 → InputReader → 监听链 → InputDispatcher 入队（约 14ms） */
export const readerChain = (t: number, kind: 'touch' | 'key', what: string, keyDesc = 'scanCode 28 → KEYCODE_ENTER（.kl）'): FlowEvent[] => {
  const touch = kind === 'touch';
  const mapper = touch ? 'tmapper' : 'kmapper';
  const notify = touch ? 'notifyMotion' : 'notifyKey';
  return [
    span('drv', t, t + 1, touch ? '中断 → evdev：ABS_MT_* · BTN_TOUCH · SYN_REPORT' : `中断 → evdev：EV_KEY · SYN_REPORT（${keyDesc.split(' →')[0]}）`, 'cpu'),
    msg(t + 1, 'drv', 'eventhub', touch ? '/dev/input/event2 可读（epoll）' : '/dev/input/event1 可读（epoll）'),
    span('reader', t + 1, t + 15, 'loopOnce', 'cpu'),
    invoke(t + 1, 'reader', 'eventhub', 'getEvents', t + 3),
    span('eventhub', t + 1, t + 3, 'epoll_wait 返回 → read(input_event × n)', 'cpu'),
    invoke(t + 4, 'reader', mapper, touch ? 'process → TouchInputMapper::sync' : 'process → processKey', t + 7),
    span(mapper, t + 4, t + 7, touch ? 'SYN_REPORT → dispatchMotion' : keyDesc, 'cpu'),
    mark(t + 6.5, mapper, touch ? `NotifyMotionArgs · ${what}` : `NotifyKeyArgs · ${what}`, 'info'),
    invoke(t + 8, 'reader', 'blocker', notify, t + 14.4),
    span('blocker', t + 8, t + 14.4, notify, 'cpu'),
    invoke(t + 9, 'blocker', 'pchoreo', notify, t + 14.2),
    span('pchoreo', t + 9, t + 14.2, notify, 'cpu'),
    invoke(t + 10, 'pchoreo', 'processor', notify, t + 14),
    span('processor', t + 10, t + 14, notify, 'cpu'),
    invoke(t + 11, 'processor', 'filter', notify, t + 13.8),
    span('filter', t + 11, t + 13.8, notify, 'cpu'),
    invoke(t + 12, 'filter', 'dispatcher', notify, t + 13.6),
    span('dispatcher', t + 12, t + 13.6, `${notify} → 策略 → 入队`, 'cpu'),
    ...(touch
      ? [
          invoke(t + 12.2, 'dispatcher', 'nim', 'interceptMotionBeforeQueueing', t + 13.2),
          span('nim', t + 12.2, t + 13.2, '亮屏 → POLICY_FLAG_PASS_TO_USER（不进 Java）', 'cpu'),
        ]
      : [
          invoke(t + 12.2, 'dispatcher', 'nim', 'interceptKeyBeforeQueueing', t + 13.4),
          span('nim', t + 12.2, t + 13.4, 'JNI → Java', 'cpu'),
          invoke(t + 12.4, 'nim', 'pwm', 'interceptKeyBeforeQueueing', t + 13.2),
          span('pwm', t + 12.4, t + 13.2, '普通键 → ACTION_PASS_TO_USER', 'cpu'),
        ]),
    mark(t + 13.5, 'dispatcher', 'enqueueInboundEventLocked → mLooper->wake()', 'info'),
  ];
};

/** ② InputDispatcher 线程：选目标窗口 → Connection → InputPublisher → socket（约 12ms） */
export const dispatchChain = (t: number, kind: 'touch-down' | 'touch-up' | 'key', what: string, finishedAt: number, id: string): FlowEvent[] => {
  const key = kind === 'key';
  return [
    span('dispatcher', t, t + 12, key ? 'dispatchOnce → dispatchKeyLocked' : 'dispatchOnce → dispatchMotionLocked', 'cpu'),
    ...(key
      ? [
          invoke(t + 0.5, 'dispatcher', 'nim', 'doInterceptKeyBeforeDispatchingCommand', t + 2.5),
          span('nim', t + 0.5, t + 2.5, 'interceptKeyBeforeDispatching（JNI）', 'cpu'),
          invoke(t + 0.8, 'nim', 'pwm', 'interceptKeyBeforeDispatching', t + 2.2),
          span('pwm', t + 0.8, t + 2.2, '不是系统键 → 0（继续派发）', 'cpu'),
          invoke(t + 3, 'dispatcher', 'focus', 'findFocusedWindowTargetLocked → getFocusedWindowToken', t + 6),
          span('focus', t + 3, t + 6, '焦点窗口 = com.foo/.MainActivity', 'cpu'),
        ]
      : kind === 'touch-down'
        ? [
            invoke(t + 1, 'dispatcher', 'tstate', 'findTouchedWindowTargets(DOWN)', t + 7),
            span('tstate', t + 1, t + 7, 'DOWN：命中检测 → 记进 TouchState', 'cpu'),
            invoke(t + 2, 'tstate', 'winfo', `findTouchedWindowAt(${TOUCH.x}, ${TOUCH.y})`, t + 6),
            span('winfo', t + 2, t + 6, 'Z 序前 → 后：windowAcceptsTouchAt', 'cpu'),
            set(t + 6.5, 'tstate', 'TouchState.windows', '[com.foo/.MainActivity]'),
          ]
        : [
            invoke(t + 1, 'dispatcher', 'tstate', 'findTouchedWindowTargets(UP)', t + 4),
            span('tstate', t + 1, t + 4, 'UP：不再命中检测，沿用 TouchState 里的窗口', 'cpu'),
            set(t + 4.5, 'tstate', 'TouchState.windows', '[]（手势结束后清空）'),
          ]),
    invoke(t + 8, 'dispatcher', 'conn', 'enqueueDispatchEntries → startDispatchCycleLocked', t + 12),
    span('conn', t + 8, t + 12, 'outboundQueue → waitQueue', 'cpu'),
    invoke(t + 9, 'conn', 'publisher', key ? 'publishKeyEvent' : 'publishMotionEvent', t + 11),
    span('publisher', t + 9, t + 11, 'InputMessage → sendMessage', 'cpu'),
    socket(t + 10.5, 'publisher', 'nier', `InputMessage · ${what}`),
    set(t + 11.5, 'conn', 'waitQueue', `[${what}]`),
    timeout(id, t + 11.5, 5000, 'conn', `${what} 等 finished（5s 输入超时）`, {cancelAt: finishedAt}),
    span('conn', finishedAt, finishedAt + 2, 'handleReceiveCallback → finishDispatchCycleLocked', 'cpu'),
    set(finishedAt + 1, 'conn', 'waitQueue', '[]'),
  ];
};

/**
 * ③ 应用主线程：Looper 唤醒 → NativeInputEventReceiver → InputConsumer → WindowInputEventReceiver → ViewRootImpl
 * → InputStage 链（InputStage.forward 里同步调用下一级，所以是嵌套的）。
 * stopAt = 'epost' 时在 EarlyPostImeInputStage 被消费；inner 是 ViewPostImeInputStage 里的 View 树事件。
 * 返回 [events, 发 finished 的时刻]。
 */
const appChain = (
  t: number,
  what: string,
  opts: {key: boolean; stopAt?: 'epost'; stopLabel?: string; innerDur: number; inner: (t0: number) => FlowEvent[]},
): [FlowEvent[], number] => {
  const stages = opts.stopAt === 'epost' ? ['npre', 'vpre', 'ime', 'epost'] : ['npre', 'vpre', 'ime', 'epost', 'npost', 'vpost'];
  const labels: Record<string, string> = {
    npre: opts.key ? '无 NativeActivity → forward' : 'MotionEvent → forward',
    vpre: opts.key ? 'dispatchKeyEventPreIme → 没人要 → forward' : 'forward',
    ime: '无输入法会话 → NOT_HANDLED → forward',
    epost: opts.stopAt === 'epost' ? opts.stopLabel ?? '' : opts.key ? '不在触摸模式 → forward' : 'DOWN → ensureTouchMode(true)',
    npost: 'forward',
    vpost: opts.key ? 'processKeyEvent → mView.dispatchKeyEvent' : 'processPointerEvent → mView.dispatchPointerEvent',
  };
  const s0 = t + 7;
  const innerStart = s0 + stages.length;
  const ie = innerStart + opts.innerDur; // View 树处理结束
  const fin = ie + 3; // 发出 finished
  const E = ie + 5 + stages.length; // 整条链返回
  const ev: FlowEvent[] = [
    mark(t, 'looper', 'fd 可读 → 唤醒主线程', 'info'),
    invoke(t + 1, 'looper', 'nier', 'handleEvent(ALOOPER_EVENT_INPUT)', E + 4),
    span('nier', t + 1, E + 4, 'handleEvent → consumeEvents', 'cpu'),
    invoke(t + 2, 'nier', 'consumer', 'consume', t + 4),
    span('consumer', t + 2, t + 4, `InputMessage → ${opts.key ? 'KeyEvent' : 'MotionEvent'}`, 'cpu'),
    invoke(t + 5, 'nier', 'wier', 'dispatchInputEvent → onInputEvent', E + 3),
    span('wier', t + 5, E + 3, `onInputEvent(${what})`, 'cpu'),
    invoke(t + 6, 'wier', 'vri', 'enqueueInputEvent → doProcessInputEvents', E + 2),
    span('vri', t + 6, E + 2, 'deliverInputEvent', 'cpu'),
  ];
  let prev = 'vri';
  stages.forEach((st, i) => {
    ev.push(invoke(s0 + i, prev, st, i === 0 ? 'mFirstInputStage.deliver' : 'forward → mNext.deliver', E + 1 - i * 0.1));
    ev.push(span(st, s0 + i, E + 1 - i * 0.1, labels[st], 'cpu'));
    prev = st;
  });
  ev.push(...opts.inner(innerStart));
  // 处理完：剩余阶段带 FLAG_FINISHED 往后走到 SyntheticInputStage → finishInputEvent → sendFinishedSignal
  ev.push(
    invoke(ie + 0.5, prev, 'syn', 'forward（FLAG_FINISHED）', ie + 4),
    span('syn', ie + 0.5, ie + 4, 'finish → finishInputEvent', 'cpu'),
    invoke(ie + 1, 'syn', 'nier', 'finishInputEvent(seq, handled=true)', ie + 3.6),
    invoke(ie + 1.6, 'nier', 'consumer', 'sendFinishedSignal', ie + 3.4),
    span('consumer', ie + 1.6, ie + 3.4, 'FINISHED → socket', 'cpu'),
    socket(fin, 'consumer', 'conn', `InputMessage · FINISHED（${what}）`),
  );
  return [ev, fin];
};

// ─────────── 各次输入里 View 树的部分 ───────────

/** touch DOWN：DecorView → Activity → PhoneWindow → DecorView(super) → FrameLayout → LinearLayout → Button.onTouchEvent */
const touchDownTree = (t: number): FlowEvent[] => [
  invoke(t, 'vpost', 'decor', 'dispatchPointerEvent → dispatchTouchEvent', t + 20),
  span('decor', t, t + 20, 'DecorView.dispatchTouchEvent', 'cpu'),
  invoke(t + 1, 'decor', 'act', 'Window.Callback → Activity.dispatchTouchEvent', t + 19),
  span('act', t + 1, t + 19, 'dispatchTouchEvent', 'cpu'),
  invoke(t + 2, 'act', 'pwin', 'superDispatchTouchEvent', t + 18),
  span('pwin', t + 2, t + 18, 'superDispatchTouchEvent', 'cpu'),
  invoke(t + 3, 'pwin', 'decor', 'superDispatchTouchEvent → ViewGroup.dispatchTouchEvent', t + 17),
  invoke(t + 4, 'decor', 'content', 'dispatchTransformedTouchEvent', t + 16),
  span('content', t + 4, t + 16, 'onInterceptTouchEvent = false → 找命中的子 View', 'cpu'),
  invoke(t + 5, 'content', 'root', 'dispatchTransformedTouchEvent', t + 15),
  span('root', t + 5, t + 15, 'isTransformedTouchPointInView → Button', 'cpu'),
  invoke(t + 6, 'root', 'button', 'dispatchTouchEvent → onTouchEvent(DOWN)', t + 14),
  span('button', t + 6, t + 14, 'onTouchEvent(DOWN)', 'cpu'),
  // 父容器都不延迟按下态（shouldDelayChildPressedState = false）→ 立即 setPressed(true)
  set(t + 7, 'button', 'isPressed()', 'true'),
  set(t + 7.2, 'button', 'PFLAG_DIRTY', 'true'),
  invoke(t + 8, 'button', 'root', 'invalidate → invalidateChild', t + 12),
  invoke(t + 8.5, 'root', 'content', 'onDescendantInvalidated', t + 11.5),
  invoke(t + 9, 'content', 'decor', 'onDescendantInvalidated', t + 11),
  invoke(t + 9.5, 'decor', 'vri', 'onDescendantInvalidated → invalidate', t + 10.5),
  mark(t + 10.2, 'vri', 'scheduleTraversals（下一帧重画）', 'info'),
  set(t + 15.2, 'root', 'mFirstTouchTarget', 'button'),
  set(t + 16.2, 'content', 'mFirstTouchTarget', 'root'),
  set(t + 17.2, 'decor', 'mFirstTouchTarget', 'content'),
];

/** touch UP：沿 mFirstTouchTarget 直接下发；Button 在 UP 里 post PerformClick 与 UnsetPressedState */
const touchUpTree = (t: number): FlowEvent[] => [
  invoke(t, 'vpost', 'decor', 'dispatchPointerEvent → dispatchTouchEvent', t + 14),
  span('decor', t, t + 14, 'dispatchTouchEvent → … → mFirstTouchTarget', 'cpu'),
  invoke(t + 1, 'decor', 'content', 'mFirstTouchTarget → dispatchTransformedTouchEvent', t + 13),
  span('content', t + 1, t + 13, '沿 mFirstTouchTarget（不再命中检测）', 'cpu'),
  invoke(t + 2, 'content', 'root', 'mFirstTouchTarget → dispatchTransformedTouchEvent', t + 12),
  span('root', t + 2, t + 12, '沿 mFirstTouchTarget', 'cpu'),
  invoke(t + 3, 'root', 'button', 'dispatchTouchEvent → onTouchEvent(UP)', t + 11),
  span('button', t + 3, t + 11, 'onTouchEvent(UP)', 'cpu'),
  post(t + 5, 'button', 'looper', 'PerformClick（post）', t + UP_CLICK),
  post(t + 6, 'button', 'looper', 'UnsetPressedState（postDelayed）', t + UP_UNPRESS),
  set(t + 13.5, 'root', 'mFirstTouchTarget', 'null'),
  set(t + 13.6, 'content', 'mFirstTouchTarget', 'null'),
  set(t + 13.7, 'decor', 'mFirstTouchTarget', 'null'),
];

const UP_CLICK = 40; // PerformClick 被 Looper 取出（相对 UP 进入 View 树的时刻）
const UP_UNPRESS = 130; // UnsetPressedState（postDelayed）被取出

/** touch：post 出去的 PerformClick 被主线程取出后执行 */
const clickTree = (t: number, text: string): FlowEvent[] => [
  invoke(t, 'looper', 'button', 'PerformClick.run → performClickInternal → performClick', t + 20),
  span('button', t, t + 20, 'performClick', 'cpu'),
  ...clickInline(t + 1, text),
];

/** performClick → onClick → setText → requestLayout + invalidate 一路冒泡到 ViewRootImpl（18ms） */
const clickInline = (t0: number, text: string): FlowEvent[] => {
  const t = t0 - 1;
  return [
  invoke(t + 1, 'button', 'listener', 'mOnClickListener.onClick', t + 19),
  span('listener', t + 1, t + 19, `onClick → button.setText("${text}")`, 'cpu'),
  invoke(t + 2, 'listener', 'button', 'setText → checkForRelayout', t + 18),
  set(t + 3, 'button', 'mText', text),
  set(t + 4, 'button', 'PFLAG_FORCE_LAYOUT', 'true'),
  set(t + 4.1, 'button', 'PFLAG_DIRTY', 'true'),
  invoke(t + 5, 'button', 'root', 'requestLayout（mParent.requestLayout）', t + 16),
  set(t + 6, 'root', 'PFLAG_FORCE_LAYOUT', 'true'),
  invoke(t + 6.5, 'root', 'content', 'requestLayout', t + 15),
  set(t + 7.5, 'content', 'PFLAG_FORCE_LAYOUT', 'true'),
  invoke(t + 8, 'content', 'decor', 'requestLayout', t + 14),
  set(t + 9, 'decor', 'PFLAG_FORCE_LAYOUT', 'true'),
  invoke(t + 9.5, 'decor', 'vri', 'requestLayout', t + 13),
  set(t + 10.5, 'vri', 'mLayoutRequested', 'true'),
  mark(t + 11, 'vri', 'scheduleTraversals：同步屏障 + Choreographer TRAVERSAL', 'info'),
  ];
};

/** 下一帧：performTraversals → measure / layout / draw 自上而下 */
const traversal = (t: number, layout: boolean, label: string): FlowEvent[] => {
  const ev: FlowEvent[] = [
    span('chor', t, t + 1, 'doFrame · CALLBACK_TRAVERSAL', 'cpu'),
    invoke(t + 1, 'chor', 'vri', 'performTraversals', t + (layout ? 34 : 14)),
    span('vri', t + 1, t + (layout ? 34 : 14), layout ? 'performTraversals · measure → layout → draw' : 'performTraversals · 只 draw', 'cpu'),
  ];
  const pass = (start: number, name: string, flag?: string) => {
    ev.push(
      invoke(start, 'vri', 'decor', name, start + 8),
      invoke(start + 1, 'decor', 'content', name, start + 7),
      invoke(start + 2, 'content', 'root', name, start + 6),
      invoke(start + 3, 'root', 'button', name, start + 5),
      span('button', start + 3, start + 5, `${name}（Button）`, 'cpu'),
    );
    if (flag) ['button', 'root', 'content', 'decor'].forEach((v, i) => ev.push(set(start + 5 + i * 0.6, v, flag, 'false')));
  };
  if (layout) {
    pass(t + 2, 'measure → onMeasure');
    pass(t + 11, 'layout → onLayout', 'PFLAG_FORCE_LAYOUT');
    ev.push(set(t + 19.5, 'vri', 'mLayoutRequested', 'false'));
    pass(t + 21, 'draw → updateDisplayListIfDirty', 'PFLAG_DIRTY');
  } else {
    pass(t + 2, 'draw → updateDisplayListIfDirty', 'PFLAG_DIRTY');
  }
  const end = t + (layout ? 34 : 14);
  ev.push(batch(end - 1, 'vri', 'sf', `RenderThread → setBuffer（${label}）`), span('sf', end, end + 8, `latch → 合成：${label}`, 'sf'));
  return ev;
};

/**
 * key 在 View 树：DecorView → Activity → PhoneWindow → DecorView(super) → ViewGroup 沿 mFocused → Button。
 * onKeyUp 里是同步调用 performClickInternal（不像 touch 那样 post），所以点击发生在这次按键分发之内。
 * 返回 [events, 时长]。
 */
const keyTree = (t: number, down: boolean, text?: string): [FlowEvent[], number] => {
  const body = down ? 6 : 22;
  const b0 = t + 6;
  const b1 = b0 + body;
  const ev: FlowEvent[] = [
    invoke(t, 'vpost', 'decor', 'dispatchKeyEvent', b1 + 6),
    span('decor', t, b1 + 6, 'DecorView.dispatchKeyEvent', 'cpu'),
    invoke(t + 1, 'decor', 'act', 'Activity.dispatchKeyEvent', b1 + 5),
    span('act', t + 1, b1 + 5, 'dispatchKeyEvent', 'cpu'),
    invoke(t + 2, 'act', 'pwin', 'superDispatchKeyEvent', b1 + 4),
    span('pwin', t + 2, b1 + 4, 'superDispatchKeyEvent', 'cpu'),
    invoke(t + 3, 'pwin', 'decor', 'superDispatchKeyEvent → ViewGroup.dispatchKeyEvent', b1 + 3),
    invoke(t + 4, 'decor', 'content', 'mFocused.dispatchKeyEvent', b1 + 2),
    span('content', t + 4, b1 + 2, '不看坐标：沿 mFocused 往下', 'cpu'),
    invoke(t + 5, 'content', 'root', 'mFocused.dispatchKeyEvent', b1 + 1),
    span('root', t + 5, b1 + 1, '沿 mFocused 往下', 'cpu'),
    invoke(b0, 'root', 'button', down ? 'dispatchKeyEvent → KeyEvent.dispatch → onKeyDown' : 'dispatchKeyEvent → KeyEvent.dispatch → onKeyUp', b1),
    span('button', b0, b1, down ? 'onKeyDown：isConfirmKey → setPressed(true)' : 'onKeyUp：isPressed → setPressed(false) → performClickInternal', 'cpu'),
  ];
  if (down) ev.push(set(b0 + 2, 'button', 'isPressed()', 'true'), set(b0 + 2.2, 'button', 'PFLAG_DIRTY', 'true'));
  else ev.push(set(b0 + 1, 'button', 'isPressed()', 'false'), ...clickInline(b0 + 2, text ?? ''));
  return [ev, b1 + 7 - t];
};

// ─────────── 时间轴 ───────────
const T_DOWN = 200;
const T_UP = 400;
const T_K1 = 800;
const T_K2 = 1000;
const T_K2UP = 1100;

const [downApp, downFin] = appChain(T_DOWN + 29, 'MOTION DOWN', {key: false, innerDur: 21, inner: touchDownTree});
const [upApp, upFin] = appChain(T_UP + 29, 'MOTION UP', {key: false, innerDur: 15, inner: touchUpTree});
/** UP 进入 View 树的时刻（appChain：+7 起 6 级 InputStage） */
const UP_TREE = T_UP + 29 + 7 + 6;
const [k1App, k1Fin] = appChain(T_K1 + 29, 'KEY ENTER ↓（#1）', {
  key: true,
  stopAt: 'epost',
  stopLabel: '触摸模式下的导航键 → checkForLeavingTouchModeAndConsume → ensureTouchMode(false) → 消费',
  innerDur: 12,
  inner: (t) => [
    mark(t, 'epost', '离开触摸模式：Button 可获焦 → requestFocus', 'warn'),
    set(t + 2, 'button', 'isFocused()', 'true'),
    set(t + 2.5, 'root', 'mFocused', 'button'),
    set(t + 3, 'content', 'mFocused', 'root'),
    set(t + 3.5, 'decor', 'mFocused', 'content'),
    set(t + 4, 'button', 'PFLAG_DIRTY', 'true'),
    mark(t + 6, 'epost', 'FINISH_HANDLED：这一下不点击', 'warn'),
  ],
});
const k2DownDur = keyTree(0, true)[1];
const [k2App, k2Fin] = appChain(T_K2 + 29, 'KEY ENTER ↓（#2）', {key: true, innerDur: k2DownDur, inner: (t) => keyTree(t, true)[0]});
const k2UpDur = keyTree(0, false, '已点击 2 次')[1];
const [k2UpApp, k2UpFin] = appChain(T_K2UP + 29, 'KEY ENTER ↑（#2）', {key: true, innerDur: k2UpDur, inner: (t) => keyTree(t, false, '已点击 2 次')[0]});

export const inputFlowScript: FlowScript = {
  id: 'input-flow',
  kind: 'process',
  title: 'touch / key 事件的完整响应',
  subtitle: '示意时序 · 界面上只有一个 Button · 类名 / 方法名对照 base + native 源码',
  window: [-10, 1260],
  processes: [
    {id: 'kernel', label: 'Linux 内核 · 输入驱动', layer: 'kernel'},
    {id: 'system_server', label: 'system_server（inputflinger 也在这里）', layer: 'system_server'},
    {id: 'sfp', label: 'surfaceflinger', layer: 'native'},
    {id: 'foo', label: 'com.foo', layer: 'app'},
  ],
  chapters: [
    {id: 'c1', title: '① 建立通道', start: 0, end: 100},
    {id: 'c2', title: '② touch DOWN', start: 100, end: 330},
    {id: 'c3', title: '③ touch UP → click', start: 330, end: 510},
    {id: 'c4', title: '④ 布局响应 · 下一帧', start: 510, end: 700},
    {id: 'c5', title: '⑤ ENTER #1 · 离开触摸模式', start: 700, end: 950},
    {id: 'c6', title: '⑥ ENTER #2 · 点击', start: 950, end: 1260},
  ],
  lanes: [
    {id: 'drv', label: '触摸屏 / 键盘驱动', sub: 'evdev → /dev/input/event*', process: 'kernel'},
    L('eventhub', 'event-hub', 'system_server'),
    L('reader', 'input-reader', 'system_server', 'InputReader（线程）'),
    L('tmapper', 'mt-mapper', 'system_server'),
    L('kmapper', 'key-mapper', 'system_server'),
    L('blocker', 'unwanted-blocker', 'system_server'),
    L('pchoreo', 'pointer-choreographer', 'system_server'),
    L('processor', 'input-processor', 'system_server'),
    L('filter', 'input-filter', 'system_server'),
    L('dispatcher', 'input-dispatcher', 'system_server', 'InputDispatcher（线程）'),
    L('nim', 'native-input-manager', 'system_server'),
    L('pwm', 'pwm', 'system_server'),
    L('winfo', 'window-info', 'system_server'),
    L('tstate', 'touch-state', 'system_server'),
    L('focus', 'focus-resolver', 'system_server'),
    L('conn', 'connection', 'system_server', 'Connection · com.foo'),
    L('publisher', 'input-publisher', 'system_server'),
    L('ims', 'ims', 'system_server'),
    L('wms', 'wms', 'system_server'),
    L('ws', 'window-state', 'system_server', 'WindowState · com.foo'),
    L('imon', 'input-monitor', 'system_server'),
    L('session', 'session', 'system_server', 'Session · com.foo'),
    {id: 'sf', label: 'SurfaceFlinger', sub: 'commit · windowInfos · composite', process: 'sfp'},
    L('vri', 'view-root-impl', 'foo'),
    L('looper', 'looper', 'foo', 'Looper（主线程）'),
    L('nier', 'nier', 'foo'),
    L('consumer', 'input-consumer', 'foo'),
    L('wier', 'wier', 'foo'),
    L('npre', 'stage-native-pre', 'foo'),
    L('vpre', 'stage-view-pre', 'foo'),
    L('ime', 'stage-ime', 'foo'),
    L('epost', 'stage-early-post', 'foo'),
    L('npost', 'stage-native-post', 'foo'),
    L('vpost', 'stage-view-post', 'foo'),
    L('syn', 'stage-synthetic', 'foo'),
    L('decor', 'decor-view', 'foo'),
    L('act', 'activity', 'foo', 'MainActivity'),
    L('pwin', 'phone-window', 'foo'),
    L('content', 'frame-layout', 'foo', 'FrameLayout · android:id/content'),
    L('root', 'linear-layout', 'foo', 'LinearLayout · 布局根'),
    L('button', 'button', 'foo'),
    L('listener', 'click-listener', 'foo'),
    L('chor', 'choreographer', 'foo'),
  ],
  resources: [],
  instances: [
    // system_server：WMS 侧（建通道）
    I('wms', 'wms', 'system_server', 'WMS / IMS'),
    I('session', 'session', 'system_server', 'WMS / IMS', 'com.foo'),
    I('ws', 'window-state', 'system_server', 'WMS / IMS', 'com.foo'),
    I('imon', 'input-monitor', 'system_server', 'WMS / IMS'),
    I('ims', 'ims', 'system_server', 'WMS / IMS'),
    // InputReader 线程
    I('eventhub', 'event-hub', 'system_server', 'InputReader 线程'),
    I('reader', 'input-reader', 'system_server', 'InputReader 线程'),
    I('tmapper', 'mt-mapper', 'system_server', 'InputReader 线程', '触摸屏'),
    I('kmapper', 'key-mapper', 'system_server', 'InputReader 线程', '键盘'),
    I('blocker', 'unwanted-blocker', 'system_server', '监听链'),
    I('pchoreo', 'pointer-choreographer', 'system_server', '监听链'),
    I('processor', 'input-processor', 'system_server', '监听链'),
    I('filter', 'input-filter', 'system_server', '监听链'),
    // InputDispatcher 线程
    I('dispatcher', 'input-dispatcher', 'system_server', 'InputDispatcher 线程'),
    I('winfo', 'window-info', 'system_server', 'InputDispatcher 线程', undefined, {窗口列表: '（等 SurfaceFlinger 下发）'}),
    I('tstate', 'touch-state', 'system_server', 'InputDispatcher 线程'),
    I('focus', 'focus-resolver', 'system_server', 'InputDispatcher 线程'),
    I('ich-server', 'input-channel', 'system_server', 'InputDispatcher 线程', '服务端'),
    I('conn', 'connection', 'system_server', 'InputDispatcher 线程', 'com.foo'),
    I('publisher', 'input-publisher', 'system_server', 'InputDispatcher 线程'),
    I('nim', 'native-input-manager', 'system_server', '策略'),
    I('pwm', 'pwm', 'system_server', '策略'),
    // com.foo：接收
    I('vri', 'view-root-impl', 'foo', '接收', undefined, {mLayoutRequested: 'false'}),
    I('ich', 'input-channel', 'foo', '接收', '客户端'),
    I('looper', 'looper', 'foo', '接收', 'main'),
    I('wier', 'wier', 'foo', '接收'),
    I('nier', 'nier', 'foo', '接收'),
    I('consumer', 'input-consumer', 'foo', '接收'),
    // InputStage 链
    I('npre', 'stage-native-pre', 'foo', 'InputStage 链', '①'),
    I('vpre', 'stage-view-pre', 'foo', 'InputStage 链', '②'),
    I('ime', 'stage-ime', 'foo', 'InputStage 链', '③'),
    I('epost', 'stage-early-post', 'foo', 'InputStage 链', '④'),
    I('npost', 'stage-native-post', 'foo', 'InputStage 链', '⑤'),
    I('vpost', 'stage-view-post', 'foo', 'InputStage 链', '⑥'),
    I('syn', 'stage-synthetic', 'foo', 'InputStage 链', '⑦'),
    // View 树（bounds 单位 px，屏幕 1080 × 2340；mParent 决定树形）
    I('act', 'activity', 'foo', '窗口外壳', 'MainActivity'),
    I('pwin', 'phone-window', 'foo', '窗口外壳'),
    I('decor', 'decor-view', 'foo', 'View 树', undefined, {mParent: 'vri', bounds: '0,0,1080,2340'}),
    I('content', 'frame-layout', 'foo', 'View 树', 'android:id/content', {mParent: 'decor', bounds: '0,128,1080,2214'}),
    I('root', 'linear-layout', 'foo', 'View 树', '布局根', {mParent: 'content', bounds: '0,128,1080,2214'}),
    I('button', 'button', 'foo', 'View 树', undefined, {mParent: 'root', bounds: '340,1100,740,1260', mText: '点我', 'isPressed()': 'false', 'isFocused()': 'false'}),
    I('listener', 'click-listener', 'foo', '窗口外壳'),
    I('chor', 'choreographer', 'foo', '窗口外壳', 'main'),
  ],
  events: [
    screen(-10, 'btn'),
    // ═══ ① 建立通道：addWindow 时 ═══
    span('vri', 0, 34, 'setView', 'cpu'),
    newInst(1, 'vri', 'ich'),
    mark(1, 'vri', 'inputChannel = new InputChannel()（空壳）', 'info'),
    invoke(2, 'vri', 'session', 'IWindowSession.addToDisplayAsUser(…, outInputChannel)', 26),
    span('session', 2, 26, 'addToDisplayAsUser', 'cpu'),
    invoke(3, 'session', 'wms', 'addWindow', 25),
    span('wms', 3, 25, 'addWindow', 'cpu'),
    invoke(6, 'wms', 'ws', 'openInputChannel(outInputChannel)', 18),
    span('ws', 6, 18, 'openInputChannel', 'cpu'),
    invoke(7, 'ws', 'ims', 'createInputChannel(name)', 15),
    span('ims', 7, 15, 'createInputChannel → nativeCreateInputChannel', 'cpu'),
    invoke(8, 'ims', 'dispatcher', 'InputDispatcher::createInputChannel', 14),
    span('dispatcher', 8, 14, 'openInputChannelPair → socketpair(SOCK_SEQPACKET)', 'cpu'),
    newInst(9, 'dispatcher', 'ich-server'),
    newInst(10, 'dispatcher', 'conn'),
    newInst(10.5, 'conn', 'publisher', 'inputPublisher'),
    set(11, 'publisher', 'mChannel', 'ich-server'),
    mark(12, 'dispatcher', 'mLooper->addFd(服务端 fd) → handleReceiveCallback', 'info'),
    set(16, 'ws', 'mInputChannelToken', 'channel.getToken()'),
    set(16.5, 'ws', 'mInputWindowHandle.token', '同一个 token'),
    set(17, 'ich', 'fd', '客户端 fd（copyTo，经 binder 回传）'),
    invoke(27.5, 'vri', 'wier', 'new WindowInputEventReceiver(inputChannel, Looper.myLooper())', 30),
    span('wier', 28, 30, 'InputEventReceiver 构造 → nativeInit', 'cpu'),
    newInst(28, 'vri', 'wier', 'mInputEventReceiver'),
    invoke(28.5, 'wier', 'nier', 'nativeInit → new NativeInputEventReceiver', 29.9),
    newInst(28.5, 'wier', 'nier'),
    newInst(29, 'nier', 'consumer', 'mInputConsumer'),
    set(29.2, 'consumer', 'mChannel', 'ich'),
    set(29.5, 'looper', '监听 fd', 'InputChannel（客户端）'),
    mark(29.5, 'nier', 'Looper.addFd(客户端 fd, ALOOPER_EVENT_INPUT)', 'info'),
    // setUpInputStages：从后往前 new，mNext 串起来
    invoke(30, 'vri', 'syn', 'setUpInputStages：从后往前 new 7 个 InputStage', 32.6),
    newInst(30, 'vri', 'syn'),
    newInst(30.3, 'vri', 'vpost'),
    set(30.3, 'vpost', 'mNext', 'syn'),
    newInst(30.6, 'vri', 'npost'),
    set(30.6, 'npost', 'mNext', 'vpost'),
    newInst(30.9, 'vri', 'epost'),
    set(30.9, 'epost', 'mNext', 'npost'),
    newInst(31.2, 'vri', 'ime'),
    set(31.2, 'ime', 'mNext', 'epost'),
    newInst(31.5, 'vri', 'vpre'),
    set(31.5, 'vpre', 'mNext', 'ime'),
    newInst(31.8, 'vri', 'npre'),
    set(31.8, 'npre', 'mNext', 'vpre'),
    set(32.2, 'vri', 'mFirstInputStage', 'npre'),
    // 窗口信息：WMS → SurfaceFlinger → InputDispatcher（不是 WMS 直接给 InputDispatcher）
    invoke(40, 'wms', 'imon', 'updateInputWindowsLw', 47),
    span('imon', 40, 47, 'setInputWindowInfoIfNeeded · requestFocus', 'cpu'),
    batch(46, 'imon', 'sf', 'Transaction：setInputWindowInfo + setFocusedWindow'),
    span('sf', 48, 54, 'commit → 汇总 windowInfos', 'sf'),
    msg(54, 'sf', 'dispatcher', 'WindowInfosListener.onWindowInfosChanged'),
    span('dispatcher', 54, 58, 'onWindowInfosChanged → setInputWindowsLocked', 'cpu'),
    set(57, 'winfo', '窗口列表', '[NavigationBar, StatusBar, com.foo/.MainActivity, Wallpaper]'),
    msg(60, 'sf', 'dispatcher', 'setFocusedWindow(FocusRequest)'),
    span('dispatcher', 60, 66, 'setFocusedWindow', 'cpu'),
    invoke(61, 'dispatcher', 'focus', 'setFocusedWindow → isTokenFocusable', 65),
    span('focus', 61, 65, '存在 · 可见 · 可获焦 → OK', 'cpu'),
    set(64, 'focus', '焦点窗口', 'com.foo/.MainActivity'),
    socket(67, 'publisher', 'nier', 'InputMessage · FOCUS(hasFocus=true)'),
    span('nier', 69, 72, 'consumeEvents → onFocusEvent', 'cpu'),
    mark(72, 'vri', 'windowFocusChanged(true) · 进入触摸模式', 'ok'),

    // ═══ ② touch DOWN ═══
    input(T_DOWN, 'drv', 'touch-down', `手指按下 (${TOUCH.x}, ${TOUCH.y})`),
    ...readerChain(T_DOWN, 'touch', 'ACTION_DOWN'),
    ...dispatchChain(T_DOWN + 16, 'touch-down', 'MOTION DOWN', downFin, 'anr-down'),
    ...downApp,
    ...traversal(290, false, '按下态'),
    screen(312, 'btn-pressed'),

    // ═══ ③ touch UP ═══
    input(T_UP, 'drv', 'touch-up', '手指抬起'),
    ...readerChain(T_UP, 'touch', 'ACTION_UP'),
    ...dispatchChain(T_UP + 16, 'touch-up', 'MOTION UP', upFin, 'anr-up'),
    ...upApp,
    ...clickTree(UP_TREE + UP_CLICK, '已点击 1 次'),

    // ═══ ④ 布局响应：下一帧 measure / layout / draw；之后按下态解除再画一帧 ═══
    ...traversal(520, true, '新文字'),
    screen(562, 'btn-clicked-pressed'),
    invoke(UP_TREE + UP_UNPRESS, 'looper', 'button', 'UnsetPressedState.run → setPressed(false)', UP_TREE + UP_UNPRESS + 5),
    span('button', UP_TREE + UP_UNPRESS, UP_TREE + UP_UNPRESS + 5, 'setPressed(false) → invalidate', 'cpu'),
    set(UP_TREE + UP_UNPRESS + 1, 'button', 'isPressed()', 'false'),
    set(UP_TREE + UP_UNPRESS + 1.2, 'button', 'PFLAG_DIRTY', 'true'),
    ...traversal(590, false, '松开'),
    screen(612, 'btn-clicked'),

    // ═══ ⑤ ENTER #1：触摸模式下只离开触摸模式 ═══
    input(T_K1, 'drv', 'key-down', 'ENTER ↓（第 1 下）', 'enter'),
    ...readerChain(T_K1, 'key', 'KEYCODE_ENTER ↓'),
    ...dispatchChain(T_K1 + 16, 'key', 'KEY ENTER ↓（#1）', k1Fin, 'anr-k1'),
    ...k1App,
    ...traversal(880, false, '焦点框'),
    screen(904, 'btn-focused'),

    // ═══ ⑥ ENTER #2：按下 / 抬起 → performClick ═══
    input(T_K2, 'drv', 'key-down', 'ENTER ↓（第 2 下）', 'enter'),
    ...readerChain(T_K2, 'key', 'KEYCODE_ENTER ↓'),
    ...dispatchChain(T_K2 + 16, 'key', 'KEY ENTER ↓（#2）', k2Fin, 'anr-k2'),
    ...k2App,
    ...traversal(1080, false, '按下态'),
    screen(1102, 'btn-key-pressed'),
    input(T_K2UP, 'drv', 'key-up', 'ENTER ↑（第 2 下）', 'enter'),
    ...readerChain(T_K2UP, 'key', 'KEYCODE_ENTER ↑'),
    ...dispatchChain(T_K2UP + 16, 'key', 'KEY ENTER ↑（#2）', k2UpFin, 'anr-k2up'),
    ...k2UpApp,
    ...traversal(Math.ceil(k2UpFin / 10) * 10 + 20, true, '新文字'),
    screen(Math.ceil(k2UpFin / 10) * 10 + 62, 'btn-key-clicked'),
  ],
};

