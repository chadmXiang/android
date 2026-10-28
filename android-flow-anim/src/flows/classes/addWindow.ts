import {call, invoke, mark, newInst, oneway, set, span, state} from '../../dsl/builders';
import type {FlowScript, FlowStory} from '../../dsl/types';
import {clsLane} from './lanes';

/** 窗口的诞生：addWindow → relayout2 → finishDrawing（单位是逻辑步骤） */
export const addWindowClassScript: FlowScript = {
  id: 'cls-add-window',
  kind: 'call-chain',
  title: '类级时序：addWindow / relayout / finishDrawing',
  subtitle: '单位：逻辑步骤 · 方法名与行号对照 Android 17（SDK 37）源码',
  window: [0, 100],
  timeUnit: 'step',
  processes: [
    {id: 'foo', label: 'com.foo', layer: 'app'},
    {id: 'system_server', label: 'system_server', layer: 'system_server'},
  ],
  lanes: [
    clsLane('wmg', 'wm-global', 'foo'),
    clsLane('vri', 'view-root-impl', 'foo'),
    clsLane('chor', 'choreographer', 'foo'),
    clsLane('tr', 'threaded-renderer', 'foo', 'HWUI · RenderThread'),
    clsLane('bbq', 'bbq', 'foo'),
    clsLane('session', 'session', 'system_server'),
    clsLane('wms', 'wms', 'system_server'),
    clsLane('token', 'activity-record', 'system_server', 'ActivityRecord'),
    clsLane('ws', 'window-state', 'system_server'),
    clsLane('wsa', 'ws-animator', 'system_server'),
    clsLane('sync', 'sync-engine', 'system_server'),
  ].map((l) => ({...l, inst: l.id})),
  resources: [],
  // WindowStateAnimator 自带 draw-state 状态机：state 事件直接作用在实例 wsa 上
  instances: [
    {id: 'wmg', cls: 'wm-global', process: 'foo', group: '视图 / 窗口'},
    {id: 'vri', cls: 'view-root-impl', process: 'foo', group: '视图 / 窗口', label: 'DecorView 的窗口'},
    {id: 'w', cls: 'vri-w', process: 'foo', group: '视图 / 窗口'},
    {id: 'chor', cls: 'choreographer', process: 'foo', group: '帧调度 / 渲染'},
    {id: 'tr', cls: 'threaded-renderer', process: 'foo', group: '帧调度 / 渲染'},
    {id: 'bbq', cls: 'bbq', process: 'foo', group: '帧调度 / 渲染'},
    {id: 'session', cls: 'session', process: 'system_server', group: '入口', label: 'com.foo'},
    {id: 'wms', cls: 'wms', process: 'system_server', group: '入口'},
    {id: 'sync', cls: 'sync-engine', process: 'system_server', group: '入口'},
    {id: 'token', cls: 'activity-record', process: 'system_server', group: '容器树', label: 'com.foo'},
    {id: 'ws', cls: 'window-state', process: 'system_server', group: '容器树', label: 'com.foo'},
    {id: 'wsa', cls: 'ws-animator', process: 'system_server', group: '容器树'},
  ],
  events: [
    // ① addView → setView → addToDisplayAsUser → addWindow
    span('wmg', 0, 4, '① addView · new ViewRootImpl', 'cpu'),
    newInst(3, 'wmg', 'vri', 'mRoots'),
    set(3, 'vri', 'mWindowSession', 'session'), // 构造函数参数：WindowManagerGlobal.getWindowSession()
    newInst(3.5, 'vri', 'w', 'mWindow'), // mWindow = new W(this)
    invoke(4, 'wmg', 'vri', 'setView', 30),
    span('vri', 4, 30, 'setView', 'cpu'),
    invoke(6, 'vri', 'chor', 'requestLayout → scheduleTraversals', 8),
    span('chor', 6, 8, 'postVsyncCallback(TRAVERSAL)', 'cpu'),
    call(10, 'vri', 'session', 'IWindowSession.addToDisplayAsUser', 28),
    span('session', 10, 28, '② addToDisplayAsUser', 'cpu'),
    invoke(11, 'session', 'wms', 'addWindow', 27),
    span('wms', 11, 27, 'addWindow · 权限 / 找 token / 建窗口', 'cpu'),
    newInst(14, 'wms', 'ws'),
    invoke(14, 'wms', 'ws', 'new WindowState(session, W, token)', 17),
    span('ws', 14, 17, 'WindowState()', 'cpu'),
    set(14.5, 'ws', 'mSession', 'session'),
    set(14.5, 'ws', 'mClient', 'w'), // 跨进程：IWindow 代理
    set(14.5, 'ws', 'mToken', 'token'),
    newInst(15.5, 'ws', 'wsa', 'mWinAnimator'),
    state(16, 'wsa', 'NO_SURFACE'),
    invoke(18, 'wms', 'token', 'token.addWindow(win)', 23),
    span('token', 18, 23, 'addWindow → addChild', 'cpu'),
    invoke(19.5, 'token', 'ws', 'onParentChanged → createSurfaceControl', 22),
    span('ws', 19.5, 22, '建容器层', 'cpu'),
    mark(24, 'wms', 'openInputChannel · addWindowLw', 'info'),
    set(25, 'wms', 'mWindowMap', 'ws'), // mWindowMap.put(client.asBinder(), win)

    // ③ VSYNC → 首次 performTraversals → relayout2
    span('chor', 40, 41, '③ doFrame · TRAVERSAL', 'cpu'),
    invoke(41, 'chor', 'vri', 'performTraversals', 96),
    span('vri', 41, 44, 'createSurfaceControl · 自建 BLAST 层', 'cpu'),
    set(42.5, 'vri', 'mSurfaceControl', 'BLAST 层（应用自建）'),
    call(44, 'vri', 'session', 'relayout2（use_client_surface 开）', 58),
    span('session', 44, 58, 'relayout2 → relayout', 'cpu'),
    invoke(45, 'session', 'wms', 'relayoutWindow', 57),
    span('wms', 45, 57, 'relayoutWindow', 'cpu'),
    invoke(47, 'wms', 'ws', 'setClientSurface', 52),
    span('ws', 47, 52, 'reparent 应用 buffer 层', 'cpu'),
    invoke(48, 'ws', 'wsa', 'mSurfaceControl = surface', 50),
    span('wsa', 48, 50, '接管 surface', 'cpu'),
    set(48.5, 'wsa', 'mSurfaceControl', '应用的 BLAST 层（reparent 到容器层下）'),
    state(50, 'wsa', 'DRAW_PENDING'),
    mark(54, 'wms', 'requestTraversal', 'info'),

    // ④ BLASTBufferQueue + 首帧
    invoke(60, 'vri', 'bbq', 'updateBlastSurfaceIfNeeded', 63),
    newInst(60.5, 'vri', 'bbq', 'mBlastBufferQueue'),
    span('bbq', 60.5, 63, '④ new BLASTBufferQueue · update', 'cpu'),
    span('vri', 63, 75, 'measure / layout / draw · 录 DisplayList', 'cpu'),
    invoke(76, 'vri', 'tr', 'ThreadedRenderer.draw', 80),
    span('tr', 76, 82, 'RenderThread 绘制 · queueBuffer', 'cpu'),
    invoke(81, 'tr', 'bbq', 'onFrameAvailable → setBuffer 事务', 84),
    span('bbq', 81, 84, 'acquireNextBufferLocked → Transaction.setBuffer', 'cpu'),

    // ⑤ finishDrawing（oneway）→ 绘制状态推进 → BLASTSync
    oneway(86, 'vri', 'session', 'finishDrawing'),
    span('session', 87, 96, '⑤ finishDrawing', 'cpu'),
    invoke(88, 'session', 'wms', 'finishDrawingWindow', 95),
    span('wms', 88, 95, 'finishDrawingWindow', 'cpu'),
    invoke(89, 'wms', 'ws', 'finishDrawing', 94),
    span('ws', 89, 94, 'finishDrawing', 'cpu'),
    invoke(90, 'ws', 'wsa', 'finishDrawingLocked', 92),
    span('wsa', 90, 92, 'DRAW_PENDING → COMMIT_DRAW_PENDING', 'cpu'),
    state(91, 'wsa', 'COMMIT_DRAW_PENDING'),
    invoke(92.5, 'ws', 'sync', 'onSyncFinishedDrawing', 94),
    span('sync', 92.5, 94, '参与者就绪 → 合并事务', 'cpu'),
    state(97, 'wsa', 'READY_TO_SHOW'),
    mark(97, 'wms', 'performSurfacePlacement', 'info'),
    state(99, 'wsa', 'HAS_DRAWN'),
  ],
};

export const addWindowClassStory: FlowStory = {
  steps: [
    {
      to: 0,
      view: [0, 100],
      move: 1.5,
      hold: 6,
      caption: '一个窗口从无到可见，应用侧 5 个类、system_server 侧 6 个类。下面按 ①—⑤ 逐段展开，右下角同步跟踪 WindowStateAnimator 的绘制状态。',
    },
    {
      to: 9,
      view: [0, 15],
      move: 3,
      hold: 9,
      focus: ['wm-global', 'view-root-impl', 'choreographer'],
      caption:
        '① onResume 之后 WindowManagerGlobal.addView：new ViewRootImpl → setView。setView 先 requestLayout（scheduleTraversals 下 sync barrier 并向 Choreographer 注册 TRAVERSAL），再向 WMS 注册窗口。',
      code: {file: 'view/ViewRootImpl.java:1642 · :3307-3333', note: 'scheduleTraversals：先 postTraversalBarrier(:3329)\n再 postVsyncCallback(:3330)。'},
    },
    {
      to: 28,
      view: [8, 31],
      move: 2,
      hold: 10,
      focus: ['session', 'wms', 'window-state', 'activity-record'],
      caption:
        '② addToDisplayAsUser 经 Session 进入 WMS.addWindow：校验权限，按 attrs.token 找到 ActivityRecord（它就是这个窗口的 WindowToken），new WindowState，再 token.addWindow 挂树并创建容器 SurfaceControl。',
      code: {
        file: 'view/IWindowSession.aidl:57 · wm/Session.java:272 · wm/WindowManagerService.java:1672',
        note: 'onParentChanged → createSurfaceControl：\n容器层随挂树创建。',
      },
    },
    {
      to: 58,
      view: [38, 61],
      move: 3,
      hold: 10,
      focus: ['view-root-impl', 'session', 'window-state', 'ws-animator'],
      caption:
        '③ 下一个 VSYNC 首次 performTraversals：use_client_surface 打开时应用先自建 BLAST 层，再走新接口 relayout2 进 WMS.relayoutWindow；WindowState.setClientSurface 把这层 reparent 到容器层下，并交给 WindowStateAnimator。',
      code: {
        file: 'view/ViewRootImpl.java:10083 · :10303 · wm/Session.java:301 · wm/WindowState.java:3412-3433',
        snippet: 'mWinAnimator.mSurfaceControl = isClientLocal()\n  ? new SurfaceControl(surface, "setClientSurface") : surface;\ngetPendingTransaction().reparent(surface, mSurfaceControl);',
        note: 'A17 新增 relayout2 / relayoutAsync2（IWindowSession.aidl:94/114），\nSession.relayout2 内部复用 relayout；flag 关闭时仍走老接口。',
      },
    },
    {
      to: 84,
      view: [60, 87],
      move: 2.5,
      hold: 9,
      focus: ['bbq', 'threaded-renderer', 'view-root-impl'],
      caption: '④ relayout 返回后创建 / 更新 BLASTBufferQueue，measure / layout / draw，ThreadedRenderer 把 DisplayList 交给 RenderThread 出第一帧。',
      code: {file: 'view/ViewRootImpl.java · updateBlastSurfaceIfNeeded · gui/BLASTBufferQueue.cpp:779 · :667'},
    },
    {
      to: 100,
      view: [84, 100],
      move: 2.5,
      hold: 10,
      focus: ['session', 'window-state', 'ws-animator', 'sync-engine'],
      caption:
        '⑤ finishDrawing 是 oneway，应用发完就走：WindowStateAnimator 的绘制状态推进到 COMMIT_DRAW_PENDING，BLASTSyncEngine 收到参与者就绪；下一轮 surface 摆放后变为 READY_TO_SHOW → HAS_DRAWN，窗口真正可见。',
      code: {
        file: 'view/IWindowSession.aidl:143-145 · wm/Session.java:343 · wm/WindowManagerService.java:3101',
        note: 'finishDrawing 在 aidl 里声明为 oneway，调用方不阻塞。\n绘制状态由 WindowStateAnimator 维护（A17 已并入\nWindowSurfaceController 的职责）。',
      },
    },
  ],
};

/** 协作图版本：字幕沿用，停点改到每段调用栈最深处 */
const GRAPH_STOPS = [0, 7, 20.5, 49.4, 82.5, 91.2];

export const addWindowGraphStory: FlowStory = {
  steps: addWindowClassStory.steps.map((st, i) => ({
    ...st,
    to: GRAPH_STOPS[i],
    ...(i === 0
      ? {
          caption:
            '窗口的诞生（对象协作图）：左边应用进程、右边 system_server。看 ViewRootImpl 和 WindowState 两个"半边窗口"怎样被 new 出来、互相持有对方的 binder（mWindowSession ↔ mClient），以及 WindowStateAnimator 的绘制状态。',
        }
      : {}),
  })),
};
