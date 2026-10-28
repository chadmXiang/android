import {call, mark, msg, newInst, oneway, post, set, span, state, timeout} from '../../dsl/builders';
import type {FlowEvent, FlowScript, FlowStory} from '../../dsl/types';

/**
 * Service 启动与 Service ANR（示意时序，非实测；方法名对照 frameworks/base 源码核对）
 *
 * startServiceLocked → bringUpServiceLocked → realStartServiceLocked
 *   → bumpServiceExecutingLocked("create")：executeNesting++，nesting 从 0 起时 scheduleServiceTimeoutLocked
 *     → mActiveServiceAnrTimer.start(proc, SERVICE_TIMEOUT)（前台 20s × HW_TIMEOUT_MULTIPLIER，后台 ×10）
 *   → scheduleCreateService；sendServiceArgsLocked → bump("start") → scheduleServiceArgs
 * 应用每做完一步 serviceDoneExecuting → serviceDoneExecutingLocked：nesting--，到 0 时 mActiveServiceAnrTimer.cancel(app)
 * 到期：SERVICE_TIMEOUT_MSG（AMS MainHandler）→ ActiveServices.serviceTimeout → mAnrHelper.appNotResponding
 */

const TIMEOUT = 20000;

const base = (id: string, title: string, subtitle: string, window: [number, number]): Omit<FlowScript, 'events'> => ({
  id,
  title,
  subtitle,
  kind: 'state',
  window,
  processes: [
    {id: 'foo', label: 'com.foo', layer: 'app'},
    {id: 'system_server', label: 'system_server', layer: 'system_server'},
  ],
  lanes: [
    {id: 'foo:main', label: 'com.foo · main', sub: 'ActivityThread / ContextImpl', process: 'foo', cls: 'activity-thread'},
    {id: 'foo:binder', label: 'com.foo · binder', sub: 'ApplicationThread', process: 'foo', cls: 'application-thread'},
    {id: 'ss:binder', label: 'system_server · binder', sub: 'AMS / ActiveServices', process: 'system_server', cls: 'active-services', inst: 'as'},
    {id: 'ss:am', label: 'system_server · ActivityManager', sub: 'MainHandler · 计时器到期', process: 'system_server', cls: 'ams'},
    {id: 'ss:anr', label: 'system_server · AnrHelper', sub: 'appNotResponding · dump', process: 'system_server'},
  ],
  resources: [],
  instances: [
    {id: 'as', cls: 'active-services', process: 'system_server'},
    {id: 'svc', cls: 'service-record', process: 'system_server', label: 'com.foo/.SyncService'},
  ],
});

/** 两份脚本共用的前半段：到 scheduleCreateService / scheduleServiceArgs 投递为止 */
const START: FlowEvent[] = [
  span('foo:main', 0, 1.5, 'Context.startService(intent)', 'cpu'),
  call(1.5, 'foo:main', 'ss:binder', 'IActivityManager.startService', 9),
  span('ss:binder', 1.5, 9, 'startServiceLocked → bringUpServiceLocked → realStartServiceLocked', 'cpu'),
  newInst(2.5, 'as', 'svc'), // retrieveServiceLocked → new ServiceRecord
  state(2.5, 'svc', 'NEW', 'ss:binder'),
  state(4, 'svc', 'BRINGING_UP', 'ss:binder'),
  // realStartServiceLocked → bumpServiceExecutingLocked(r, execInFg, "create")
  state(6, 'svc', 'EXECUTING', 'ss:binder'),
  set(6, 'svc', 'executeNesting', '1'),
  set(6, 'svc', 'executeFg', 'true'),
  mark(6, 'ss:binder', 'scheduleServiceTimeoutLocked', 'warn'),
  oneway(7, 'ss:binder', 'foo:binder', 'scheduleCreateService'),
  span('foo:binder', 7, 7.6, 'scheduleCreateService', 'cpu'),
  post(7.6, 'foo:binder', 'foo:main', 'CREATE_SERVICE', 10),
  // sendServiceArgsLocked → bump("start")
  set(8, 'svc', 'executeNesting', '2'),
  oneway(8, 'ss:binder', 'foo:binder', 'scheduleServiceArgs'),
  span('foo:binder', 8, 8.6, 'scheduleServiceArgs', 'cpu'),
];

export const serviceStartScript: FlowScript = {
  ...base('service-start', 'Service 启动（正常）', '示意时序 · onCreate / onStartCommand 都很快', [-5, 21500]),
  events: [
    ...START,
    post(8.6, 'foo:binder', 'foo:main', 'SERVICE_ARGS', 45),
    timeout('svc-timeout', 6, TIMEOUT, 'ss:binder', 'mActiveServiceAnrTimer · SERVICE_TIMEOUT', {object: 'svc', cancelAt: 62}),
    span('foo:main', 10, 40, 'handleCreateService · Service.onCreate()', 'cpu'),
    call(40, 'foo:main', 'ss:binder', 'serviceDoneExecuting(ANON)', 44),
    span('ss:binder', 40, 44, 'serviceDoneExecutingLocked · nesting--', 'cpu'),
    set(42, 'svc', 'executeNesting', '1'),
    span('foo:main', 45, 60, 'handleServiceArgs · onStartCommand()', 'cpu'),
    call(60, 'foo:main', 'ss:binder', 'serviceDoneExecuting(START)', 64),
    span('ss:binder', 60, 64, 'serviceDoneExecutingLocked · nesting → 0', 'cpu'),
    set(62, 'svc', 'executeNesting', '0'),
    set(62, 'svc', 'executeFg', 'false'),
    state(62, 'svc', 'STARTED', 'ss:binder'),
    mark(63, 'ss:binder', 'mActiveServiceAnrTimer.cancel(app)', 'ok'),
  ],
};

export const serviceAnrScript: FlowScript = {
  ...base('service-anr', 'Service ANR（onCreate 阻塞）', '示意时序 · 主线程在 onCreate 里同步 IO，超过 SERVICE_TIMEOUT', [-5, 21500]),
  events: [
    ...START,
    post(8.6, 'foo:binder', 'foo:main', 'SERVICE_ARGS', 21410),
    timeout('svc-timeout', 6, TIMEOUT, 'ss:binder', 'mActiveServiceAnrTimer · SERVICE_TIMEOUT'  , {object: 'svc'}),
    span('foo:main', 10, 21400, 'handleCreateService · onCreate() 阻塞（主线程同步 IO）', 'wait'),
    // 到期：AnrTimer 把 SERVICE_TIMEOUT_MSG 投到 AMS 的 MainHandler（ActivityManager 线程）
    span('ss:am', TIMEOUT + 6, TIMEOUT + 14, 'SERVICE_TIMEOUT_MSG → ActiveServices.serviceTimeout', 'cpu'),
    mark(TIMEOUT + 10, 'ss:am', 'Timeout executing service', 'bad'),
    state(TIMEOUT + 12, 'svc', 'ANR', 'ss:am'),
    msg(TIMEOUT + 14, 'ss:am', 'ss:anr', 'mAnrHelper.appNotResponding'),
    span('ss:anr', TIMEOUT + 14, TIMEOUT + 900, 'AnrHelper · dump traces → ANR 对话框', 'cpu'),
    mark(TIMEOUT + 900, 'ss:anr', 'ANR in com.foo', 'bad'),
  ],
};

const CODE_BUMP = {
  file: 'am/ActiveServices.java · realStartServiceLocked → bumpServiceExecutingLocked → scheduleServiceTimeoutLocked',
  note: 'executeNesting++；nesting 从 0 起时启动\nmActiveServiceAnrTimer.start(proc, delay)\ndelay = 前台 SERVICE_TIMEOUT（20s × HW_TIMEOUT_MULTIPLIER），\n后台 SERVICE_BACKGROUND_TIMEOUT（×10）',
};
const CODE_DONE = {
  file: 'app/ActivityThread.java · handleCreateService → am/ActiveServices.java · serviceDoneExecutingLocked',
  note: 'onCreate 返回后 serviceDoneExecuting(ANON)；\nexecuteNesting-- 到 0 时\nmActiveServiceAnrTimer.cancel(r.app)，executeFg = false',
};
const CODE_TIMEOUT = {
  file: 'am/ActivityManagerService.java · MainHandler SERVICE_TIMEOUT_MSG → am/ActiveServices.java · serviceTimeout',
  note: 'mActiveServiceAnrTimer = new ProcessAnrTimer(..., SERVICE_TIMEOUT_MSG)；\n到期 → serviceTimeout(proc) → "Timeout executing service"\n→ mAnrHelper.appNotResponding(proc, TimeoutRecord.forServiceExec)',
};

/** 状态驱动模板：看 ServiceRecord 的阶段、谁推动它、以及 20s 倒计时 */
export const serviceAnrStateStory: FlowStory = {
  steps: [
    {
      to: 0,
      view: [-5, 70],
      move: 1.5,
      hold: 7,
      caption: 'Service ANR 的本质是一个计时器：AMS 每让应用执行一步 Service 回调就"计一次数"并开始计时，应用做完要回来报告；计数归零才取消计时。中间是 ServiceRecord 的阶段，四周是推动它的线程。',
      code: {file: '说明', note: '状态名是示意，\n真实字段是 executeNesting / executeFg / executingStart。'},
    },
    {
      to: 8.5,
      move: 3,
      hold: 9,
      caption: '① startService 进 AMS：retrieveServiceLocked 新建 ServiceRecord → bringUpServiceLocked → realStartServiceLocked。bumpServiceExecutingLocked 让 executeNesting 变 1，并启动 mActiveServiceAnrTimer；随后投递 scheduleCreateService 和 scheduleServiceArgs，nesting 变 2。',
      code: CODE_BUMP,
    },
    {
      to: 40,
      move: 2.5,
      hold: 8,
      caption: '② 应用主线程取出 CREATE_SERVICE，进入 onCreate——这里在主线程做了同步 IO，一直不返回。SERVICE_ARGS 只能在 MessageQueue 里排队，executeNesting 停在 2，计时器继续走。',
      code: {file: 'app/ActivityThread.java · handleCreateService', note: 'service.onCreate() 返回后才会\nActivityManager.getService().serviceDoneExecuting(...)'},
    },
    {
      to: 15000,
      view: [-5, 21500],
      move: 4,
      hold: 7,
      caption: '③ 把镜头拉远到 20 秒：主线程一直卡在 onCreate（左侧 ⏸），没有任何 serviceDoneExecuting 回到 AMS，倒计时环一圈圈走向到期。',
      code: CODE_BUMP,
    },
    {
      to: 20500,
      move: 4,
      hold: 9,
      caption: '④ 20 秒到：AnrTimer 把 SERVICE_TIMEOUT_MSG 投到 AMS 的 MainHandler，ActiveServices.serviceTimeout 发现仍有执行中的 Service → "Timeout executing service" → AnrHelper.appNotResponding 抓 trace、弹 ANR 对话框。',
      code: CODE_TIMEOUT,
    },
  ],
};

/** 对比模板：同一个 startService，A 正常、B 在 onCreate 阻塞；两边共用时间轴 */
export const serviceCompareStory: FlowStory = {
  steps: [
    {
      to: 0,
      view: [-5, 70],
      move: 1.5,
      hold: 7,
      caption: '同一个 startService，上面 A 是正常情况，下面 B 是 onCreate 在主线程做同步 IO。两边共用同一条时间轴，右侧列出已经出现的差异。',
    },
    {
      to: 9.5,
      move: 3,
      hold: 8,
      caption: '① 前半段完全一样：AMS 计数 + 启动计时器，投递 scheduleCreateService / scheduleServiceArgs。右侧"目前两边一致"。',
      code: CODE_BUMP,
    },
    {
      to: 66,
      move: 3,
      hold: 10,
      caption: '② 从主线程处理 CREATE_SERVICE 开始分歧（橙色虚线）：A 的 onCreate 30ms 就返回，两次 serviceDoneExecuting 把 nesting 减到 0，计时器取消；B 仍卡在 onCreate，计时器还在走。',
      code: CODE_DONE,
    },
    {
      to: 20600,
      view: [-5, 21500],
      move: 4,
      hold: 10,
      caption: '③ 拉远到 20 秒：A 早已结束；B 的计时器到期 → serviceTimeout → appNotResponding。差异面板里"仅 B"的几条，就是 ANR 现场在日志里会出现的东西。',
      code: CODE_TIMEOUT,
    },
  ],
};
