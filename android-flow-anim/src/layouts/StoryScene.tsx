import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FlowStory} from '../dsl/types';
import {activeSegment, buildKeyframes, simTimeAt, viewAt, type Segment} from '../engine/camera';
import {clipFor} from '../engine/narration';
import {colors, font} from '../theme';
import {Backdrop} from '../views/Backdrop';

export interface StoryCtx {
  frame: number;
  sec: number;
  t: number;
  seg: Segment;
  local: number;
  focus: string[];
  total: number;
  /** 镜头时间窗；未传 defaultView 时为 undefined */
  view?: [number, number];
}

export const StoryScene: React.FC<{
  story: FlowStory;
  startT: number;
  defaultView?: [number, number];
  render: (ctx: StoryCtx) => React.ReactNode;
}> = ({story, startT, defaultView, render}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  const kf = useMemo(() => buildKeyframes(story.steps, startT), [story, startT]);
  const t = simTimeAt(sec, kf);
  const seg = activeSegment(sec, kf);
  const view = defaultView ? viewAt(sec, kf, defaultView) : undefined;
  return (
    <AbsoluteFill style={{background: colors.bg, color: colors.fg, fontFamily: font}}>
      <Backdrop />
      {kf.segments.map((s) => {
        const clip = clipFor(s.step);
        if (!clip) return null;
        return (
          <Sequence key={`n${s.index}`} from={Math.round(s.start * fps)} durationInFrames={Math.ceil(clip.duration * fps)}>
            <Audio src={staticFile(clip.file)} />
          </Sequence>
        );
      })}
      {render({frame, sec, t, seg, local: sec - seg.start, focus: seg.step.focus ?? [], total: story.steps.length, view})}
    </AbsoluteFill>
  );
};
