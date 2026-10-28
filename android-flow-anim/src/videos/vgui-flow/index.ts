import type {FlowStory} from '../../dsl/types';
import {storySeconds} from '../../engine/camera';
import {heatingStory} from '../../flows/vgui/heatingCase';
import {androidHitStory, androidRegisterStory, chainHitStory, chainRegisterStory} from '../../flows/vgui/stories';
import {FPS} from '../../theme';
import type {SceneEntry} from '../frame-lifecycle';
import {
  VguiAndroidHitScene,
  VguiAndroidRegisterScene,
  VguiChainHitScene,
  VguiChainRegisterScene,
  VguiEndingScene,
  VguiHeatingScene,
  VguiTitleScene,
} from './scenes';

const story = (st: FlowStory) => Math.round(storySeconds(st.steps) * FPS + 0.5 * FPS);

/** Full VGUI chain: overview, Android internals, and a synthetic heating teaching example. */
export const VGUI_FLOW_SCENES: SceneEntry[] = [
  {id: 'Title', Component: VguiTitleScene, frames: Math.round(16 * FPS)},
  {id: 'ChainRegister', Component: VguiChainRegisterScene, frames: story(chainRegisterStory)},
  {id: 'ChainHit', Component: VguiChainHitScene, frames: story(chainHitStory)},
  {id: 'AndroidRegister', Component: VguiAndroidRegisterScene, frames: story(androidRegisterStory)},
  {id: 'AndroidHit', Component: VguiAndroidHitScene, frames: story(androidHitStory)},
  {id: 'Heating', Component: VguiHeatingScene, frames: story(heatingStory)},
  {id: 'Ending', Component: VguiEndingScene, frames: Math.round(42 * FPS)},
];
