import type {ClockProfile} from './types';

/** 对应文档 §4.3.3 的三种配置 */
export const CLOCK_PROFILES: ClockProfile[] = [
  {id: 'default-60', label: '60Hz · 默认 -1', refreshHz: 60, appWork: null, sfWork: null},
  {id: 'default-120', label: '120Hz · 默认 -1', refreshHz: 120, appWork: null, sfWork: null},
  {
    id: 'vendor-abs-120',
    label: '120Hz · 绝对值',
    refreshHz: 120,
    appWork: 16.6,
    sfWork: 15.6,
    note: '沿用 60Hz 的 debug.sf.late.*.duration',
  },
];
