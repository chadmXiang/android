import type {FlowStory} from '../../dsl/types';
import {storySeconds} from '../../engine/camera';
import {appStory, dumpsysStory, lifecycleStory, processStory, systemServerStory, zygoteStory} from '../../flows/launch/stories';
import {launchStory, launchTreeStory} from '../../flows/system/appLaunch';
import {FPS} from '../../theme';
import type {SceneEntry} from '../frame-lifecycle';
import {
  LaunchAppProcessScene,
  LaunchDumpsysScene,
  LaunchEndingScene,
  LaunchLifecycleScene,
  LaunchMap,
  LaunchOverviewScene,
  LaunchProcessScene,
  LaunchSystemServerScene,
  LaunchTitleScene,
  LaunchTreeScene,
  LaunchZygoteScene,
} from './scenes';

const f = (s: number) => Math.round(s * FPS);
const story = (st: FlowStory) => f(storySeconds(st.steps) + 0.5);

/** 四个维度：进程 → 进程内部（system_server / zygote / com.foo）→ 用户层生命周期 → dumpsys */
export const APP_LAUNCH_SCENES: SceneEntry[] = [
  {id: 'Title', Component: LaunchTitleScene, frames: f(4)},
  {id: 'Process', Component: LaunchProcessScene, frames: story(processStory)},
  {id: 'SystemServer', Component: LaunchSystemServerScene, frames: story(systemServerStory)},
  {id: 'Zygote', Component: LaunchZygoteScene, frames: story(zygoteStory)},
  {id: 'AppProcess', Component: LaunchAppProcessScene, frames: story(appStory)},
  {id: 'Lifecycle', Component: LaunchLifecycleScene, frames: story(lifecycleStory)},
  {id: 'Dumpsys', Component: LaunchDumpsysScene, frames: story(dumpsysStory)},
  {id: 'Ending', Component: LaunchEndingScene, frames: f(10)},
];

/** 旧版：全景图 + 线程泳道 + 双树，保留用于对比（确认新版后可删） */
export const APP_LAUNCH_LEGACY_SCENES: SceneEntry[] = [
  {id: 'Map', Component: LaunchMap.Component, frames: f(LaunchMap.seconds)},
  {id: 'Overview', Component: LaunchOverviewScene, frames: story(launchStory)},
  {id: 'Tree', Component: LaunchTreeScene, frames: story(launchTreeStory)},
];
