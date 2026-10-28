import type {FlowStory} from '../../dsl/types';
import {storySeconds} from '../../engine/camera';
import {
  imeGraphStory,
  imeOverviewStory,
  inputAppStory,
  inputChannelStory,
  inputDispatchStory,
  inputOverviewStory,
  inputReaderStory,
  inputViewTreeStory,
} from '../../flows/input/stories';
import {FPS} from '../../theme';
import type {SceneEntry} from '../frame-lifecycle';
import {
  ImeGraphScene,
  ImeOverviewScene,
  InputAppScene,
  InputChannelScene,
  InputDispatchScene,
  InputEndingScene,
  InputOverviewScene,
  InputReaderScene,
  InputTitleScene,
  InputViewTreeScene,
} from './scenes';

const f = (s: number) => Math.round(s * FPS);
const story = (st: FlowStory) => f(storySeconds(st.steps) + 0.5);

/** 整体（进程）→ 进程内部（建通道 / InputReader / InputDispatcher / 应用 InputStage）→ View 树 → IME 对照 */
export const INPUT_FLOW_SCENES: SceneEntry[] = [
  {id: 'Title', Component: InputTitleScene, frames: f(4)},
  {id: 'Overview', Component: InputOverviewScene, frames: story(inputOverviewStory)},
  {id: 'Channel', Component: InputChannelScene, frames: story(inputChannelStory)},
  {id: 'Reader', Component: InputReaderScene, frames: story(inputReaderStory)},
  {id: 'Dispatch', Component: InputDispatchScene, frames: story(inputDispatchStory)},
  {id: 'App', Component: InputAppScene, frames: story(inputAppStory)},
  {id: 'ViewTree', Component: InputViewTreeScene, frames: story(inputViewTreeStory)},
  {id: 'ImeOverview', Component: ImeOverviewScene, frames: story(imeOverviewStory)},
  {id: 'ImeGraph', Component: ImeGraphScene, frames: story(imeGraphStory)},
  {id: 'Ending', Component: InputEndingScene, frames: f(10)},
];
