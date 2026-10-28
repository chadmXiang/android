import {Config} from '@remotion/cli/config';
import {ensureGeneratedNarration} from './scripts/ensure-generated.mjs';

// src/generated/narration.ts 不进仓；studio / render / still 启动前先兜底成空表，否则打包直接失败
ensureGeneratedNarration();

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
