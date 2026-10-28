import React from 'react';
import type {SpanStyle} from '../dsl/types';
import {clipFor, spokenRatio} from '../engine/narration';
import {clamp01, ease} from '../engine/text';
import {colors, mono, spanColors, spanNames, stateColor} from '../theme';
import {ARROW_STYLES, type ArrowKind} from './SwimlaneView';

export const Header: React.FC<{title: string; subtitle?: string; right?: string}> = ({title, subtitle, right}) => (
  <div style={{position: 'absolute', left: 40, top: 26, right: 40, display: 'flex', alignItems: 'baseline', gap: 20}}>
    <div style={{fontSize: 36, fontWeight: 800}}>{title}</div>
    {subtitle && <div style={{fontSize: 20, color: colors.muted}}>{subtitle}</div>}
    {right && <div style={{marginLeft: 'auto', fontSize: 18, color: colors.muted, fontFamily: mono}}>{right}</div>}
  </div>
);

export const Panel: React.FC<{x: number; y: number; w: number; h: number; pad?: number; children: React.ReactNode}> = ({
  x,
  y,
  w,
  h,
  pad = 0,
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      padding: pad,
      boxSizing: 'border-box',
      background: colors.panel,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);

/**
 * 字幕。有旁白时按音频时长逐字点亮（已念到的全亮、当前字高亮、未念到的压暗），
 * 没有旁白时退回原来的整块淡入。做法借鉴 OpenMontage 的 CaptionOverlay：
 * 每个字 inline-block + nowrap，CJK 不会在词中断行。
 */
export const Caption: React.FC<{text: string; localSec: number; top?: number; height?: number}> = ({
  text,
  localSec,
  top = 884,
  height = 160,
}) => {
  const p = ease(clamp01(localSec / 0.45));
  const clip = clipFor(text);
  const chars = [...text];
  // 已念比例：有词边界就按词边界，否则按时长线性推
  const spoken = clip ? spokenRatio(clip, localSec) * chars.length : chars.length;
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top,
        height,
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        boxSizing: 'border-box',
        background: 'rgba(22,27,38,0.92)',
        border: `1px solid ${colors.border}`,
        borderLeft: `6px solid ${colors.info}`,
        borderRadius: 14,
        fontSize: 29,
        lineHeight: 1.5,
        opacity: p,
        transform: `translateY(${(1 - p) * 12}px)`,
      }}
    >
      {clip ? (
        <div>
          {chars.map((ch, i) => {
            const d = spoken - i;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  color: d >= 1 ? colors.fg : d > 0 ? colors.info : colors.muted,
                  opacity: d > 0 ? 1 : 0.55,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      ) : (
        text
      )}
    </div>
  );
};

const flagIcon = (c: string) => (
  <svg width={16} height={16}>
    <line x1={3} y1={2} x2={3} y2={15} stroke="#fff" strokeWidth={1.5} />
    <path d="M3,2 L14,6 L3,10 z" fill={c} />
  </svg>
);

export const Legend: React.FC<{x: number; y: number}> = ({x, y}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      display: 'flex',
      gap: 16,
      alignItems: 'center',
      fontSize: 15,
      color: colors.muted,
    }}
  >
    {(['cpu', 'gpu', 'sf', 'wait'] as SpanStyle[]).map((s) => (
      <span key={s} style={{display: 'flex', alignItems: 'center', gap: 6}}>
        <i style={{width: 18, height: 12, borderRadius: 3, background: spanColors[s], display: 'inline-block'}} />
        {spanNames[s]}
      </span>
    ))}
    <span style={{marginLeft: 10}}>描边 = slot 状态：</span>
    {['FREE', 'DEQUEUED', 'QUEUED', 'ACQUIRED'].map((st) => (
      <span key={st} style={{display: 'flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: 13}}>
        <i
          style={{width: 13, height: 13, borderRadius: 3, border: `3px solid ${stateColor(st)}`, display: 'inline-block'}}
        />
        {st}
      </span>
    ))}
    <span style={{display: 'flex', alignItems: 'center', gap: 4, marginLeft: 10}}>
      {flagIcon(colors.bad)}acquire fence 未 signal
    </span>
    <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
      {flagIcon(colors.warn)}release fence 未 signal
    </span>
    <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
      <i
        style={{
          width: 22,
          height: 4,
          borderRadius: 2,
          background: 'linear-gradient(90deg,#f472b6,#38bdf8,#a3e635)',
          display: 'inline-block',
        }}
      />
      帧血缘
    </span>
  </div>
);

export const ArrowLegend: React.FC<{x: number; y: number; kinds?: ArrowKind[]}> = ({
  x,
  y,
  kinds = ['call', 'return', 'oneway', 'post', 'socket', 'fork', 'batch'],
}) => (
  <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 18, alignItems: 'center', fontSize: 15, color: colors.muted}}>
    {kinds.map((k) => {
      const st = ARROW_STYLES[k];
      return (
        <span key={k} style={{display: 'flex', alignItems: 'center', gap: 6}}>
          <svg width={34} height={12}>
            {st.double ? (
              <>
                <line x1={0} x2={28} y1={4} y2={4} stroke={st.color} strokeWidth={1.4} />
                <line x1={0} x2={28} y1={8} y2={8} stroke={st.color} strokeWidth={1.4} />
              </>
            ) : (
              <line x1={0} x2={28} y1={6} y2={6} stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} />
            )}
            <path d="M28,1 L34,6 L28,11 z" fill={st.hollow ? 'none' : st.color} stroke={st.color} />
          </svg>
          {st.name}
        </span>
      );
    })}
    <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
      <i style={{width: 26, height: 8, background: '#64748b', opacity: 0.6, display: 'inline-block'}} />
      调用方阻塞
    </span>
    <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
      <svg width={12} height={12}>
        <path d="M6,1 L11,6 L6,11 L1,6 z" fill="#c084fc" />
      </svg>
      消息被取出
    </span>
  </div>
);
