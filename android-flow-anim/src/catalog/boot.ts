import type {ComponentDef} from './types';

/** 开机流程专用组件（init / zygote / launcher / ams / wms 等复用 system.ts） */
export const BOOT_COMPONENTS: ComponentDef[] = [
  {
    id: 'bootloader',
    short: 'Bootloader',
    label: 'Boot ROM → Bootloader · AVB',
    process: 'hw',
    role: '校验并加载 boot / init_boot / vendor_boot，跳转内核',
  },
  {
    id: 'kernel-core',
    short: 'Kernel',
    label: 'Linux Kernel · 驱动 / ramdisk',
    process: 'kernel',
    role: '初始化硬件与驱动，以 pid 1 执行 /init',
  },
  {
    id: 'bootanim',
    short: 'bootanimation',
    label: 'bootanimation',
    process: 'native',
    role: '开机动画；SF 通过 ctl.start 请 init 启动，service.bootanim.exit=1 时退出',
    src: 'frameworks/base/cmds/bootanimation/',
  },
  {
    id: 'system-server',
    short: 'SystemServer',
    label: 'SystemServer · SystemServiceManager',
    process: 'system_server',
    role: '分三批启动系统服务，并推进 boot phase',
    src: 'server/SystemServer.java',
  },
  {
    id: 'surfaceflinger',
    short: 'SurfaceFlinger',
    label: 'SurfaceFlinger · 合成 / VSYNC',
    process: 'surfaceflinger',
    role: '显示合成；初始化后请求启动开机动画',
  },
];
