import {batch, check, mark, msg, res, sig, span} from '../../dsl/builders';
import type {FlowScript, FlowStory} from '../../dsl/types';

export const frameScript: FlowScript = {
  id: 'frame',
  kind: 'pipeline',
  title: '一帧的全链路',
  subtitle: '60Hz · AOSP 默认预算 · 第 N 帧（N+1 已在流水线里）',
  window: [-2, 52],
  clockProfile: 'default-60',
  vsyncLanes: {app: 'ui', sf: 'sf'},
  pool: {def: 'bufferqueue', params: {maxDequeued: 2, maxAcquired: 1}},
  lanes: [
    {id: 'ui', label: 'UI 线程', sub: 'Choreographer#doFrame', component: 'choreographer'},
    {id: 'rt', label: 'RenderThread', sub: 'HWUI · dequeue / queue', component: 'hwui'},
    {id: 'gpu', label: 'GPU', sub: '异步写像素', component: 'gpu'},
    {id: 'bbq', label: 'BLASTBufferQueue', sub: '应用进程内', component: 'bbq'},
    {id: 'sf', label: 'SF 主线程', sub: 'commit · composite', component: 'sf-ce'},
    {id: 'disp', label: 'HWC / 屏幕', sub: 'present · 扫出', component: 'hwc'},
  ],
  resources: [
    {id: 'A', label: 'A'},
    {id: 'B', label: 'B'},
    {id: 'C', label: 'C'},
  ],
  events: [
    // 初始：C 是第 N-1 帧，正在屏幕上
    res('C', -100, 'ACQUIRED', 'sf'),
    res('A', -100, 'FREE', 'bbq'),
    res('B', -100, 'FREE', 'bbq'),

    span('disp', -2, 33.33, '显示 N-1', 'display', {resource: 'C', frame: 'N-1'}),
    span('disp', 33.33, 50, '显示 N', 'display', {resource: 'A', frame: 'N'}),
    span('disp', 50, 52, 'N+1', 'display', {resource: 'B', frame: 'N+1'}),

    // —— 第 N 帧 ——
    span('ui', 1, 2.4, 'INPUT · ANIMATION', 'cpu', {frame: 'N'}),
    span('ui', 2.4, 5.8, 'TRAVERSAL · measure / layout / draw', 'cpu', {frame: 'N'}),
    span('ui', 5.8, 6.6, 'sync', 'cpu', {frame: 'N'}),
    span('rt', 6.6, 7.2, 'syncFrameState', 'cpu', {frame: 'N'}),
    res('A', 7.2, 'DEQUEUED', 'rt'),
    span('rt', 7.2, 10, 'dequeue · GL/VK 指令', 'cpu', {resource: 'A', frame: 'N'}),
    res('A', 10, 'QUEUED', 'bbq'),
    sig('fA', 'acquire-fence', 'A', 10, 15.5),
    msg(10, 'rt', 'bbq', 'queueBuffer + acquire fence'),
    span('gpu', 10, 15.5, '写像素 N', 'gpu', {resource: 'A', frame: 'N'}),
    span('bbq', 10.2, 10.9, 'acquire · 打包', 'cpu', {frame: 'N'}),
    batch(10.9, 'bbq', 'sf', 'setBuffer(A) + vsyncId'),

    span('sf', 17.67, 18.5, 'commit · flush', 'sf', {frame: 'N'}),
    check(18.1, 'sf', 'fA', '就绪判定'),
    span('sf', 18.5, 19.2, 'latch', 'sf', {resource: 'A', frame: 'N'}),
    res('A', 18.8, 'ACQUIRED', 'sf'),
    span('sf', 19.2, 20.4, '快照 · writeState', 'sf', {frame: 'N'}),
    span('sf', 20.4, 21.8, 'HWC validate', 'sf', {frame: 'N'}),
    span('sf', 21.8, 22.6, 'present', 'sf', {frame: 'N'}),
    msg(22.6, 'sf', 'disp', 'presentDisplay'),
    sig('pfN', 'present-fence', undefined, 22.6, 33.33),

    // 上一块 C 释放：slot 回 FREE，但 release fence 要等屏幕不再扫它才 signal
    res('C', 23, 'FREE', 'bbq'),
    sig('rC', 'release-fence', 'C', 23, 33.33),
    msg(23.4, 'sf', 'bbq', 'release fence (C)'),

    mark(33.6, 'disp', '第 N 帧上屏', 'ok'),
    msg(34.0, 'disp', 'sf', 'present fence → VSyncPredictor'),

    // —— 第 N+1 帧（流水线里的下一帧） ——
    span('ui', 17.67, 22, 'doFrame N+1', 'cpu', {frame: 'N+1'}),
    res('B', 22, 'DEQUEUED', 'rt'),
    span('rt', 22, 26.5, '录指令 N+1', 'cpu', {resource: 'B', frame: 'N+1'}),
    res('B', 26.5, 'QUEUED', 'bbq'),
    sig('fB', 'acquire-fence', 'B', 26.5, 31),
    span('gpu', 26.5, 31, '写像素 N+1', 'gpu', {resource: 'B', frame: 'N+1'}),
    batch(27.2, 'bbq', 'sf', 'setBuffer(B)'),
    span('sf', 34.33, 39, 'commit · latch · 合成 N+1', 'sf', {resource: 'B', frame: 'N+1'}),
    check(34.7, 'sf', 'fB', '就绪判定'),
    res('B', 35, 'ACQUIRED', 'sf'),
    msg(39, 'sf', 'disp', 'present'),
    res('A', 39.5, 'FREE', 'bbq'),
    sig('rA', 'release-fence', 'A', 39.5, 50),
    msg(39.8, 'sf', 'bbq', 'release fence (A)'),
    mark(50.3, 'disp', 'N+1 上屏', 'ok'),
  ],
};

/** 场景 3：阶段视角（PipelineView） */
export const pipelineStory: FlowStory = {
  steps: [
    {
      to: 1.2,
      move: 1.5,
      hold: 6.5,
      caption:
        '① 一帧要经过四个执行者、三次交接：UI 线程录指令，RenderThread 翻译，GPU 写像素；BBQ（仍在应用进程）交给 SF 合成，最后由 HWC 扫到屏幕上。',
      code: {
        file: '阶段分工',
        note: 'CPU 和 GPU 之间靠 buffer 块数解耦；\nApp 和 SF 之间靠 VSYNC 偏移 + fence 解耦。',
      },
    },
    {
      to: 7.8,
      move: 3,
      hold: 6,
      focus: ['A'],
      caption: '② RenderThread dequeueBuffer：Buffer A 从 FREE 变成 DEQUEUED，到了 RenderThread 手里。',
      code: {
        file: 'gui/BufferQueueProducer.cpp:591',
        note: '无空 slot 时阻塞在 :438；\nBLAST 下等待改成可中断 epoll（gui/BLASTBufferQueue.cpp:1204-1236 · 1302-1340）。',
      },
    },
    {
      to: 12,
      move: 3,
      hold: 6.5,
      focus: ['A'],
      caption:
        '③ queueBuffer 不等 GPU：A 已经 QUEUED 并被打包成事务发往 SF，但红旗（acquire fence）还在——紫圈表示 GPU 仍在往里写。',
      code: {
        file: 'gui/BufferQueueProducer.cpp:988-1003 · :1082',
        note: 'queueBuffer 必须带 acquire fence，传 NULL 直接报错；\nfence 存进 slot。slot 状态跑在像素前面。',
      },
    },
    {
      to: 19.5,
      move: 3,
      hold: 6,
      focus: ['A'],
      caption: '④ VSYNC-sf：红旗已消失（fence signal），SF latch，A 进入 ACQUIRED，成为当前帧。',
      code: {
        file: 'sf/Layer.cpp:1506-1563',
        note: 'latchBufferImpl 先查 fenceHasSignaled()（:1518-1523），没好就保持上一帧。',
      },
    },
    {
      to: 24,
      move: 2,
      hold: 6.5,
      focus: ['C'],
      caption:
        '⑤ 上一块 C 被释放：slot 回 FREE，但挂着黄旗（release fence）——屏幕还在扫它，要等下一个 VSYNC 才能真正复用。',
      code: {
        file: 'sf/Layer.cpp:711-739',
        note: 'release fence 与 currentMaxAcquiredBufferCount 一起写进 BufferReleaseChannel。',
      },
    },
    {
      to: 34.5,
      move: 3,
      hold: 6,
      focus: ['A'],
      caption: '⑥ VSYNC N+2：HWC 把 A 扫到屏幕上；present fence 回到 SF 校准 VSYNC 模型，C 的黄旗同时消失。',
      code: {
        file: 'sched/VSyncReactor.cpp:74-103 · sf/SurfaceFlinger.cpp:3991',
        note: 'onCompositionPresented 末尾 addPresentFence，\n回到 VSyncPredictor 的线性回归。',
      },
    },
  ],
};

/** 场景 4：时间轴视角（SwimlaneView） */
export const frameStory: FlowStory = {
  steps: [
    {
      to: 0,
      move: 1.5,
      hold: 6.5,
      caption:
        '① 60Hz、AOSP 默认预算：appWorkDuration = 16.67ms，sfWorkDuration = 15.67ms。应用和 SF 都在硬件 VSYNC 后约 1ms 醒来（应用在 N、SF 在 N+1 之后），瞄准的是同一个上屏时刻 N+2，只是提前量不同。',
      code: {
        file: 'sched/VSyncDispatchTimerQueue.cpp:93-114',
        snippet:
          'auto nextVsyncTime = tracker.nextAnticipatedVSyncTimeFrom(\n    std::max(timing.lastVsync,\n             now + timing.workDuration + timing.readyDuration), ...);\nauto nextWakeupTime =\n    nextVsyncTime - timing.workDuration - timing.readyDuration;',
        note: 'app：work 16.67 + ready 15.67 → 上屏前 32.34ms 唤醒\nsf：work 15.67 → 上屏前 15.67ms 唤醒',
      },
    },
    {
      to: 6.6,
      move: 3.5,
      hold: 6,
      caption:
        '② VSYNC-app 到来：Choreographer#doFrame 按 INPUT → ANIMATION → INSETS_ANIMATION → TRAVERSAL → COMMIT 执行；TRAVERSAL 里 performTraversals 完成 measure / layout / draw。',
      code: {
        file: 'view/Choreographer.java:1201-1211',
        note: 'scheduleTraversals 先下 sync barrier 再 postVsyncCallback\n（view/ViewRootImpl.java:3306-3334），保证 traversal 不被普通消息插队。',
      },
    },
    {
      to: 10.6,
      move: 3,
      hold: 6,
      focus: ['A'],
      caption:
        '③ RenderThread dequeueBuffer 拿到 A，把 DisplayList 翻译成 GL/VK 指令；queueBuffer 带着 acquire fence 立即返回，GPU 在后台写像素。',
      code: {
        file: 'gui/BufferQueueProducer.cpp',
        note: 'FREE → DEQUEUED（:591）\nqueueBuffer 必须带 acquire fence（:988-1003），fence 存进 slot（:1082）\nEglManager::swapBuffers 默认不等 GPU（hwui/renderthread/EglManager.cpp:621-629）',
      },
    },
    {
      to: 11.6,
      move: 1.5,
      hold: 6,
      focus: ['A'],
      caption:
        '④ BBQ 在应用进程内 acquire，把 buffer 和 vsyncId 打包成 setBuffer 事务发给 SF；图中把 A 保持为排队中，直到 SF latch。',
      code: {
        file: 'gui/BLASTBufferQueue.cpp:596-599 · :667-668',
        note: 'Android 17：onFrameAvailable 直连 acquireNextBufferLocked（:864）。\nvsyncId 随事务回到 SF，FrameTimeline 用它串联两侧的帧。',
      },
    },
    {
      to: 19.4,
      move: 3,
      hold: 6,
      focus: ['A', 'C'],
      caption:
        '⑤ VSYNC-sf：commit 先 flush 事务做就绪判定——fence 已 signal → Ready；latch 后 A 成为当前帧。此刻 SF 短暂同时握着 A 和 C（extra-acquire 豁免）。',
      code: {
        file: 'sf/SurfaceFlinger.cpp:2953',
        snippet: 'it->second->latchBufferImpl(unused, latchTime,\n        expectedPresentTimeNs, bgColorOnly);  // :2953',
        note: '就绪过滤 sf/SurfaceFlinger.cpp:5357-5475；\n豁免 gui/BufferQueueConsumer.cpp:104-115。',
      },
    },
    {
      to: 22.8,
      move: 2.5,
      hold: 6,
      caption:
        '⑥ composite：快照 → writeCompositionState → prepareFrame（HWC validate，退回的层改用 GPU 合成）→ presentDisplay。',
      code: {
        file: 'ce/Output.cpp:482-516（节选）',
        snippet:
          'updateCompositionState();\nplanComposition();\nwriteCompositionState(refreshArgs);\n// ...\nif (outputState.usesDeviceComposition) {\n    status_t status = prepareFrame();\n    // ...\n}\nfinishFrame(std::move(result));\npresentFrameAndReleaseLayers();',
      },
    },
    {
      to: 24.2,
      move: 1.5,
      hold: 6.5,
      focus: ['C'],
      caption:
        '⑦ 上一块 C 的 release fence 回到应用：slot 已经 FREE，但黄旗要等屏幕不再扫它（下一个 VSYNC）才 signal——FREE 不等于可以立刻写。',
      code: {
        file: 'sf/Layer.cpp:711-739',
        note: 'callReleaseBufferCallback 写入 BufferReleaseChannel；\n应用侧 BufferReleaseReader（epoll + eventfd）收到后归还 slot\n（gui/BLASTBufferQueue.cpp:476-511 · 1463-1474）。',
      },
    },
    {
      to: 34.6,
      move: 4,
      hold: 6,
      focus: ['A', 'B'],
      caption: '⑧ VSYNC N+2：第 N 帧上屏，present fence 回到 VSyncPredictor 校准模型。与此同时，第 N+1 帧早已在流水线里排队。',
      code: {
        file: 'sf/SurfaceFlinger.cpp:3775-4036',
        note: 'onCompositionPresented：setSfPresent（:3822）在发回调之前；\n最后 addPresentFence（:3991）回到 VSYNC 模型。',
      },
    },
    {
      to: 52,
      move: 4.5,
      hold: 6.5,
      caption:
        '⑨ 应用在 vsync N 被唤醒画的帧，到 N+2 才上屏：流水线深度 = 2，管线里同时有两帧在跑。buffer 数和 VSYNC 预算是同一件事的两面。',
      code: {
        file: 'sf/SurfaceFlinger.cpp:9354-9358',
        snippet:
          'const auto presentLatency =\n    vsyncConfig.appWorkDuration + vsyncConfig.sfWorkDuration;\nreturn calculateMaxAcquiredBufferCount(refreshRate, presentLatency);',
      },
    },
  ],
};
