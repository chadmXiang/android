import {storySeconds} from '../../engine/camera';
import {serviceAnrStateStory, serviceCompareStory} from '../../flows/am/serviceStart';
import {FPS} from '../../theme';
import type {SceneEntry} from '../frame-lifecycle';
import {ServiceCompareScene, ServiceEndingScene, ServiceStateScene, ServiceTitleScene} from './scenes';

const f = (s: number) => Math.round(s * FPS);

export const SERVICE_ANR_SCENES: SceneEntry[] = [
  {id: 'Title', Component: ServiceTitleScene, frames: f(4)},
  {id: 'State', Component: ServiceStateScene, frames: f(storySeconds(serviceAnrStateStory.steps) + 0.5)},
  {id: 'Compare', Component: ServiceCompareScene, frames: f(storySeconds(serviceCompareStory.steps) + 0.5)},
  {id: 'Ending', Component: ServiceEndingScene, frames: f(9)},
];
