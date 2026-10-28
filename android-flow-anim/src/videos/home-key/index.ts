import {storySeconds} from '../../engine/camera';
import {homeInputStory, homeStory, homeTemplateStory, homeTreeStory} from '../../flows/system/homeKey';
import {FPS} from '../../theme';
import type {SceneEntry} from '../frame-lifecycle';
import {HomeEndingScene, HomeInputScene, HomeMap, HomeOverviewScene, HomeStoryScene, HomeTitleScene, HomeTreeScene} from './scenes';

const f = (s: number) => Math.round(s * FPS);

export const HOME_KEY_SCENES: SceneEntry[] = [
  {id: 'Title', Component: HomeTitleScene, frames: f(4)},
  {id: 'Map', Component: HomeMap.Component, frames: f(HomeMap.seconds)},
  {id: 'Input', Component: HomeInputScene, frames: f(storySeconds(homeInputStory.steps) + 0.5)},
  {id: 'Story', Component: HomeStoryScene, frames: f(storySeconds(homeTemplateStory.steps) + 0.5)},
  {id: 'Ending', Component: HomeEndingScene, frames: f(9)},
];

/** 旧版：固定的 泳道 + 双树 两段，保留用于对比（确认新版后可删） */
export const HOME_KEY_LEGACY_SCENES: SceneEntry[] = [
  {id: 'Overview', Component: HomeOverviewScene, frames: f(storySeconds(homeStory.steps) + 0.5)},
  {id: 'Tree', Component: HomeTreeScene, frames: f(storySeconds(homeTreeStory.steps) + 0.5)},
];
