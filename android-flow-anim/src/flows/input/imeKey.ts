import {batch, input, invoke, mark, oneway, post, screen, set, socket, span} from '../../dsl/builders';
import type {FlowEvent, FlowScript, InstanceDef, LaneDef} from '../../dsl/types';
import {clsLane} from '../classes/lanes';
import {dispatchChain, inputFlowScript, readerChain} from './inputFlow';

/**
 * key + 输入法（对照场景）：同一界面多一个获得焦点的 EditText，软键盘显示（以 AOSP PinyinIME 为例）。
 * 只有窗口有输入法会话时，ImeInputStage 才会把按键先交给 IME；只有一个 Button 的界面没有会话，按键直接往下走。
 *
 *   app ImeInputStage → InputMethodManager.dispatchInputEvent → ImeInputEventSender（app ↔ IME 之间单独的 InputChannel）
 *   → IME 进程 ImeInputEventReceiver → AbstractInputMethodSessionImpl.dispatchKeyEvent → event.dispatch → PinyinIME.onKeyDown
 *   → finishedEvent(handled) → app ImeInputStage.onFinishedInputEvent：handled 则 finish，否则继续往下（ViewPostIme → EditText）
 *   提交文字：PinyinIME.commitResultText → RemoteInputConnection.commitText（IRemoteInputConnection 是 oneway）
 *   → app RemoteInputConnectionImpl（binder 线程）→ 主线程 EditableInputConnection.commitText → Editable.replace → 重绘
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

/** 复用主脚本的 system_server / 接收侧泳道与实例 */
const KEEP = [
  'drv', 'eventhub', 'reader', 'kmapper', 'blocker', 'pchoreo', 'processor', 'filter',
  'dispatcher', 'nim', 'pwm', 'focus', 'conn', 'publisher', 'sf',
  'looper', 'nier', 'consumer', 'wier', 'vri', 'npre', 'vpre', 'ime', 'syn', 'chor',
];

/** 应用收到按键 → InputStage → ImeInputStage 发给 IME（DISPATCH_IN_PROGRESS，主线程先返回） */
const toIme = (t: number, what: string): FlowEvent[] => [
  mark(t, 'looper', 'fd 可读 → 唤醒主线程', 'info'),
  invoke(t + 1, 'looper', 'nier', 'handleEvent', t + 16),
  span('nier', t + 1, t + 16, 'handleEvent → consumeEvents', 'cpu'),
  invoke(t + 2, 'nier', 'consumer', 'consume', t + 3),
  span('consumer', t + 2, t + 3, 'InputMessage → KeyEvent', 'cpu'),
  invoke(t + 4, 'nier', 'wier', 'dispatchInputEvent → onInputEvent', t + 15),
  span('wier', t + 4, t + 15, `onInputEvent(${what})`, 'cpu'),
  invoke(t + 5, 'wier', 'vri', 'enqueueInputEvent → doProcessInputEvents', t + 14),
  span('vri', t + 5, t + 14, 'deliverInputEvent', 'cpu'),
  invoke(t + 6, 'vri', 'npre', 'mFirstInputStage.deliver', t + 13.6),
  span('npre', t + 6, t + 13.6, 'forward', 'cpu'),
  invoke(t + 6.5, 'npre', 'vpre', 'forward → mNext.deliver', t + 13.3),
  span('vpre', t + 6.5, t + 13.3, 'dispatchKeyEventPreIme → forward', 'cpu'),
  invoke(t + 7, 'vpre', 'ime', 'forward → mNext.deliver', t + 13),
  span('ime', t + 7, t + 13, 'onProcessImeInputStage → 有输入法会话', 'cpu'),
  invoke(t + 8, 'ime', 'imm', 'dispatchInputEvent', t + 12),
  span('imm', t + 8, t + 12, 'dispatchInputEvent → sendInputEventOnMainLooperLocked', 'cpu'),
  invoke(t + 9, 'imm', 'ime-sender', 'sendInputEvent', t + 11),
  span('ime-sender', t + 9, t + 11, 'InputEventSender → socket', 'cpu'),
  socket(t + 10, 'ime-sender', 'ime-receiver', `InputMessage · ${what}（app → IME）`),
  mark(t + 12.5, 'ime', 'DISPATCH_IN_PROGRESS → defer：等 IME 的结果，主线程先返回', 'warn'),
];

/** IME 处理完 → finished(handled) 回到 app → ImeInputStage 结束这次事件 → 回 InputDispatcher */
const backFromIme = (t: number, what: string): FlowEvent[] => [
  socket(t, 'ime-receiver', 'ime-sender', 'InputMessage · FINISHED(handled=true)（IME → app）'),
  invoke(t + 2, 'looper', 'ime-sender', 'onInputEventFinished(handled=true)', t + 14),
  span('ime-sender', t + 2, t + 14, 'onInputEventFinished', 'cpu'),
  invoke(t + 3, 'ime-sender', 'imm', 'finishedInputEvent → invokeFinishedInputEventCallback', t + 13),
  span('imm', t + 3, t + 13, 'finishedInputEvent', 'cpu'),
  invoke(t + 4, 'imm', 'ime', 'onFinishedInputEvent(handled=true)', t + 12),
  span('ime', t + 4, t + 12, 'handled → finish(q, true)：不再交给 View 树', 'cpu'),
  invoke(t + 5, 'ime', 'syn', 'forward（FLAG_FINISHED）', t + 11),
  span('syn', t + 5, t + 11, 'finish → finishInputEvent', 'cpu'),
  invoke(t + 6, 'syn', 'nier', 'finishInputEvent(seq, handled=true)', t + 10),
  invoke(t + 7, 'nier', 'consumer', 'sendFinishedSignal', t + 9),
  span('consumer', t + 7, t + 9, 'FINISHED → socket', 'cpu'),
  socket(t + 8.5, 'consumer', 'conn', `InputMessage · FINISHED（${what}）`),
];

const T_N = 100;
const T_SP = 300;
/** FINISHED 回到 InputDispatcher 的时刻 = backFromIme 起点 + 8.5 */
const N_FIN = T_N + 74 + 8.5;
const SP_FIN = T_SP + 94 + 8.5;

export const imeKeyScript: FlowScript = {
  id: 'ime-key',
  kind: 'process',
  title: 'key + 输入法：按键先给 IME',
  subtitle: '对照场景：界面多一个获得焦点的 EditText，软键盘显示 · 以 AOSP PinyinIME 为例 · 示意时序',
  window: [-10, 520],
  processes: [
    {id: 'kernel', label: 'Linux 内核 · 输入驱动', layer: 'kernel'},
    {id: 'system_server', label: 'system_server（inputflinger）', layer: 'system_server'},
    {id: 'foo', label: 'com.foo', layer: 'app'},
    {id: 'imep', label: 'com.android.inputmethod.pinyin（IME）', layer: 'app'},
    {id: 'sfp', label: 'surfaceflinger', layer: 'native'},
  ],
  chapters: [
    {id: 'i1', title: '① N ↓ → IME 消费', start: 80, end: 260},
    {id: 'i2', title: '② SPACE ↓ → commitText', start: 260, end: 520},
  ],
  lanes: [
    ...inputFlowScript.lanes.filter((l) => KEEP.includes(l.id)),
    L('imm', 'imm', 'foo'),
    L('ime-sender', 'ime-sender', 'foo'),
    L('ric', 'remote-ic-impl', 'foo', 'RemoteInputConnectionImpl（binder 线程）'),
    L('eic', 'editable-ic', 'foo'),
    L('edit', 'edit-text', 'foo'),
    L('ime-receiver', 'ime-receiver', 'imep'),
    L('ime-session', 'ime-session', 'imep'),
    L('pinyin', 'pinyin-ime', 'imep'),
    L('remote-ic', 'remote-ic', 'imep'),
  ],
  resources: [],
  instances: [
    ...(inputFlowScript.instances ?? []).filter((i) => KEEP.includes(i.id)),
    I('imm', 'imm', 'foo', '输入法客户端'),
    I('ime-sender', 'ime-sender', 'foo', '输入法客户端'),
    I('ric', 'remote-ic-impl', 'foo', '输入法客户端'),
    I('eic', 'editable-ic', 'foo', '输入法客户端'),
    I('edit', 'edit-text', 'foo', '输入法客户端', '获得焦点', {mText: '', 'isFocused()': 'true'}),
    I('ime-receiver', 'ime-receiver', 'imep', 'IME 进程'),
    I('ime-session', 'ime-session', 'imep', 'IME 进程'),
    I('pinyin', 'pinyin-ime', 'imep', 'IME 进程', undefined, {mImeState: 'STATE_IDLE'}),
    I('remote-ic', 'remote-ic', 'imep', 'IME 进程'),
  ],
  events: [
    screen(-10, 'form-ime'),
    mark(0, 'imm', '前提：EditText 获焦 → startInputOrWindowGainedFocus → 绑定 IME，建好 app ↔ IME 的 InputChannel', 'info'),

    // ═══ ① 硬件 N ↓：IME 消费，View 树收不到 ═══
    input(T_N, 'drv', 'key-down', 'N ↓（硬件键盘）'),
    ...readerChain(T_N, 'key', 'KEYCODE_N ↓', 'scanCode 49 → KEYCODE_N（.kl）'),
    ...dispatchChain(T_N + 16, 'key', 'KEY N ↓', N_FIN, 'anr-n'),
    ...toIme(T_N + 29, 'KEY N ↓'),
    span('ime-receiver', T_N + 47, T_N + 74, 'onInputEvent', 'cpu'),
    invoke(T_N + 47, 'ime-receiver', 'ime-session', 'dispatchKeyEvent', T_N + 73),
    span('ime-session', T_N + 47, T_N + 73, 'event.dispatch(InputMethodService)', 'cpu'),
    invoke(T_N + 48, 'ime-session', 'pinyin', 'onKeyDown(KEYCODE_N)', T_N + 72),
    span('pinyin', T_N + 48, T_N + 72, 'onKeyDown → processKey → processStateIdle', 'cpu'),
    set(T_N + 52, 'pinyin', 'mImeState', 'STATE_INPUT（拼写 "n"）'),
    mark(T_N + 56, 'pinyin', '解码 "n" → 候选：你 呢 那 能', 'info'),
    mark(T_N + 64, 'pinyin', '候选栏更新：IME 自己的窗口重新 layout / draw', 'info'),
    batch(T_N + 76, 'pinyin', 'sf', 'IME 窗口：setBuffer（候选栏）'),
    span('sf', T_N + 77, T_N + 84, 'latch → 合成（IME 窗口）', 'sf'),
    screen(T_N + 84, 'form-ime-n'),
    ...backFromIme(T_N + 74, 'KEY N ↓'),
    mark(N_FIN + 3, 'ime', '按键被 IME 消费：ViewPostImeInputStage / EditText 都不会收到', 'warn'),

    // ═══ ② SPACE ↓：IME 选第一个候选 → commitText("你") → EditText ═══
    input(T_SP, 'drv', 'key-down', 'SPACE ↓（选词）'),
    ...readerChain(T_SP, 'key', 'KEYCODE_SPACE ↓', 'scanCode 57 → KEYCODE_SPACE（.kl）'),
    ...dispatchChain(T_SP + 16, 'key', 'KEY SPACE ↓', SP_FIN, 'anr-sp'),
    ...toIme(T_SP + 29, 'KEY SPACE ↓'),
    span('ime-receiver', T_SP + 47, T_SP + 94, 'onInputEvent', 'cpu'),
    invoke(T_SP + 47, 'ime-receiver', 'ime-session', 'dispatchKeyEvent', T_SP + 93),
    span('ime-session', T_SP + 47, T_SP + 93, 'event.dispatch(InputMethodService)', 'cpu'),
    invoke(T_SP + 48, 'ime-session', 'pinyin', 'onKeyDown(KEYCODE_SPACE)', T_SP + 92),
    span('pinyin', T_SP + 48, T_SP + 92, 'onKeyDown → processKey → 选中候选 → commitResultText("你")', 'cpu'),
    invoke(T_SP + 56, 'pinyin', 'remote-ic', 'commitText("你", 1)', T_SP + 62),
    span('remote-ic', T_SP + 56, T_SP + 62, 'IRemoteInputConnection.commitText', 'cpu'),
    oneway(T_SP + 60, 'remote-ic', 'ric', 'IRemoteInputConnection.commitText（oneway）'),
    set(T_SP + 70, 'pinyin', 'mImeState', 'STATE_IDLE'),
    batch(T_SP + 96, 'pinyin', 'sf', 'IME 窗口：setBuffer（清空候选）'),
    ...backFromIme(T_SP + 94, 'KEY SPACE ↓'),
    // app：binder 线程收到编辑命令 → 切到主线程执行
    span('ric', T_SP + 62, T_SP + 65, 'dispatchWithTracing("commitText") → 切到主线程', 'cpu'),
    post(T_SP + 64, 'ric', 'looper', 'commitText（Handler）', T_SP + 130),
    invoke(T_SP + 130, 'looper', 'eic', 'EditableInputConnection.commitText', T_SP + 146),
    span('eic', T_SP + 130, T_SP + 146, 'BaseInputConnection.commitText → replaceText', 'cpu'),
    invoke(T_SP + 132, 'eic', 'edit', 'Editable.replace → onTextChanged', T_SP + 144),
    span('edit', T_SP + 132, T_SP + 144, 'TextView：文字变了 → invalidate（必要时 requestLayout）', 'cpu'),
    set(T_SP + 136, 'edit', 'mText', '你'),
    set(T_SP + 137, 'edit', 'PFLAG_DIRTY', 'true'),
    span('chor', T_SP + 160, T_SP + 161, 'doFrame · CALLBACK_TRAVERSAL', 'cpu'),
    invoke(T_SP + 161, 'chor', 'vri', 'performTraversals', T_SP + 176),
    span('vri', T_SP + 161, T_SP + 176, 'performTraversals · draw（EditText 重画）', 'cpu'),
    set(T_SP + 172, 'edit', 'PFLAG_DIRTY', 'false'),
    batch(T_SP + 176, 'vri', 'sf', 'RenderThread → setBuffer（EditText = "你"）'),
    span('sf', T_SP + 177, T_SP + 185, 'latch → 合成（app + IME）', 'sf'),
    screen(T_SP + 185, 'form-ime-commit'),
  ],
};
