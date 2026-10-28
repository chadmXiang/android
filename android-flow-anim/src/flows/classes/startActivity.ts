import {call, invoke, mark, newInst, oneway, post, set, span, state} from '../../dsl/builders';
import type {FlowScript, FlowStory} from '../../dsl/types';
import {clsLane} from './lanes';

/** 冷启动在类层面的调用链（单位是逻辑步骤，不是时间；方法名已对 Android 17 源码核对） */
export const startActivityClassScript: FlowScript = {
  id: 'cls-start-activity',
  kind: 'call-chain',
  title: '类级时序：startActivity',
  subtitle: '单位：逻辑步骤 · 类名 / 方法名对照 Android 17（SDK 37）源码',
  window: [0, 180],
  timeUnit: 'step',
  processes: [
    {id: 'launcher', label: 'Launcher', layer: 'app'},
    {id: 'system_server', label: 'system_server', layer: 'system_server'},
    {id: 'foo', label: 'com.foo', layer: 'app', bornAt: 76},
  ],
  // 泳道 id 与实例 id 相同：泳道上的 span / 调用即落在该实例上
  lanes: [
    clsLane('inst', 'instrumentation', 'launcher', 'Launcher · Instrumentation'),
    clsLane('atms', 'atms', 'system_server'),
    clsLane('starter', 'activity-starter', 'system_server'),
    clsLane('supervisor', 'task-supervisor', 'system_server'),
    clsLane('pmsc', 'computer', 'system_server', 'PMS · Computer（快照）'),
    clsLane('root', 'root-wc', 'system_server'),
    clsLane('task', 'task', 'system_server', 'Task / TaskFragment'),
    clsLane('lifecycle', 'lifecycle-manager', 'system_server'),
    clsLane('ams', 'ams', 'system_server', 'ActivityManagerService'),
    clsLane('plist', 'process-list', 'system_server'),
    clsLane('appthread', 'application-thread', 'foo'),
    clsLane('h', 'at-h', 'foo'),
    clsLane('exec', 'transaction-executor', 'foo'),
    clsLane('at', 'activity-thread', 'foo'),
    clsLane('act', 'activity', 'foo'),
  ].map((l) => ({...l, inst: l.id})),
  resources: [],
  // 实例声明顺序决定协作图里的列内顺序；ActivityRecord / ProcessRecord 自带状态机，ObjectBoard 自动收录
  instances: [
    {id: 'inst', cls: 'instrumentation', process: 'launcher', label: 'Launcher'},
    {id: 'atms', cls: 'atms', process: 'system_server', fields: {mTaskSupervisor: 'supervisor', mRootWindowContainer: 'root'}},
    {id: 'starter', cls: 'activity-starter', process: 'system_server', label: '本次请求'},
    {id: 'supervisor', cls: 'task-supervisor', process: 'system_server'},
    {id: 'lifecycle', cls: 'lifecycle-manager', process: 'system_server'},
    {id: 'wpc', cls: 'wpc', process: 'system_server', label: 'com.foo'},
    {id: 'pmsc', cls: 'computer', process: 'system_server', label: '快照'},
    {id: 'root', cls: 'root-wc', process: 'system_server'},
    {id: 'task', cls: 'task', process: 'system_server', label: 'com.foo'},
    {id: 'ar', cls: 'activity-record', process: 'system_server', label: 'com.foo'},
    {id: 'ams', cls: 'ams', process: 'system_server'},
    {id: 'plist', cls: 'process-list', process: 'system_server'},
    {id: 'proc', cls: 'process-record', process: 'system_server', label: 'com.foo'},
    {id: 'at', cls: 'activity-thread', process: 'foo'},
    {id: 'appthread', cls: 'application-thread', process: 'foo'},
    {id: 'h', cls: 'at-h', process: 'foo'},
    {id: 'exec', cls: 'transaction-executor', process: 'foo'},
    {id: 'act', cls: 'activity', process: 'foo', label: 'MainActivity'},
  ],
  events: [
    // ① Launcher → ATMS → ActivityStarter；PMS 解析 Intent
    span('inst', 0, 4, '① execStartActivity', 'cpu'),
    call(4, 'inst', 'atms', 'IActivityTaskManager.startActivity', 60),
    span('atms', 4, 7, 'startActivityAsUser', 'cpu'),
    invoke(6, 'atms', 'starter', 'obtainStarter().execute()', 58),
    span('starter', 6, 14, 'execute', 'cpu'),
    invoke(8, 'starter', 'supervisor', 'resolveIntent / resolveActivity', 14),
    span('supervisor', 8, 14, 'resolveIntent', 'cpu'),
    invoke(9, 'supervisor', 'pmsc', 'PackageManagerInternal.resolveIntent', 13),
    span('pmsc', 9, 13, 'Computer 快照 → ResolveInfo', 'cpu'),

    // ② executeRequest → new ActivityRecord → startActivityInner
    span('starter', 14, 22, '② executeRequest · 校验 / 拦截', 'cpu'),
    mark(20, 'starter', 'new ActivityRecord · createAndStartCollecting(TRANSIT_OPEN)', 'info'),
    newInst(20, 'starter', 'ar'),
    state(20, 'ar', 'INITIALIZING'),
    newInst(24, 'starter', 'task'), // startActivityInner → setNewTask（Launcher 带 NEW_TASK）
    set(25, 'ar', 'task', 'task'),
    span('starter', 22, 58, 'startActivityUnchecked → startActivityInner', 'cpu'),
    invoke(26, 'starter', 'task', 'startActivityLocked', 29),
    span('task', 26, 29, '加入 Task · 启动窗口', 'cpu'),

    // ③ resume：先暂停 Launcher，同时提前拉进程
    invoke(31, 'starter', 'root', 'resumeFocusedTasksTopActivities', 56),
    span('root', 31, 56, '③ resumeFocusedTasksTopActivities', 'cpu'),
    invoke(32, 'root', 'task', 'resumeTopActivityUncheckedLocked', 55),
    span('task', 32, 55, 'TaskFragment.resumeTopActivity', 'cpu'),
    invoke(34, 'task', 'lifecycle', 'scheduleTransactionItem(PauseActivityItem)', 37),
    span('lifecycle', 34, 37, 'Pause → Launcher', 'cpu'),
    oneway(35.5, 'lifecycle', 'inst', 'IApplicationThread.scheduleTransaction'),
    invoke(40, 'task', 'atms', 'startProcessAsync', 43),
    span('atms', 40, 43, 'startProcessAsync', 'cpu'),
    post(42, 'atms', 'ams', 'ActivityManagerInternal::startProcess', 62),

    // ④ AMS 创建进程
    span('ams', 62, 64, '④ LocalService.startProcess', 'cpu'),
    invoke(64, 'ams', 'plist', 'startProcessLocked', 74),
    span('plist', 64, 74, 'newProcessRecordLocked → ZygoteProcess.start', 'cpu'),
    mark(66, 'plist', 'new ProcessRecord', 'info'),
    newInst(66, 'plist', 'proc'),
    newInst(66, 'proc', 'wpc', 'mWindowProcessController'), // ProcessRecord 构造函数里 new WindowProcessController
    state(66, 'proc', 'STARTING'),
    mark(72, 'plist', 'socket → Zygote fork', 'info'),

    // ⑤ 新进程 attach → bindApplication + realStartActivityLocked
    mark(76, 'at', 'fork 出新进程', 'info'),
    span('at', 76, 80, '⑤ main → attach', 'cpu'),
    // new ActivityThread() 时字段初始化器创建这三个
    newInst(77, 'at', 'appthread', 'mAppThread'),
    newInst(77, 'at', 'h', 'mH'),
    newInst(77, 'at', 'exec', 'mTransactionExecutor'),
    call(80, 'at', 'ams', 'IActivityManager.attachApplication', 98),
    span('ams', 80, 98, 'attachApplicationLocked', 'cpu'),
    oneway(82, 'ams', 'appthread', 'bindApplication'),
    span('appthread', 82, 83, '⑥ bindApplication', 'cpu'),
    post(83, 'appthread', 'h', 'BIND_APPLICATION', 100),
    mark(84, 'ams', 'ProcessRecord.makeActive(thread)', 'info'),
    state(84, 'proc', 'ATTACHED'),
    set(84, 'proc', 'mThread', 'appthread'), // makeActive
    set(84, 'wpc', 'mThread', 'appthread'), // mWindowProcessController.setThread
    invoke(86, 'ams', 'atms', 'ActivityTaskManagerInternal.attachApplication', 97),
    span('atms', 86, 97, 'attachApplication', 'cpu'),
    invoke(87, 'atms', 'root', 'attachApplication', 96),
    span('root', 87, 96, 'attachApplication', 'cpu'),
    invoke(88, 'root', 'supervisor', 'realStartActivityLocked', 95),
    span('supervisor', 88, 95, 'realStartActivityLocked', 'cpu'),
    set(89, 'ar', 'app', 'wpc'), // r.setProcess(proc)
    mark(90, 'supervisor', 'new LaunchActivityItem + ResumeActivityItem', 'info'),
    invoke(92, 'supervisor', 'lifecycle', 'scheduleTransactionItems', 94),
    span('lifecycle', 92, 94, 'Launch + Resume', 'cpu'),
    oneway(93, 'lifecycle', 'appthread', 'IApplicationThread.scheduleTransaction'),
    span('appthread', 93, 94, 'scheduleTransaction', 'cpu'),
    post(94, 'appthread', 'h', 'EXECUTE_TRANSACTION', 130),
    state(95, 'ar', 'RESUMED'),

    // ⑥/⑦ 主线程：bind → 执行事务 → onCreate / onResume
    span('h', 100, 101, 'BIND_APPLICATION', 'cpu'),
    invoke(101, 'h', 'at', 'handleBindApplication', 128),
    span('at', 101, 128, 'handleBindApplication · Application.onCreate', 'cpu'),
    state(128, 'proc', 'RUNNING'),
    span('h', 130, 131, '⑦ EXECUTE_TRANSACTION', 'cpu'),
    invoke(131, 'h', 'exec', 'TransactionExecutor.execute', 175),
    span('exec', 131, 175, 'execute → executeTransactionItems', 'cpu'),
    invoke(133, 'exec', 'at', 'LaunchActivityItem → handleLaunchActivity', 155),
    span('at', 133, 155, 'performLaunchActivity', 'cpu'),
    newInst(134, 'at', 'act'), // mInstrumentation.newActivity
    invoke(136, 'at', 'act', 'attach', 140),
    span('act', 136, 140, 'attach · 建 PhoneWindow', 'cpu'),
    set(138, 'act', 'mWindow', 'new PhoneWindow'),
    invoke(142, 'at', 'act', 'callActivityOnCreate', 152),
    span('act', 142, 152, 'onCreate · setContentView', 'cpu'),
    invoke(158, 'exec', 'at', 'ResumeActivityItem → handleResumeActivity', 173),
    span('at', 158, 173, 'handleResumeActivity', 'cpu'),
    invoke(160, 'at', 'act', 'performResume → onResume', 164),
    span('act', 160, 164, 'onResume', 'cpu'),
    mark(168, 'at', 'addView(decor) → WindowManagerGlobal', 'ok'),
  ],
};

export const startActivityClassStory: FlowStory = {
  steps: [
    {
      to: 0,
      view: [0, 180],
      move: 1.5,
      hold: 6,
      caption: 'startActivity 在类层面的全貌：15 条泳道就是 15 个类。下面按 ①—⑦ 逐段展开；白色实线是进程内调用，蓝线是 binder，紫色点线是 Handler 消息排队。',
    },
    {
      to: 14,
      view: [0, 18],
      move: 3,
      hold: 9,
      focus: ['activity-starter', 'task-supervisor', 'computer'],
      caption:
        '① Launcher 的 Instrumentation 经 binder 调 ATMS，ATMS 取一个 ActivityStarter 执行。第一件事是解析 Intent：ActivityTaskSupervisor 经 PackageManagerInternal，在 PMS 的 Computer 快照上查出 ResolveInfo。',
      code: {
        file: 'wm/ActivityStarter.java:837 · wm/ActivityTaskSupervisor.java · pm/ComputerEngine.java:504',
        note: 'execute(:837) → executeRequest(:1087)；\nresolveIntent → queryIntentActivitiesInternal。',
      },
    },
    {
      to: 30,
      view: [10, 36],
      move: 2.5,
      hold: 9,
      focus: ['activity-starter', 'activity-record', 'task'],
      caption:
        '② executeRequest 做权限 / 拦截检查并 new ActivityRecord（构造函数里就 setState(INITIALIZING)），同时 createAndStartCollecting(TRANSIT_OPEN) 开始收集过渡；startActivityInner 选定 Task，Task.startActivityLocked 把它加进层级并请求启动窗口。',
      code: {
        file: 'wm/ActivityStarter.java:1540 · :1605 · :2015',
        note: 'new ActivityRecord.Builder(:1540)；\ncreateAndStartCollecting(TRANSIT_OPEN)(:1605)；\nstartActivityUnchecked(:1613) → startActivityInner(:2015)。',
      },
    },
    {
      to: 44,
      view: [28, 50],
      move: 2.5,
      hold: 9,
      focus: ['root-wc', 'task', 'lifecycle-manager', 'atms'],
      caption:
        '③ RootWindowContainer.resumeFocusedTasksTopActivities → Task → TaskFragment.resumeTopActivity：先经 ClientLifecycleManager 让 Launcher 暂停；发现目标进程不在，提前 startProcessAsync（异步 post 给 AMS），不等暂停完成。',
      code: {
        file: 'wm/RootWindowContainer.java · wm/TaskFragment.java:1449-1469',
        note: '源码注释：进程启动是异步的，已知下一个 Activity 的进程没起，\n就提前启动，省掉等待当前 Activity pause 的时间。',
      },
    },
    {
      to: 76,
      view: [62, 80],
      move: 2.5,
      hold: 8.5,
      focus: ['ams', 'process-list', 'process-record'],
      caption: '④ AMS 线程取出消息：LocalService.startProcess → ProcessList.startProcessLocked 新建 ProcessRecord，经 ZygoteProcess 走 socket 请 Zygote fork。',
      code: {file: 'am/ProcessList.java:1830 · startProcessLocked → Process.start(:2668) → android/os/ZygoteProcess.java:387'},
    },
    {
      to: 98,
      view: [76, 102],
      move: 2.5,
      hold: 10,
      focus: ['activity-thread', 'ams', 'root-wc', 'task-supervisor', 'lifecycle-manager'],
      caption:
        '⑤ 新进程 ActivityThread.attach → attachApplication：AMS 回 bindApplication，ProcessRecord 拿到 IApplicationThread；再经 ATMS → RootWindowContainer.attachApplication → ActivityTaskSupervisor.realStartActivityLocked 组装 LaunchActivityItem + ResumeActivityItem，由 ClientLifecycleManager 发出。',
      code: {
        file: 'am/ActivityManagerService.java:5192 · wm/RootWindowContainer.java:1875 · wm/ActivityTaskSupervisor.java:809',
        note: 'A17 下发入口是 scheduleTransactionItems\n（ActivityTaskSupervisor.java:1050/1063/1079），\n以 item 为粒度、可攒批。',
      },
    },
    {
      to: 131,
      view: [110, 136],
      move: 2.5,
      hold: 8.5,
      focus: ['application-thread', 'at-h'],
      caption: '⑥ 两条 oneway 先到 ApplicationThread（binder 线程），再 post 给主线程 H 排队：BIND_APPLICATION 先处理，EXECUTE_TRANSACTION 要等 Application.onCreate 结束。',
      code: {file: 'app/ActivityThread.java:2394 · H.BIND_APPLICATION=110 · H.EXECUTE_TRANSACTION=159'},
    },
    {
      to: 176,
      view: [150, 180],
      move: 3,
      hold: 10,
      focus: ['transaction-executor', 'activity-thread', 'activity'],
      caption:
        '⑦ TransactionExecutor 先执行 LaunchActivityItem（handleLaunchActivity → attach 建 PhoneWindow → onCreate），再把生命周期推进到 RESUMED。onResume 之后 addView，窗口的故事交给 ViewRootImpl。',
      code: {
        file: 'app/servertransaction/TransactionExecutor.java:72 · app/ActivityThread.java:4733',
        note: 'A17：execute(:72) → executeTransactionItems(:95)\n→ executeLifecycleItem(:146)（旧名 executeCallbacks /\nexecuteLifecycleState 已不存在）。',
      },
    },
  ],
};

/**
 * 同一份脚本，换成对象协作图来看。字幕沿用，停点不同：
 * 泳道看的是"历史"，停在一段结束之后；协作图看的是"此刻"，要停在调用栈最深的时候。
 */
const GRAPH_STOPS = [0, 11, 27.5, 42.9, 69.5, 93.9, 120, 162];

export const startActivityGraphStory: FlowStory = {
  steps: startActivityClassStory.steps.map((st, i) => ({
    ...st,
    to: GRAPH_STOPS[i],
    ...(i === 0
      ? {
          view: [0, 180] as [number, number],
          caption:
            'startActivity 的对象协作图：每张卡片是一个实例，卡片里是它的字段当前值和正在执行的方法。白线是进程内调用，蓝线是 binder，紫色点线是 Handler 排队，绿色是 new 与字段赋值；虚框表示还没创建。',
        }
      : {}),
  })),
};
