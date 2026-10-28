import type {ComponentDef} from './types';

export const SYSTEM_COMPONENTS: ComponentDef[] = [
  {
    id: 'wms',
    short: 'WMS',
    label: 'WMS · SurfaceControl 容器树',
    process: 'system_server',
    role: '维护与窗口层级同构的容器树，发层级 / 几何 / 可见性事务',
    never: '不画像素、不跑窗口动画',
    src: 'wm/',
  },
  {
    id: 'atms',
    short: 'ATMS',
    label: 'ATMS · Activity / Task 调度',
    process: 'system_server',
    role: 'Activity / Task 启动与调度',
    stateMachines: ['activity-record', 'transition'],
  },
  {id: 'ams', short: 'AMS', label: 'AMS · 进程 / 四大组件', process: 'system_server', role: '进程生命周期、广播、Service、Provider'},
  {id: 'pwm', short: 'PhoneWindowManager', label: 'PhoneWindowManager · 按键策略', process: 'system_server', role: 'Home / Back / Power 等系统按键策略'},
  {id: 'ims', short: 'InputManagerService', label: 'InputReader / InputDispatcher', process: 'system_server', role: '读取、映射、分发输入事件'},
  {id: 'sysui-win', short: 'SystemUI 窗口', label: 'SystemUI 窗口 · shade / nav bar', process: 'systemui', role: '和普通应用窗口走同一条渲染管线'},
  {id: 'launcher', short: 'Launcher', label: 'Launcher (Quickstep)', process: 'app', role: '桌面；手势导航时负责跟手动画'},
  {id: 'zygote', short: 'Zygote', label: 'Zygote · 预加载 + fork', process: 'native', role: '预加载类与资源，fork 应用进程'},
  {id: 'init', short: 'init', label: 'init (pid 1)', process: 'native', role: '解析 init.rc 拉起系统服务'},
  {
    id: 'activity-thread',
    short: 'ActivityThread',
    label: 'com.foo · ActivityThread',
    process: 'app',
    role: '应用主线程入口：attach、bindApplication、执行 ClientTransaction',
    src: 'app/ActivityThread.java',
  },
  {
    id: 'navbar',
    short: 'NavigationBar',
    label: 'NavigationBar · KeyButtonView',
    process: 'systemui',
    role: '三键导航栏；按钮按下 / 抬起时注入对应 KeyEvent',
    src: 'packages/SystemUI/.../navigationbar/',
  },
];
