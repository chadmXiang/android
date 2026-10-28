import {storySeconds} from '../../engine/camera';
import {addWindowClassStory, addWindowGraphStory} from '../../flows/classes/addWindow';
import {startActivityClassStory, startActivityGraphStory} from '../../flows/classes/startActivity';
import {FPS} from '../../theme';
import type {SceneEntry} from '../frame-lifecycle';
import {
  AddWindowClassScene,
  AddWindowGraphScene,
  KeyClassesEndingScene,
  KeyClassesTitleScene,
  ServicesMapScene,
  StartActivityClassScene,
  StartActivityGraphScene,
  WmMapScene,
  servicesMapStory,
  wmMapStory,
} from './scenes';

const f = (s: number) => Math.round(s * FPS);

export const KEY_CLASSES_SCENES: SceneEntry[] = [
  {id: 'Title', Component: KeyClassesTitleScene, frames: f(4)},
  {id: 'ServicesMap', Component: ServicesMapScene, frames: f(storySeconds(servicesMapStory.steps) + 0.5)},
  {id: 'WmMap', Component: WmMapScene, frames: f(storySeconds(wmMapStory.steps) + 0.5)},
  {id: 'StartActivity', Component: StartActivityClassScene, frames: f(storySeconds(startActivityClassStory.steps) + 0.5)},
  {id: 'StartActivityGraph', Component: StartActivityGraphScene, frames: f(storySeconds(startActivityGraphStory.steps) + 0.5)},
  {id: 'AddWindow', Component: AddWindowClassScene, frames: f(storySeconds(addWindowClassStory.steps) + 0.5)},
  {id: 'AddWindowGraph', Component: AddWindowGraphScene, frames: f(storySeconds(addWindowGraphStory.steps) + 0.5)},
  {id: 'Ending', Component: KeyClassesEndingScene, frames: f(9)},
];
