import type {FlowStory} from '../../dsl/types';
import {storySeconds} from '../../engine/camera';
import {bootInitStory, bootProcessStory, bootPropsStory, bootSystemServerStory, bootZygoteStory} from '../../flows/boot/stories';
import {bootGridStory, bootStory} from '../../flows/system/boot';
import {FPS} from '../../theme';
import type {SceneEntry} from '../frame-lifecycle';
import {
  BootEndingScene,
  BootGridScene,
  BootInitScene,
  BootMap,
  BootOverviewScene,
  BootPhaseScene,
  BootProcessScene,
  BootPropsScene,
  BootSystemServerScene,
  BootTitleScene,
  BootZygoteScene,
} from './scenes';

const f = (s: number) => Math.round(s * FPS);
const story = (st: FlowStory) => f(storySeconds(st.steps) + 0.5);

/** 进程 → 进程内部（init / zygote / system_server）→ 阶段 → adb 可观测 */
export const BOOT_SCENES: SceneEntry[] = [
  {id: 'Title', Component: BootTitleScene, frames: f(4)},
  {id: 'Process', Component: BootProcessScene, frames: story(bootProcessStory)},
  {id: 'Init', Component: BootInitScene, frames: story(bootInitStory)},
  {id: 'Zygote', Component: BootZygoteScene, frames: story(bootZygoteStory)},
  {id: 'SystemServer', Component: BootSystemServerScene, frames: story(bootSystemServerStory)},
  {id: 'Phase', Component: BootPhaseScene, frames: story(bootGridStory)},
  {id: 'Props', Component: BootPropsScene, frames: story(bootPropsStory)},
  {id: 'Ending', Component: BootEndingScene, frames: f(10)},
];

/** 旧版：全景图 + 泳道 + 服务网格（旧脚本），保留用于对比 */
export const BOOT_LEGACY_SCENES: SceneEntry[] = [
  {id: 'Map', Component: BootMap.Component, frames: f(BootMap.seconds)},
  {id: 'Overview', Component: BootOverviewScene, frames: story(bootStory)},
  {id: 'Grid', Component: BootGridScene, frames: story(bootGridStory)},
];
