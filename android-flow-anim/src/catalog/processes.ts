import type {ProcessDef} from './types';

/** 全景图坑位固定：AMS / SF 在每个视频里都在同一位置 */
export const PROCESSES: ProcessDef[] = [
  {id: 'app', label: '应用进程', layer: 'app', box: {x: 80, y: 200, w: 520, h: 360}},
  {id: 'system_server', label: 'system_server', layer: 'system_server', box: {x: 700, y: 150, w: 440, h: 200}},
  {id: 'systemui', label: 'SystemUI 进程', layer: 'systemui', box: {x: 700, y: 380, w: 440, h: 180}},
  {id: 'surfaceflinger', label: 'surfaceflinger 进程', layer: 'native', box: {x: 1240, y: 150, w: 600, h: 410}},
  {id: 'hw', label: '硬件 / 驱动', layer: 'hw', box: {x: 1240, y: 610, w: 600, h: 120}},
  {id: 'native', label: 'native 守护进程', layer: 'native', box: {x: 80, y: 610, w: 520, h: 120}},
  {id: 'kernel', label: 'Linux Kernel', layer: 'kernel', box: {x: 700, y: 610, w: 440, h: 120}},
];
