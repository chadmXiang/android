import type {CodeRef, FlowStory} from '../../dsl/types';

/**
 * 开机流程的分镜（脚本 bootFull.ts）。时间单位 ms，显示为秒。
 * 协作图停在调用进行中；进程时序图停在最后一行画完之后（全窗口 18s × 0.6% ≈ 108ms）。
 */
const C = (file: string, note?: string): CodeRef => ({file, note});
const INIT = 'system/core/init';

// ═══════════════ ① 进程维度 ═══════════════
export const bootProcessStory: FlowStory = {
  steps: [
    {
      to: 200,
      move: 1.5,
      hold: 8,
      caption: '开机是一场接力：Bootloader → Kernel → init（pid 1）→ init 按 rc 拉起 servicemanager / surfaceflinger / zygote → zygote 孵化 system_server → system_server 拉起桌面和 SystemUI。这张图只画进程之间的交接。',
      code: C('说明', '实线 = 同步 binder · 粗绿虚线 = init 拉起（fork + exec）\n粉色粗线 = zygote fork · 双线 = socket\n橙色虚线 = 图形事务'),
    },
    {
      to: 3420,
      move: 2.5,
      hold: 7,
      caption: '① ② Bootloader 校验并加载内核，内核初始化驱动、挂载 ramdisk 后 exec /init，成为第一个用户态进程（pid 1）。',
      code: C('kernel · init/main.c（上游 Linux）', 'kernel_init → run_init_process("/init")'),
    },
    {
      to: 5050,
      move: 2.5,
      hold: 8,
      caption: '③ init 解析 init.rc 后按触发器推进：on init 里 start servicemanager——它成为 binder 的 context manager（handle 0），之后所有服务都要到它这里登记名字。',
      code: C(`${INIT}/init.cpp · SecondStageMain`, 'rootdir/init.rc：on init … start servicemanager'),
    },
    {
      to: 6120,
      move: 3,
      hold: 9,
      caption: 'zygote-start 拉起 zygote，boot 阶段 class_start core 拉起 surfaceflinger。SF 初始化后登记自己，并通过 property_service socket 设置 ctl.start=bootanim——init 收到后才启动开机动画（它是 disabled 的服务）。',
      code: C('native/services/surfaceflinger/SurfaceFlinger.cpp · initBootProperties', 'property_set("service.bootanim.exit", "0");\nproperty_set("ctl.start", "bootanim");'),
    },
    {
      to: 7420,
      move: 2.5,
      hold: 7,
      caption: '④ zygote 预加载完类和资源后 forkSystemServer：system_server 从 zygote 复制出来，天生就带着预加载好的 Java 世界。',
      code: C('core/java/com/android/internal/os/ZygoteInit.java · forkSystemServer'),
    },
    {
      to: 10930,
      move: 3,
      hold: 9,
      caption: '⑤ system_server 分三批启动服务，每个对外的服务都向 servicemanager addService 登记名字：activity_task、power、display、package、activity、window、input……',
      code: C('services/java/com/android/server/SystemServer.java · startBootstrapServices / startOtherServices'),
    },
    {
      to: 13800,
      move: 3,
      hold: 9,
      caption: 'AMS.systemReady 先推进 PHASE 550 / 600，再 startHomeOnAllDisplays：经 socket 请 zygote fork 出 Launcher；systemReady 返回后再 startSystemUi，fork 出 SystemUI。',
      code: C('services/core/java/com/android/server/am/ActivityManagerService.java · systemReady', 'goingCallback.run() 在 startHomeOnAllDisplays 之前；\n本机 SystemServer 在 systemReady 返回后才 startSystemUi'),
    },
    {
      to: 15950,
      move: 3,
      hold: 9,
      caption: '⑥ 桌面、状态栏画好后 WMS 设置 service.bootanim.exit=1；开机动画每帧 checkExit 读到后自己退出，WMS 确认后调 SurfaceControl.bootFinished。',
      code: C('services/core/java/com/android/server/wm/WindowManagerService.java · performEnableScreen'),
    },
    {
      to: 17100,
      move: 2.5,
      hold: 9,
      caption: '最后 AMS.finishBooting：PHASE_BOOT_COMPLETED，再 setprop sys.boot_completed=1（init 里 on property:sys.boot_completed=1 的动作随之执行），并发出 BOOT_COMPLETED 广播。',
      code: C('am/ActivityManagerService.java · finishBooting', 'startBootPhase(PHASE_BOOT_COMPLETED)\n→ SystemProperties.set("sys.boot_completed", "1")'),
    },
  ],
};

// ═══════════════ ② 进入 init ═══════════════
export const bootInitStory: FlowStory = {
  steps: [
    {
      to: 3700,
      view: [3250, 4300],
      move: 1.5,
      hold: 9,
      caption: '进入 init：同一个 pid 1 分三段执行。FirstStageMain 在 ramdisk 里挂 /dev、加载内核模块、挂载 system / vendor，然后 execv 自己进入 SetupSelinux 加载策略，再 execv 进入 SecondStageMain。',
      code: C(`${INIT}/main.cpp`, 'argv[1] == "selinux_setup" → SetupSelinux\nargv[1] == "second_stage"  → SecondStageMain\n否则 → FirstStageMain'),
    },
    {
      to: 4110,
      move: 2.5,
      hold: 9,
      focus: ['init-parser', 'service-list', 'init-service'],
      caption: 'SecondStageMain：PropertyInit、StartPropertyService，再 LoadBootScripts——Parser 解析 init.rc 和各分区 /etc/init/*.rc，service 段进 ServiceList（这里只是声明，还没启动）。',
      code: C(`${INIT}/init.cpp · LoadBootScripts`, 'parser.ParseConfig("/system/etc/init/hw/init.rc")'),
    },
    {
      to: 4140,
      move: 1.5,
      hold: 7,
      focus: ['init-parser', 'action-manager'],
      caption: 'on 段进 ActionManager：每个 action 是"触发条件 + 一串命令"，条件可以是事件（on boot）或属性（on property:…）。',
      code: C(`${INIT}/action_manager.cpp`),
    },
    {
      to: 4210,
      move: 2,
      hold: 8,
      focus: ['action-manager'],
      caption: '排入 early-init → init → late-init 三个事件触发器，然后进入主循环：每轮 ExecuteOneCommand 执行一条命令，再处理进程退出、等 epoll。',
      code: C(`${INIT}/init.cpp · SecondStageMain`, 'am.QueueEventTrigger("early-init");\nam.QueueEventTrigger("init");\nam.QueueEventTrigger("late-init");'),
    },
    {
      to: 4447,
      move: 2.5,
      hold: 8,
      focus: ['action-manager', 'init-service'],
      caption: 'on init 里 start servicemanager：ServiceList 找到这个 Service，Service::Start fork + exec，并把 init.svc.servicemanager 设为 running。',
      code: C(`${INIT}/service.cpp · Service::Start`),
    },
    {
      to: 4610,
      move: 2,
      hold: 8,
      focus: ['action-manager'],
      caption: 'on late-init 不直接做事，而是继续触发：early-fs → fs → post-fs → late-fs → post-fs-data → load-bpf-programs → zygote-start → firmware_mounts_complete → boot。',
      code: C('rootdir/init.rc · on late-init'),
    },
    {
      to: 5318,
      view: [5150, 5750],
      move: 2.5,
      hold: 8,
      focus: ['init-service'],
      caption: 'on zygote-start：start zygote——init.zygote64.rc 里声明它是 /system/bin/app_process64 --zygote --start-system-server，并带一个 socket zygote。',
      code: C('rootdir/init.zygote64.rc', 'service zygote /system/bin/app_process64 -Xzygote …\n    --zygote --start-system-server --socket-name=zygote\n    class main\n    socket zygote stream 660 root system'),
    },
    {
      to: 5515,
      move: 2,
      hold: 8,
      focus: ['service-list', 'init-service'],
      caption: 'on boot：class_start core 一次启动所有 class 为 core 的服务，surfaceflinger（class core animation）就在这时起来。',
      code: C('rootdir/init.rc · on boot', '… class_start core'),
    },
    {
      to: 5940,
      view: [5860, 6000],
      move: 2.5,
      hold: 9,
      focus: ['property-service', 'init-service'],
      caption: 'SF 设置 ctl.start=bootanim：PropertyService 收到 ctl. 开头的属性不当普通属性存，而是 SendControlMessage 交给主循环，HandleControlMessage 启动 bootanim——disabled 的服务只能这样被点名启动。',
      code: C(`${INIT}/property_service.cpp · HandlePropertySet`, 'if (StartsWith(name, "ctl.")) {\n  return SendControlMessage(name.c_str() + 4, value, …);\n}'),
    },
    {
      to: 16790,
      view: [16700, 16850],
      move: 3,
      hold: 8,
      focus: ['action-manager'],
      caption: '开机快结束时 sys.boot_completed 变为 1：PropertyChanged → QueuePropertyChange，init.rc 里所有 on property:sys.boot_completed=1 的动作开始执行。',
      code: C(`${INIT}/init.cpp · PropertyChanged`, 'rootdir/init.rc：on property:sys.boot_completed=1'),
    },
  ],
};

// ═══════════════ ② 进入 zygote ═══════════════
export const bootZygoteStory: FlowStory = {
  steps: [
    {
      to: 5330,
      view: [5300, 7400],
      move: 1.5,
      hold: 8,
      caption: '进入 zygote：init 执行的其实是 app_process64。它创建 AndroidRuntime，start 里先 startVm 起 ART 虚拟机，再 startReg 注册 framework 的 JNI 函数。',
      code: C('base/cmds/app_process/app_main.cpp · main', 'runtime.start("com.android.internal.os.ZygoteInit", args, zygote);'),
    },
    {
      to: 5600,
      move: 2,
      hold: 8,
      focus: ['android-runtime', 'zygote-init'],
      caption: 'AndroidRuntime::start 最后 CallStaticVoidMethod 调 ZygoteInit.main——从这里进入 Java 世界，而且这个调用永远不会返回。',
      code: C('core/jni/AndroidRuntime.cpp · start', 'startVm(&mJavaVM, &env, zygote, primary_zygote)\nstartReg(env)\nenv->CallStaticVoidMethod(startClass, startMeth, strArray)'),
    },
    {
      to: 6500,
      move: 2.5,
      hold: 9,
      focus: ['zygote-init'],
      caption: 'preload：把常用的类、资源、共享库预先加载进来。之后每个应用都从 zygote fork，这些内存按页共享，不用每个进程重新加载——这也是开机里最耗时的几段之一。',
      code: C('core/java/com/android/internal/os/ZygoteInit.java · preload', 'preloadClasses();\nResources.preloadResources();\npreloadSharedLibraries();'),
    },
    {
      to: 7215,
      move: 2.5,
      hold: 7,
      focus: ['zygote-server'],
      caption: 'new ZygoteServer：接管 init 按 rc 声明好的 socket zygote，以后 AMS 就是往这个 socket 写 fork 请求。',
      code: C('ZygoteInit.java · main', 'zygoteServer = new ZygoteServer(isPrimaryZygote);'),
    },
    {
      to: 7330,
      move: 2,
      hold: 8,
      focus: ['zygote-init', 'zygote-server'],
      caption: 'forkSystemServer：子进程里 handleSystemServerProcess 走到 SystemServer.main；zygote 自己进入 runSelectLoop，此后一直在等 socket。',
      code: C('ZygoteInit.java · forkSystemServer', 'pid = Zygote.forkSystemServer(…);\nif (pid == 0) return handleSystemServerProcess(parsedArgs);\n…\ncaller = zygoteServer.runSelectLoop(abiList);'),
    },
    {
      to: 13560,
      view: [13450, 13700],
      move: 3,
      hold: 9,
      focus: ['zygote-server'],
      caption: '几秒后 AMS 发来请求：runSelectLoop 收到后 processCommand → forkAndSpecialize，先后 fork 出 Launcher 和 SystemUI（细节见「应用冷启动」的 zygote 一段）。',
      code: C('core/java/com/android/internal/os/ZygoteConnection.java · processCommand'),
    },
  ],
};

// ═══════════════ ② 进入 system_server ═══════════════
export const bootSystemServerStory: FlowStory = {
  steps: [
    {
      to: 7310,
      view: [7300, 8000],
      move: 1.5,
      hold: 7,
      caption: '进入 system_server：SystemServer.main → new SystemServer().run()。主线程先 prepareMainLooper、加载 libandroid_servers。',
      code: C('services/java/com/android/server/SystemServer.java · run'),
    },
    {
      to: 7500,
      move: 2,
      hold: 7,
      focus: ['system-server', 'activity-thread'],
      caption: 'createSystemContext：ActivityThread.systemMain 给 system_server 也建一个"应用环境"，拿到系统 Context——系统服务也是跑在 ActivityThread 上的。',
      code: C('SystemServer.java · createSystemContext', 'ActivityThread activityThread = ActivityThread.systemMain();\nmSystemContext = activityThread.getSystemContext();'),
    },
    {
      to: 7812,
      move: 2.5,
      hold: 9,
      focus: ['system-service-manager', 'atms', 'service-manager'],
      caption: 'new SystemServiceManager 之后，服务都由它启动：startService(Lifecycle) 反射构造 → onStart → publishBinderService，向 servicemanager 登记 "activity_task"。',
      code: C('services/core/java/com/android/server/SystemServiceManager.java · startService', 'service.onStart();'),
    },
    {
      to: 7880,
      move: 2,
      hold: 7,
      focus: ['ams'],
      caption: 'ActivityManagerService 紧接着启动，并拿到 ATMS 的引用；PowerManager、DisplayManager 随后同样经 SystemServiceManager 起来。',
      code: C('SystemServer.java · startBootstrapServices', 'ActivityTaskManagerService atm = mSystemServiceManager.startService(\n        ActivityTaskManagerService.Lifecycle.class).getService();\nmActivityManagerService = ActivityManagerService.Lifecycle.startService(…, atm);'),
    },
    {
      to: 8560,
      view: [8500, 8700],
      move: 2.5,
      hold: 8,
      focus: ['system-service-manager', 'display-ms'],
      caption: 'boot phase 是"全体广播"：startBootPhase(100) 对每个已启动的服务调 onBootPhase(100)，DisplayManagerService 借此等默认屏准备好。',
      code: C('SystemServiceManager.java · startBootPhase', 'for (…) service.onBootPhase(mCurrentPhase);'),
    },
    {
      to: 9777,
      view: [9600, 9900],
      move: 2.5,
      hold: 8,
      focus: ['pms', 'ams'],
      caption: 'PackageManagerService.main 扫描所有已安装应用（开机最慢的一段之一），登记 "package"；AMS.setSystemProcess 登记 "activity" 等服务。',
      code: C('SystemServer.java · startBootstrapServices', 'mPackageManagerService = PackageManagerService.main(…);\nmActivityManagerService.setSystemProcess();'),
    },
    {
      to: 10802,
      view: [10300, 10900],
      move: 2.5,
      hold: 8,
      focus: ['wms', 'ims'],
      caption: 'startOtherServices：new InputManagerService，WindowManagerService.main 构造 WMS，SystemServer 直接把 "window" 和 "input" 登记到 servicemanager。',
      code: C('SystemServer.java · startOtherServices', 'wm = WindowManagerService.main(context, inputManager, …);\nServiceManager.addService(Context.WINDOW_SERVICE, wm, …);'),
    },
    {
      to: 13310,
      view: [13150, 13650],
      move: 3,
      hold: 9,
      focus: ['ams', 'system-service-manager'],
      caption: 'AMS.systemReady(goingCallback)：先回调 SystemServer——PHASE 550 ACTIVITY_MANAGER_READY、600 THIRD_PARTY_APPS_CAN_START，各服务据此开始对外工作。',
      code: C('ActivityManagerService.java · systemReady', 'if (goingCallback != null) goingCallback.run();'),
    },
    {
      to: 13515,
      move: 2,
      hold: 8,
      focus: ['ams', 'atms'],
      caption: '回调之后 startHomeOnAllDisplays：桌面 Activity 的进程还不存在，于是经 ProcessList 用 socket 请 zygote fork。systemReady 返回后，SystemServer 再 startSystemUi。',
      code: C('ActivityManagerService.java · systemReady', 'mAtmInternal.startHomeOnAllDisplays(currentUserId, "systemReady");'),
    },
    {
      to: 15805,
      view: [15200, 16000],
      move: 3,
      hold: 9,
      focus: ['wms'],
      caption: '桌面首帧画好：WMS.performEnableScreen 确认锁屏 / 壁纸 / 桌面都画完，设 service.bootanim.exit=1；等开机动画真的停了，才调 SurfaceControl.bootFinished。',
      code: C('wm/WindowManagerService.java · performEnableScreen', 'SystemProperties.set("service.bootanim.exit", "1");\n…\nif (!SurfaceControl.bootFinished()) …'),
    },
    {
      to: 16700,
      view: [15900, 17000],
      move: 2.5,
      hold: 8,
      focus: ['ams', 'system-service-manager'],
      caption: 'bootAnimationComplete → finishBooting：startBootPhase(1000 · BOOT_COMPLETED)，随后 sys.boot_completed=1、发 BOOT_COMPLETED。',
      code: C('am/ActivityManagerService.java · finishBooting'),
    },
  ],
};

// ═══════════════ ④ 外部可观测：getprop / service list / ps / SurfaceFlinger ═══════════════
export const bootPropsStory: FlowStory = {
  steps: [
    {
      to: 200,
      move: 1.5,
      hold: 8,
      caption: '用 adb 能看到的东西去观察开机：getprop、service list、ps -A、dumpsys SurfaceFlinger --list。此刻还在 Bootloader，什么都没有。',
      code: C('说明', '格式是示意：只保留关键的行'),
    },
    {
      to: 4600,
      move: 2.5,
      hold: 8,
      caption: 'init 起来后：ps 里出现 init / ueventd / logd / servicemanager，对应的 init.svc.* 属性为 running；service list 里只有 servicemanager 自己。',
      code: C('rootdir/init.rc · on early-init / on init'),
    },
    {
      to: 6100,
      move: 2.5,
      hold: 9,
      caption: 'zygote、surfaceflinger、bootanimation 相继出现；service list 多了 SurfaceFlinger；service.bootanim.exit=0；SurfaceFlinger 里有了 BootAnimation 图层——屏幕上看到的就是它。',
      code: C('native/services/surfaceflinger/SurfaceFlinger.cpp · initBootProperties'),
    },
    {
      to: 7400,
      move: 2,
      hold: 7,
      caption: 'system_server 进程出现（zygote fork）。',
      code: C('ZygoteInit.java · forkSystemServer'),
    },
    {
      to: 10900,
      move: 3,
      hold: 9,
      caption: 'service list 一路变长：activity_task、power、display、package、activity、window、input……（真机上有上百个）。开机卡住时，先看哪个服务没登记，就知道卡在哪一批。',
      code: C('SystemServer.java · startBootstrapServices / startOtherServices'),
    },
    {
      to: 13800,
      move: 2.5,
      hold: 7,
      caption: 'Launcher 和 SystemUI 进程出现，但它们的窗口还被开机动画盖着。',
      code: C('ActivityManagerService.java · systemReady'),
    },
    {
      to: 15700,
      move: 3,
      hold: 9,
      caption: 'service.bootanim.exit=1 → bootanimation 进程消失、init.svc.bootanim=stopped、BootAnimation 图层没了，桌面和状态栏露出来。',
      code: C('WindowManagerService.java · performEnableScreen'),
    },
    {
      to: 17000,
      move: 2.5,
      hold: 9,
      caption: 'sys.boot_completed=1：脚本里常用 `adb wait-for-device shell getprop sys.boot_completed` 判断开机完成，看的就是这一个属性。和开机前相比，Δ 标记的就是开机留下的全部状态。',
      code: C('am/ActivityManagerService.java · finishBooting', 'SystemProperties.set("sys.boot_completed", "1");'),
    },
  ],
};
