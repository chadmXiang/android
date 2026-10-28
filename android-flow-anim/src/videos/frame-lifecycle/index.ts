import type React from 'react';
import {storySeconds} from '../../engine/camera';
import {compareStory} from '../../flows/render/tripleBuffer';
import {frameStory, pipelineStory} from '../../flows/render/frame';
import {surfaceTreeStory} from '../../flows/wm/surfaceTree';
import {FPS} from '../../theme';
import {
  CompareScene,
  EndingScene,
  FORMULA_SECONDS,
  FormulaScene,
  FrameScene,
  MAP_SECONDS,
  MapScene,
  PipelineScene,
  TitleScene,
  TreeScene,
} from './scenes';

const f = (s: number) => Math.round(s * FPS);

export interface SceneEntry {
  id: string;
  Component: React.FC;
  frames: number;
}

export const FRAME_LIFECYCLE_SCENES: SceneEntry[] = [
  {id: 'Title', Component: TitleScene, frames: f(4)},
  {id: 'Map', Component: MapScene, frames: f(MAP_SECONDS)},
  {id: 'Pipeline', Component: PipelineScene, frames: f(storySeconds(pipelineStory.steps) + 0.5)},
  {id: 'Frame', Component: FrameScene, frames: f(storySeconds(frameStory.steps) + 0.5)},
  {id: 'Formula', Component: FormulaScene, frames: f(FORMULA_SECONDS)},
  {id: 'Compare', Component: CompareScene, frames: f(storySeconds(compareStory.steps) + 0.5)},
  {id: 'Tree', Component: TreeScene, frames: f(storySeconds(surfaceTreeStory.steps) + 0.5)},
  {id: 'Ending', Component: EndingScene, frames: f(8)},
];
