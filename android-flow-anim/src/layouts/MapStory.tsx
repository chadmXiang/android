import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, font} from '../theme';
import {Caption, Header} from '../views/Chrome';
import {MapView, NUM, type MapEdge} from '../views/MapView';

export interface MapSceneConfig {
  title: string;
  subtitle?: string;
  components: string[];
  edges: Omit<MapEdge, 'appearAt'>[];
  intro: string;
  outro: string;
  legend?: {label: string; color: string}[];
  start?: number;
  gap?: number;
}

/** 生成一个"进程框依次出现 + 连线逐条画出 + 字幕跟随"的全景图场景 */
export const makeMapScene = (cfg: MapSceneConfig) => {
  const start = cfg.start ?? 2.2;
  const gap = cfg.gap ?? 2.8;
  const edges: MapEdge[] = cfg.edges.map((e, i) => ({...e, appearAt: start + i * gap}));
  const final = start + edges.length * gap + 0.3;

  const Component: React.FC = () => {
    const frame = useCurrentFrame();
    const {fps} = useVideoConfig();
    const sec = frame / fps;
    const cur = Math.floor((sec - start) / gap);
    const isFinal = sec >= final;
    const caption = isFinal
      ? cfg.outro
      : cur >= 0
        ? `${NUM[Math.min(cur, edges.length - 1)]} ${edges[Math.min(cur, edges.length - 1)].desc ?? ''}`
        : cfg.intro;
    const capStart = isFinal ? final : cur >= 0 ? start + cur * gap : 0;
    return (
      <AbsoluteFill style={{background: colors.bg, color: colors.fg, fontFamily: font}}>
        <MapView components={cfg.components} edges={edges} sec={sec} active={isFinal ? -1 : cur} />
        <Header title={cfg.title} subtitle={cfg.subtitle} />
        {cfg.legend && (
          <div style={{position: 'absolute', left: 80, top: 808, display: 'flex', gap: 30, fontSize: 16}}>
            {cfg.legend.map((l) => (
              <span key={l.label} style={{color: l.color}}>
                ━ {l.label}
              </span>
            ))}
          </div>
        )}
        <Caption key={caption} text={caption} localSec={sec - capStart} />
      </AbsoluteFill>
    );
  };

  return {Component, seconds: final + 4.5};
};
