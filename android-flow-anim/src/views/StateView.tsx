import React from 'react';
import {getStateMachine} from '../catalog';
import {clipToRect} from '../engine/geom';
import {textWidth} from '../engine/text';
import {colors, font, mono, stateColors} from '../theme';

const NODE_H = 44;
const TITLE_H = 36;

/** 状态节点在 StateView 画布里的像素矩形（外部叠加动画用；与 viewBox 的 meet 缩放一致） */
export const stateNodeRect = (machine: string, state: string, width: number, height: number) => {
  const sm = getStateMachine(machine);
  const c = sm.layout[state];
  if (!c) return undefined;
  const k = Math.min(width / sm.size.w, height / (sm.size.h + TITLE_H));
  const ox = (width - sm.size.w * k) / 2;
  const oy = (height - (sm.size.h + TITLE_H) * k) / 2 + TITLE_H * k;
  const w = Math.max(110, textWidth(state, 15) + 30) * k;
  const h = NODE_H * k;
  return {x: ox + c.x * k - w / 2, y: oy + c.y * k - h / 2, w, h};
};

export const StateView: React.FC<{
  machine: string;
  current?: string;
  prev?: string;
  width: number;
  height: number;
  title?: string;
}> = ({machine, current, prev, width, height, title}) => {
  const sm = getStateMachine(machine);
  const nodeW = (s: string) => Math.max(110, textWidth(s, 15) + 30);
  const rectOf = (s: string) => {
    const c = sm.layout[s];
    const w = nodeW(s);
    return {x: c.x - w / 2, y: c.y - NODE_H / 2, w, h: NODE_H};
  };
  const titleH = TITLE_H;
  const mk = `sm-${machine}`;

  return (
    <svg width={width} height={height} viewBox={`0 ${-titleH} ${sm.size.w} ${sm.size.h + titleH}`} style={{display: 'block', fontFamily: font}}>
      <defs>
        <marker id={mk} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
        </marker>
        <marker id={`${mk}-on`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={colors.info} />
        </marker>
      </defs>
      <text x={10} y={-12} fontSize={17} fill={colors.muted}>
        {title ?? sm.title}
      </text>

      {sm.edges.map((e, i) => {
        const a = sm.layout[e.from];
        const b = sm.layout[e.to];
        const reverse = sm.edges.some((o) => o.from === e.to && o.to === e.from);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const off = reverse ? 9 : 0;
        const p1 = clipToRect(rectOf(e.from), b);
        const p2 = clipToRect(rectOf(e.to), a);
        const x1 = p1.x + nx * off;
        const y1 = p1.y + ny * off;
        const x2 = p2.x + nx * off;
        const y2 = p2.y + ny * off;
        const on = !!prev && !!current && prev !== current && e.from === prev && e.to === current;
        const lx = (x1 + x2) / 2 + nx * (off + 14);
        const ly = (y1 + y2) / 2 + ny * (off + 14);
        const anchor = Math.abs(nx) > 0.6 ? (nx > 0 ? 'start' : 'end') : 'middle';
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? colors.info : '#475569'} strokeWidth={on ? 3 : 1.6} markerEnd={`url(#${on ? `${mk}-on` : mk})`} />
            <text x={lx} y={ly} fontSize={13} fill={on ? colors.info : colors.muted} textAnchor={anchor} dominantBaseline="middle">
              {e.via}
            </text>
          </g>
        );
      })}

      {sm.states.map((s) => {
        const r = rectOf(s);
        const isCur = s === current;
        return (
          <g key={s}>
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={10}
              fill={isCur ? stateColors[s] ?? '#0e7490' : colors.panel2}
              stroke={isCur ? '#fff' : colors.border}
              strokeWidth={isCur ? 2.5 : 1.5}
            />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={isCur ? 800 : 500} fill={colors.fg} fontFamily={mono}>
              {s}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
