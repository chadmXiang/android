import type {Fragment} from '../engine/resolve';
import {firstFrameFragment} from './render/firstFrame';

export const FRAGMENTS: Record<string, Fragment> = {
  [firstFrameFragment.id]: firstFrameFragment,
};
