import React from 'react';
import {bootGridStory, bootScript, bootStory} from '../../flows/system/boot';
import {BOOT_GRAPH_SETS, bootFullScript} from '../../flows/boot/bootFull';
import {bootInitStory, bootProcessStory, bootPropsStory, bootSystemServerStory, bootZygoteStory} from '../../flows/boot/stories';
import {makeMapScene} from '../../layouts/MapStory';
import {makeTemplateScene} from '../../layouts/TemplateScene';
import {colors} from '../../theme';
import {SummaryCard, TitleCard} from '../../views/Cards';

const BLUE = '#60a5fa';

export const BootTitleScene: React.FC = () => (
  <TitleCard
    kicker="AOSP · 开机（示意时序 · init 对照 AOSP main，其余对照本机 base / native）"
    title="开机流程：四个维度"
    subtitle="① 进程之间的接力 · ② init / zygote / system_server 里面 · ③ 服务与 boot phase · ④ 用 adb 能看到什么"
    chips={['进程', '类', '阶段', 'getprop']}
  />
);

// 拐点坐标依赖 layoutMap 的堆叠结果；改组件顺序或进程坑位时需同步
export const BootMap = makeMapScene({
  title: '开机经过的组件',
  components: ['bootloader', 'kernel-core', 'init', 'zygote', 'bootanim', 'system-server', 'ams', 'wms', 'launcher', 'surfaceflinger'],
  intro: '从上电到桌面：固件、内核、init、Zygote、system_server，最后拉起桌面，一棒接一棒。',
  outro: '一句话：Bootloader 校验加载，Kernel 交给 init，init 按 rc 拉服务，Zygote 孵化 Java 世界，system_server 起服务、拉桌面。',
  legend: [
    {label: '跳转 / exec', color: colors.lime},
    {label: 'init 拉起（spawn）', color: colors.sf},
    {label: 'fork', color: colors.pink},
    {label: 'binder', color: BLUE},
    {label: '属性 / 通知', color: colors.orange},
  ],
  edges: [
    {
      from: 'bootloader', to: 'kernel-core', label: 'AVB 校验 · 跳转内核', color: colors.lime,
      desc: 'Bootloader 校验 boot / init_boot 等分区后加载内核，跳转到内核入口。',
    },
    {
      from: 'kernel-core', to: 'init', label: 'exec /init（pid 1）', color: colors.pink,
      via: [[920, 760], [183, 760]], labelAt: [550, 760],
      desc: '内核初始化完成后，以 pid 1 执行 ramdisk 里的 /init。',
    },
    {
      from: 'init', to: 'zygote', label: 'spawn', color: colors.sf,
      via: [[210, 742], [340, 742]], labelAt: [275, 742],
    },
    {
      from: 'init', to: 'surfaceflinger', label: 'spawn（class core）', color: colors.sf,
      via: [[95, 684], [95, 588], [1200, 588], [1200, 234]], labelAt: [700, 588],
      desc: 'boot 触发器执行 class_start core，SurfaceFlinger 随 core 类服务启动。',
    },
    {
      from: 'surfaceflinger', to: 'bootanim', label: 'ctl.start bootanim（经 init）', color: colors.orange,
      via: [[1540, 576], [630, 576], [630, 684]], labelAt: [1540, 420],
      desc: 'SF 在 initBootProperties 异步线程里写 ctl.start 属性，请 init 启动开机动画（bootanim 是 disabled + oneshot）。',
    },
    {
      from: 'zygote', to: 'system-server', label: 'forkSystemServer', color: colors.pink,
      via: [[340, 602], [665, 602], [665, 219]], labelAt: [665, 500],
      desc: 'Zygote 预加载完成后 fork 出 system_server。',
    },
    {
      from: 'ams', to: 'launcher', label: 'startHomeOnAllDisplays', color: BLUE,
      labelAt: [640, 350],
      desc: 'AMS.systemReady 内部调 startHomeOnAllDisplays，经 Zygote fork 出桌面进程。',
    },
    {
      from: 'wms', to: 'surfaceflinger', label: 'bootFinished', color: colors.orange,
      desc: 'WMS 先设 service.bootanim.exit=1，bootanimation 自己轮询退出；WMS 确认它停止后才调 SurfaceControl.bootFinished。',
    },
  ],
});

/** 阶段模板：章节条 + 泳道（主视图覆盖为 swimlane） */
export const BootOverviewScene = makeTemplateScene({
  script: bootScript,
  story: bootStory,
  slots: {chapters: 'chapters', main: 'swimlane', s1: 'screen', s2: 'props', s3: 'code'},
  arrowKinds: ['spawn', 'fork', 'socket', 'call', 'return', 'message'],
});

/** 阶段模板默认：章节条 + 服务网格 + 手机 + 属性 + 源码 */
export const BootGridScene = makeTemplateScene({
  script: bootScript,
  story: bootGridStory,
  title: '服务是怎么一批批起来的',
  subtitle: 'init 的 native 服务 → system_server 三批服务 → boot phase',
});

// ─────────── 新版：同一份脚本 bootFullScript，四个维度 ───────────
const SUB = '时序为示意 · init 对照 AOSP main，其余对照本机源码';
const GRAPH = (set: string) => ({kind: 'call-chain' as const, options: {graphSets: BOOT_GRAPH_SETS}, slots: {main: `graph:${set}`, s1: `callstack:${set}`, s2: 'code'}});

/** ① 进程维度：谁把谁拉起来 */
export const BootProcessScene = makeTemplateScene({
  script: bootFullScript,
  story: bootProcessStory,
  title: '① 进程维度：一棒接一棒',
  subtitle: SUB,
  slots: {main: 'proc-seq', s1: 'screen', s2: 'props', s3: 'chapters', s4: 'code'},
});

/** ② 进程内部 */
export const BootInitScene = makeTemplateScene({...GRAPH('init'), script: bootFullScript, story: bootInitStory, title: '② 进入 init：三阶段 · rc · 触发器 · 属性', subtitle: SUB});
export const BootZygoteScene = makeTemplateScene({...GRAPH('zygote'), script: bootFullScript, story: bootZygoteStory, title: '② 进入 zygote：从 app_process 到 runSelectLoop', subtitle: SUB});
export const BootSystemServerScene = makeTemplateScene({
  ...GRAPH('system_server'),
  script: bootFullScript,
  story: bootSystemServerStory,
  title: '② 进入 system_server：服务怎么启动、怎么登记',
  subtitle: SUB,
});

/** ③ 阶段：服务网格 + boot phase（新脚本复用了旧脚本的服务 / 阶段事件） */
export const BootPhaseScene = makeTemplateScene({
  script: bootFullScript,
  story: bootGridStory,
  kind: 'phase',
  title: '③ 阶段：服务是怎么一批批起来的',
  subtitle: 'init 的 native 服务 → system_server 三批服务 → boot phase',
});

/** ④ 外部可观测：getprop / service list / ps / SurfaceFlinger */
export const BootPropsScene = makeTemplateScene({
  script: bootFullScript,
  story: bootPropsStory,
  kind: 'dumpsys',
  title: '④ 用 adb 看开机：每一步多了什么',
  subtitle: 'getprop · service list · ps -A · dumpsys SurfaceFlinger --list（格式示意）',
});

export const BootEndingScene: React.FC = () => (
  <SummaryCard
    heading="开机流程的四个要点"
    lines={[
      ['逐级接力', 'Boot ROM → Bootloader → Kernel → init → Zygote → system_server'],
      ['init 靠触发器', 'init.rc 的 trigger 决定先后：logd / servicemanager 在前，Zygote / SF 随后'],
      ['Zygote 是模板', '预加载一次，system_server 和所有应用都由它 fork（不 exec）'],
      ['开机动画何时退出', '桌面画完 → exit=1 → bootanim 自己退出 → WMS 确认后 bootFinished'],
      ['servicemanager 是目录', '每个对外服务都 addService 登记名字；service list 看开机卡在哪一批'],
    ]}
  />
);
