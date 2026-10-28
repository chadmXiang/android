import type {CodeRef, FlowStory} from '../../dsl/types';

/**
 * 冷启动四个维度的分镜。脚本只有一份（coldLaunch.ts），每个维度只决定"停在哪、说什么"。
 * 停点规则：协作图要停在调用栈最深处；其它视图停在状态交接之后。
 */

const C = (file: string, note?: string): CodeRef => ({file, note});

// ═══════════════ ① 进程维度：粗流程，只看进程之间怎么交互 ═══════════════
export const processStory: FlowStory = {
  steps: [
    {
      to: -5,
      move: 1.5,
      hold: 7,
      caption: '一次冷启动牵动 5 个进程：Launcher、system_server、zygote、新建的 com.foo、surfaceflinger。这张图只画跨进程的交互，一行一次，按发生顺序编号。',
      code: C('说明', '实线 = 同步 binder（调用方阻塞，右侧标出耗时）\n空心虚线 = oneway binder\n双线 = socket；粉色粗线 = fork；橙色虚线 = Transaction'),
    },
    {
      to: 38.5,
      move: 2.5,
      hold: 8,
      caption: '① Launcher 同步调用 IActivityTaskManager.startActivity，主线程一直阻塞到 system_server 把 ActivityRecord、Task 建好、发出 Pause 才返回。',
      code: C('app/Instrumentation.java · execStartActivity → wm/ActivityStarter.java · execute'),
    },
    {
      to: 60,
      move: 2.5,
      hold: 9,
      caption: '② 两件事并行：ATMS 用 oneway 让 Launcher 暂停（onPause 后 activityPaused 回报）；同时发现进程不存在，经 ProcessList 用 socket 请 zygote fork——不等 Launcher 暂停完。',
      code: C('wm/TaskFragment.java · resumeTopActivity → startPausing + startProcessAsync', 'startProcessAsync 把 startProcess post 到 ATMS 的 mH\n（DisplayThread · android.display）'),
    },
    {
      to: 74,
      move: 2,
      hold: 7,
      caption: '③ zygote 在 runSelectLoop 里收到请求，forkAndSpecialize 出 com.foo。新进程从这一行起才"诞生"，左上角的进程框由虚线变实线。',
      code: C('internal-os/ZygoteConnection.java · processCommand → Zygote.forkAndSpecialize'),
    },
    {
      to: 99,
      move: 2.5,
      hold: 9,
      caption: '④ 新进程同步 attachApplication 向 AMS 报到；AMS 用两条 oneway 回过去：bindApplication，以及 Launch + Resume 事务（expedite 开关打开时，此刻就发；关闭时要等第 ⑤ 步之后）。',
      code: C('am/ActivityManagerService.java · attachApplicationLocked', 'Flags.expediteActivityLaunchOnColdStart()\n  → mAtmInternal.attachApplication(...)\n否则在 finishAttachApplicationInner 里才调'),
    },
    {
      to: 290,
      move: 3,
      hold: 8,
      caption: '⑤ com.foo 主线程执行 Application.onCreate，这段完全在进程内部。做完后同步 finishAttachApplication，AMS 再处理该进程待启动的 Service / 广播。',
      code: C('app/ActivityThread.java · handleBindApplication → mgr.finishAttachApplication', 'enable_wait_for_finish_attach_application 默认 true'),
    },
    {
      to: 404,
      move: 3,
      hold: 8,
      caption: '⑥ Activity 走完 onCreate / onStart / onResume 后 addView：先 openSession 拿到这个进程的 Session，再 addToDisplayAsUser 让 WMS 建 WindowState。',
      code: C('view/WindowManagerGlobal.java · addView → view/ViewRootImpl.java · setView'),
    },
    {
      to: 491,
      move: 3,
      hold: 9,
      caption: '⑦ 首帧：relayout2 拿到 surface，RenderThread 画完后 BLASTBufferQueue 把 buffer 直接交给 SurfaceFlinger——不经过 system_server；finishDrawing 是 oneway，WMS 随后让容器层可见。',
      code: C('view/ViewRootImpl.java · relayout2 / finishDrawing · gui/BLASTBufferQueue.cpp'),
    },
    {
      to: 540,
      move: 2.5,
      hold: 9,
      caption: '⑧ 主线程空闲后 oneway activityIdle，system_server 才处理"等待 stop"的 Launcher：发 Stop 事务，Launcher onStop 后 activityStopped 回报。冷启动到此结束。',
      code: C('wm/ActivityTaskSupervisor.java · activityIdleInternal → processStoppingAndFinishingActivities'),
    },
  ],
};

// ═══════════════ ② 进入进程：system_server ═══════════════
export const systemServerStory: FlowStory = {
  steps: [
    {
      to: -5,
      view: [-10, 100],
      move: 1.5,
      hold: 7,
      caption: '进入 system_server：一次冷启动在这里新建 ActivityRecord、Task、ProcessRecord、WindowProcessController、Session、WindowState、WindowStateAnimator。虚框是还没创建的对象。',
      code: C('说明', '右侧"其他进程"一列是和这些对象有往来的\nLauncher / com.foo 里的对象'),
    },
    {
      to: 13,
      move: 2.5,
      hold: 8,
      focus: ['activity-starter', 'task-supervisor', 'computer'],
      caption: 'ATMS 取一个 ActivityStarter 执行这次请求；第一件事是解析 Intent：ActivityTaskSupervisor → PackageManagerInternal，在 PMS 的 Computer 快照上查出 ResolveInfo。',
      code: C('wm/ActivityStarter.java · execute → executeRequest · pm/ComputerEngine.java'),
    },
    {
      to: 25,
      move: 2.5,
      hold: 8,
      focus: ['activity-record', 'task'],
      caption: 'executeRequest 里 new ActivityRecord（INITIALIZING）；startActivityInner 因为 NEW_TASK 新建 Task，并把 ActivityRecord.task 指向它，再 startActivityLocked 请求启动窗口。',
      code: C('wm/ActivityStarter.java · executeRequest / startActivityInner · setNewTask'),
    },
    {
      to: 31.8,
      move: 2,
      hold: 8,
      focus: ['root-wc', 'task', 'lifecycle-manager'],
      caption: 'resumeFocusedTasksTopActivities → TaskFragment.resumeTopActivity：当前 resumed 的 Launcher 要先暂停，ClientLifecycleManager 下发 PauseActivityItem。',
      code: C('wm/TaskFragment.java · resumeTopActivity → startPausing'),
    },
    {
      to: 50,
      view: [30, 100],
      move: 2.5,
      hold: 8,
      focus: ['process-list', 'process-record', 'wpc'],
      caption: '在 android.display 线程上，AMS 的 LocalService.startProcess → ProcessList.startProcessLocked：new ProcessRecord，它的构造函数里同时 new 出一一对应的 WindowProcessController。',
      code: C('am/ProcessList.java · newProcessRecordLocked · am/ProcessRecord.java', 'mWindowProcessController = new WindowProcessController(...)'),
    },
    {
      to: 91.5,
      move: 2.5,
      hold: 9,
      focus: ['process-record', 'wpc', 'activity-record', 'task-supervisor'],
      caption: '新进程 attachApplication：makeActive 让 ProcessRecord / WindowProcessController 的 mThread 指向它的 ApplicationThread；realStartActivityLocked 把 ActivityRecord.app 指向 WindowProcessController。',
      code: C('am/ProcessRecord.java · makeActive · wm/ActivityTaskSupervisor.java · realStartActivityLocked', 'r.setProcess(proc)'),
    },
    {
      to: 399.5,
      view: [380, 420],
      move: 3,
      hold: 9,
      focus: ['session', 'wms', 'window-state', 'ws-animator'],
      caption: '应用 addView 时：openSession 为这个进程 new Session；addToDisplayAsUser → WMS.addWindow new WindowState（持有 Session 和应用的 W），再 new WindowStateAnimator，mDrawState = NO_SURFACE。',
      code: C('wm/WindowManagerService.java · addWindow · wm/WindowState.java', 'mWinAnimator = new WindowStateAnimator(this)'),
    },
    {
      to: 474.5,
      view: [415, 480],
      move: 2.5,
      hold: 8,
      focus: ['ws-animator', 'window-state'],
      caption: '首帧：setClientSurface 把应用自建的 BLAST 层交给 WindowStateAnimator（DRAW_PENDING）；finishDrawing 到达后 finishDrawingLocked 推到 COMMIT_DRAW_PENDING，随后可见。',
      code: C('wm/WindowState.java · setClientSurface · wm/WindowStateAnimator.java · finishDrawingLocked'),
    },
    {
      to: 533,
      view: [505, 540],
      move: 2.5,
      hold: 8,
      focus: ['activity-client-controller', 'activity-record'],
      caption: '最后 ActivityClientController 收到 activityIdle，处理等待 stop 的 Launcher；activityStopped 回报后 Launcher 的 ActivityRecord 变为 STOPPED。',
      code: C('wm/ActivityClientController.java · activityIdle / activityStopped'),
    },
  ],
};

// ═══════════════ ② 进入进程：zygote → 新进程的第一口气 ═══════════════
export const zygoteStory: FlowStory = {
  steps: [
    {
      to: 50,
      view: [40, 110],
      move: 1.5,
      hold: 7,
      caption: '进入 zygote：它一直在 ZygoteServer.runSelectLoop 里等 socket 请求。ProcessList 的 fork 请求到达前，com.foo 这个进程还不存在（右侧虚框）。',
      code: C('internal-os/ZygoteInit.java · main → zygoteServer.runSelectLoop'),
    },
    {
      to: 59,
      move: 2.5,
      hold: 7,
      focus: ['zygote-connection'],
      caption: 'ZygoteConnection.processCommand 解析参数，Zygote.forkAndSpecialize：fork 出子进程并设置 uid / gid / SELinux 等。父进程回去继续等下一个请求。',
      code: C('internal-os/ZygoteConnection.java · processCommand'),
    },
    {
      to: 71.5,
      move: 2.5,
      hold: 8,
      focus: ['zygote-init', 'runtime-init'],
      caption: '子进程里：handleChildProc → ZygoteInit.zygoteInit：RuntimeInit.commonInit，nativeZygoteInit 启动 binder 线程池，再 applicationInit 用反射找到 ActivityThread.main。',
      code: C('internal-os/ZygoteInit.java · zygoteInit', 'RuntimeInit.commonInit();\nZygoteInit.nativeZygoteInit();\nreturn RuntimeInit.applicationInit(...)'),
    },
    {
      to: 79,
      move: 2.5,
      hold: 9,
      focus: ['activity-thread', 'looper', 'application-thread', 'at-h'],
      caption: 'ActivityThread.main：Looper.prepareMainLooper，然后 new ActivityThread——字段初始化器同时 new 出 ApplicationThread（mAppThread）、H（mH）和 TransactionExecutor，mLooper 指向主线程 Looper。',
      code: C('app/ActivityThread.java · main', 'final ApplicationThread mAppThread = new ApplicationThread();\nfinal Looper mLooper = Looper.myLooper();\nfinal H mH = new H();'),
    },
    {
      to: 99,
      move: 2.5,
      hold: 9,
      focus: ['activity-thread', 'application-thread', 'at-h'],
      caption: 'attach → attachApplication 把 mAppThread 交给 AMS；回来的 bindApplication、Launch + Resume 两条 oneway 落在 ApplicationThread（binder 线程），再 post 给 H 排队。main 最后 Looper.loop()。',
      code: C('app/ActivityThread.java · attach → IActivityManager.attachApplication(mAppThread, startSeq)'),
    },
  ],
};

// ═══════════════ ② 进入进程：com.foo 从 bindApplication 到首帧 ═══════════════
export const appStory: FlowStory = {
  steps: [
    {
      to: 101.5,
      view: [95, 300],
      move: 1.5,
      hold: 7,
      caption: '进入 com.foo：主线程依次取出 BIND_APPLICATION 和 EXECUTE_TRANSACTION。下面看着这些对象一个个被 new 出来、字段连起来，直到第一帧画完。',
      code: C('说明', '绿色虚线 = 字段赋值后形成的引用\n虚框 = 还没创建'),
    },
    {
      to: 106,
      move: 2.5,
      hold: 7,
      focus: ['activity-thread', 'loaded-apk'],
      caption: 'handleBindApplication：先 getPackageInfo 得到 LoadedApk（ClassLoader、资源都挂在它上面），再 new Instrumentation。',
      code: C('app/ActivityThread.java · handleBindApplication', 'data.info = getPackageInfo(...)\nmInstrumentation = new Instrumentation()'),
    },
    {
      to: 131,
      move: 2.5,
      hold: 9,
      focus: ['loaded-apk', 'context-impl', 'instrumentation', 'application'],
      caption: 'LoadedApk.makeApplicationInner：ContextImpl.createAppContext 建 Application 的 Context，Instrumentation.newApplication 反射 new Application 并 attach——Application.mBase 指向这个 ContextImpl。',
      code: C('app/LoadedApk.java · makeApplicationInner → app/Instrumentation.java · newApplication', 'app.attach(context)'),
    },
    {
      to: 160,
      move: 2,
      hold: 7,
      focus: ['application'],
      caption: 'callApplicationOnCreate → Application.onCreate：应用自己的初始化都在这里，跑在主线程上；它越慢，Activity 越晚开始创建。',
      code: C('app/ActivityThread.java · mInstrumentation.callApplicationOnCreate(app)'),
    },
    {
      to: 310,
      view: [298, 412],
      move: 3,
      hold: 8,
      focus: ['transaction-executor', 'activity-thread', 'instrumentation', 'activity'],
      caption: 'EXECUTE_TRANSACTION：TransactionExecutor 先跑 LaunchActivityItem → handleLaunchActivity → performLaunchActivity：WindowManagerGlobal.initialize，建 Activity 的 ContextImpl，newActivity 反射 new MainActivity。',
      code: C('app/ActivityThread.java · performLaunchActivity', 'createBaseContextForActivity(r)\nmInstrumentation.newActivity(...)'),
    },
    {
      to: 321.8,
      move: 2,
      hold: 8,
      focus: ['activity', 'phone-window', 'wm-impl'],
      caption: 'Activity.attach：mBase 指向 Activity 的 ContextImpl；new PhoneWindow；setWindowManager 再给这个窗口建一个 WindowManagerImpl，它的 mGlobal 指向进程单例 WindowManagerGlobal。',
      code: C('app/Activity.java · attach', 'mWindow = new PhoneWindow(this, window, ...)\nmWindow.setWindowManager(...)\nmWindowManager = mWindow.getWindowManager()'),
    },
    {
      to: 334,
      move: 2,
      hold: 8,
      focus: ['activity', 'phone-window', 'decor-view'],
      caption: 'callActivityOnCreate → onCreate → setContentView：PhoneWindow.installDecor → generateDecor new DecorView，再把布局 inflate 进去。此时只有视图树，还没有任何窗口。',
      code: C('internal/policy/PhoneWindow.java · setContentView → installDecor → generateDecor'),
    },
    {
      to: 376,
      move: 2.5,
      hold: 7,
      focus: ['transaction-executor', 'activity'],
      caption: 'TransactionExecutor 把生命周期推进到 RESUMED：cycleToPath 先补上 onStart，再执行 ResumeActivityItem → onResume。',
      code: C('app/servertransaction/TransactionExecutor.java · executeLifecycleItem → cycleToPath'),
    },
    {
      to: 392,
      move: 2,
      hold: 8,
      focus: ['wm-impl', 'wm-global', 'view-root-impl'],
      caption: 'onResume 之后 wm.addView(decor)：WindowManagerImpl → WindowManagerGlobal.addView，new ViewRootImpl——它持有 Session、W（给 WMS 回调用的 binder）和 Choreographer。',
      code: C('app/ActivityThread.java · handleResumeActivity → wm.addView(decor, l)'),
    },
    {
      to: 398.8,
      move: 2,
      hold: 8,
      focus: ['view-root-impl', 'choreographer'],
      caption: 'ViewRootImpl.setView：requestLayout 向 Choreographer 注册 TRAVERSAL，同步 addToDisplayAsUser 让 WMS 建 WindowState。窗口这时才在系统里存在。',
      code: C('view/ViewRootImpl.java · setView'),
    },
    {
      to: 456,
      view: [415, 480],
      move: 2.5,
      hold: 8,
      focus: ['view-root-impl', 'bbq', 'threaded-renderer'],
      caption: '下一个 VSYNC：performTraversals 先 relayout2 拿到 surface，new BLASTBufferQueue，measure / layout / draw，再交给 ThreadedRenderer 在 RenderThread 上画。',
      code: C('view/ViewRootImpl.java · performTraversals → relayoutWindow → updateBlastSurfaceIfNeeded'),
    },
    {
      to: 474.6,
      move: 2,
      hold: 8,
      focus: ['bbq', 'view-root-impl'],
      caption: 'RenderThread 画完，BLASTBufferQueue 把 buffer 打成 setBuffer 事务直接给 SurfaceFlinger；ViewRootImpl 再 oneway finishDrawing 通知 WMS。首帧完成。',
      code: C('gui/BLASTBufferQueue.cpp · acquireNextBufferLocked'),
    },
  ],
};

// ═══════════════ ③ 用户层面：前台切换，两个 Activity 的生命周期 ═══════════════
export const lifecycleStory: FlowStory = {
  steps: [
    {
      to: -5,
      move: 1.5,
      hold: 7,
      caption: '用户看到的是"桌面换成了应用"。背后是两个 Activity 的交接：上面 Launcher，下面 com.foo；每张卡片同时给出客户端回调和 system_server 里的 ActivityRecord 状态。',
      code: C('说明', '客户端状态名 = ActivityLifecycleItem 常量\nPRE_ON_CREATE / ON_CREATE / … / ON_STOP'),
    },
    {
      to: 34,
      move: 2.5,
      hold: 8,
      caption: 'system_server 先把 Launcher 标成 PAUSING 并下发 Pause，但 Launcher 的 onPause 还没执行——它的主线程还卡在 startActivity 那次同步 binder 调用里。',
      code: C('wm/TaskFragment.java · startPausing'),
    },
    {
      to: 57,
      move: 2.5,
      hold: 8,
      caption: 'Launcher 回到主线程执行 onPause，然后 activityPaused 回报，服务端变为 PAUSED。注意：此时 Launcher 仍然可见（画面上是启动窗口盖在桌面上）。',
      code: C('app/ActivityThread.java · performPauseActivity · wm/ActivityClientController.java · activityPaused'),
    },
    {
      to: 312,
      move: 3,
      hold: 8,
      caption: '新进程起来、Application.onCreate 跑完之后，com.foo 的 Activity 才被 new 出来（PRE_ON_CREATE）。而服务端早在 attach 阶段就把它标成了 RESUMED。',
      code: C('wm/ActivityTaskSupervisor.java · realStartActivityLocked（andResume）'),
    },
    {
      to: 377,
      move: 2.5,
      hold: 9,
      caption: 'onCreate → onStart → onResume 一口气走完。onResume 之后 Activity "前台"了，但还不可见：窗口刚要 addView，首帧还没画，屏幕上仍是启动窗口。',
      code: C('app/servertransaction/TransactionExecutor.java · cycleToPath'),
    },
    {
      to: 493,
      move: 3,
      hold: 9,
      caption: '首帧画完、窗口 HAS_DRAWN：com.foo 可见。Launcher 被完全挡住，makeInvisible → 进入"等待 stop"列表，但它的 onStop 还要再等。',
      code: C('wm/ActivityRecord.java · makeInvisible → addToStopping'),
    },
    {
      to: 503,
      move: 2,
      hold: 8,
      caption: '可见之后，WMS 才把输入焦点从 Launcher 的窗口切到 com.foo 的窗口。可见在前、焦点在后——这时点按才会落到新应用上。',
      code: C('wm/WindowManagerService.java · updateFocusedWindowLocked'),
    },
    {
      to: 537,
      move: 2.5,
      hold: 9,
      caption: 'com.foo 主线程空闲后 activityIdle，Launcher 才收到 Stop：onStop → STOPPED。完整顺序：Launcher onPause → com.foo onCreate / onStart / onResume → 首帧 → 焦点 → Launcher onStop。',
      code: C('wm/ActivityTaskSupervisor.java · activityIdleInternal → processStoppingAndFinishingActivities'),
    },
  ],
};

// ═══════════════ ④ dumpsys 视角：每一步之后能看到什么变化 ═══════════════
export const dumpsysStory: FlowStory = {
  steps: [
    {
      to: -5,
      move: 1.5,
      hold: 8,
      caption: '启动前的基线：dumpsys 四个常用命令的关键字段。之后每一步只看"上一步 → 这一步"之间变了哪些行：绿色新增、黄色改值（旧值划掉）、红色消失。',
      code: C('说明', '格式是示意，字段名对照 dump 方法：\nRootWindowContainer / DisplayContent /\nWindowStateAnimator / ProcessList'),
    },
    {
      to: 24,
      move: 2.5,
      hold: 9,
      caption: 'startActivity 刚进 ATMS：多了 Task #21 和 com.foo 的 ActivityRecord（INITIALIZING，app=null，还没有进程）。dumpsys window 里 mFocusedApp 已经切到 com.foo——而 mCurrentFocus 还是 Launcher。',
      code: C('wm/ActivityRecord.java · moveFocusableActivityToTop → DisplayContent.setFocusedApp'),
    },
    {
      to: 47,
      move: 2,
      hold: 8,
      caption: 'Launcher 变为 PAUSING；WMS 里多了启动窗口（Splash Screen com.foo），SurfaceFlinger 里也能看到它的图层——用户此刻看到的就是它。',
      code: C('wm/Task.java · startActivityLocked → showStartingWindow'),
    },
    {
      to: 57,
      move: 2,
      hold: 8,
      caption: 'Launcher 回报暂停 → PAUSED，oom 调整为 pause-activity；AMS 里出现 com.foo 的 ProcessRecord，但它还在等 zygote fork。',
      code: C('am/ProcessList.java · newProcessRecordLocked'),
    },
    {
      to: 96,
      move: 2.5,
      hold: 9,
      caption: '新进程 attach 之后：ActivityRecord.app 指向 ProcessRecord，状态 RESUMED，Resumed: 换成 com.foo；进程优先级升到 adj 0 · top-activity。此时应用还没开始画任何东西。',
      code: C('am/ActivityManagerService.java · attachApplicationLocked'),
    },
    {
      to: 400,
      move: 3,
      hold: 8,
      caption: 'addWindow 之后：dumpsys window 出现 com.foo 的窗口，mDrawState=NO_SURFACE；SurfaceFlinger 里有了它的容器层，但还没显示。',
      code: C('wm/WindowManagerService.java · addWindow'),
    },
    {
      to: 491,
      move: 3,
      hold: 9,
      caption: '首帧：mDrawState 一路走到 HAS_DRAWN，BLAST buffer 层 latch 了首帧，容器层显示中，ActivityRecord nowVisible=true。',
      code: C('wm/WindowStateAnimator.java · mDrawState'),
    },
    {
      to: 503,
      move: 2,
      hold: 9,
      caption: '启动窗口被移除；Launcher 进入 "Activities waiting to stop"；mCurrentFocus 终于切到 com.foo 的窗口——焦点应用早在第 2 步就换了，焦点窗口到这里才换。',
      code: C('wm/DisplayContent.java · dump：mCurrentFocus= / mFocusedApp='),
    },
    {
      to: 537,
      move: 2.5,
      hold: 9,
      caption: '收尾：Launcher STOPPED、移出等待 stop 列表，进程优先级降到 adj 600 · home。和启动前相比，Δ 标记的就是这次冷启动留下的全部变化。',
      code: C('am/OomAdjusterImpl.java · setAdjType("home")'),
    },
  ],
};
