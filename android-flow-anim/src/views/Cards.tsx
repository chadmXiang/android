import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp01, ease} from '../engine/text';
import {colors, font, mono, resourceColor} from '../theme';

export const TitleCard: React.FC<{kicker: string; title: string; subtitle: string; chips?: string[]}> = ({
  kicker,
  title,
  subtitle,
  chips = [],
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill
      style={{background: colors.bg, color: colors.fg, fontFamily: font, justifyContent: 'center', alignItems: 'center'}}
    >
      <div style={{textAlign: 'center', opacity: s, transform: `translateY(${(1 - s) * 30}px)`}}>
        <div style={{fontSize: 26, color: colors.info, fontFamily: mono}}>{kicker}</div>
        <div style={{fontSize: 80, fontWeight: 800, marginTop: 18}}>{title}</div>
        <div style={{fontSize: 32, color: colors.muted, marginTop: 20}}>{subtitle}</div>
        <div style={{display: 'flex', gap: 18, justifyContent: 'center', marginTop: 50}}>
          {chips.map((c, i) => {
            const p = spring({frame: frame - 12 - i * 6, fps, config: {damping: 12}});
            return (
              <div
                key={c}
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 14,
                  background: resourceColor(c),
                  color: '#111',
                  fontSize: 34,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${p})`,
                }}
              >
                {c}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SummaryCard: React.FC<{heading: string; lines: [string, string][]}> = ({heading, lines}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  return (
    <AbsoluteFill style={{background: colors.bg, color: colors.fg, fontFamily: font, justifyContent: 'center', paddingLeft: 200}}>
      <div style={{fontSize: 30, color: colors.muted, marginBottom: 40}}>{heading}</div>
      {lines.map(([k, v], i) => {
        const p = ease(clamp01((sec - 0.5 - i * 0.9) / 0.6));
        return (
          <div
            key={k}
            style={{display: 'flex', gap: 40, alignItems: 'baseline', marginBottom: 34, opacity: p, transform: `translateX(${(1 - p) * -30}px)`}}
          >
            <div style={{fontSize: 44, fontWeight: 800, width: 420, color: colors.info}}>{k}</div>
            <div style={{fontSize: 30}}>{v}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
