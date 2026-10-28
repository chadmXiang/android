import React from 'react';
import type {Chapter} from '../dsl/types';
import {fitText} from '../engine/text';
import {colors, font} from '../theme';

const PALETTE = ['#94a3b8', '#a3e635', '#10b981', '#14b8a6', '#f59e0b', '#3b82f6', '#ec4899'];

/** 长流程的章节条：全程比例、当前章节、播放头、当前镜头框 */
export const ChapterBar: React.FC<{
  chapters: Chapter[];
  range: [number, number];
  t: number;
  view?: [number, number];
  width: number;
  height: number;
  unit?: 'ms' | 's';
}> = ({chapters, range, t, view, width, height, unit = 'ms'}) => {
  const pad = 16;
  const [r0, r1] = range;
  const x = (v: number) => pad + ((Math.max(r0, Math.min(r1, v)) - r0) / (r1 - r0)) * (width - pad * 2);
  const barY = 12;
  const barH = height - 36;
  const fmt = (v: number) => (unit === 's' ? `${(v / 1000).toFixed(1)}s` : `${v.toFixed(0)}ms`);
  const last = chapters[chapters.length - 1];
  const cur = chapters.find((c) => t >= c.start && t < c.end) ?? (last && t >= last.end ? last : undefined);

  return (
    <svg width={width} height={height} style={{display: 'block', fontFamily: font}}>
      {chapters.map((c, i) => {
        const on = cur?.id === c.id;
        const x1 = x(c.start);
        const x2 = x(c.end);
        return (
          <g key={c.id}>
            <rect
              x={x1 + 1}
              y={barY}
              width={Math.max(0, x2 - x1 - 2)}
              height={barH}
              rx={6}
              fill={PALETTE[i % PALETTE.length]}
              fillOpacity={on ? 0.55 : 0.16}
              stroke={on ? '#fff' : 'none'}
              strokeWidth={1.5}
            />
            <text x={(x1 + x2) / 2} y={barY + barH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={on ? 800 : 500} fill={colors.fg}>
              {fitText(c.title, x2 - x1 - 10, 14)}
            </text>
            <text x={x1 + 2} y={height - 6} fontSize={11} fill={colors.muted}>
              {fmt(c.start)}
            </text>
          </g>
        );
      })}
      {view && (
        <rect
          x={x(view[0])}
          y={barY - 4}
          width={Math.max(2, x(view[1]) - x(view[0]))}
          height={barH + 8}
          rx={8}
          fill="none"
          stroke={colors.info}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      )}
      <line x1={x(t)} x2={x(t)} y1={barY - 6} y2={barY + barH + 6} stroke="#fff" strokeWidth={2.5} />
    </svg>
  );
};
