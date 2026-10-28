import React from 'react';
import type {FlowScript} from '../dsl/types';
import {eventsOf} from '../engine/state';
import {fitText} from '../engine/text';
import {colors, font, layerColors, mono} from '../theme';

/**
 * 每个服务分组一列；格子三态：未启动（虚线半透明）/ 启动中（橙色脉冲）/ 已就绪（分组色）。
 * 底部是 phase 事件组成的阶段条（SystemServiceManager.startBootPhase）。
 */
export const ServiceGrid: React.FC<{script: FlowScript; t: number; width: number; height: number; frame: number}> = ({
  script,
  t,
  width,
  height,
  frame,
}) => {
  const groups = script.serviceGroups ?? [];
  const services = eventsOf(script, 'service');
  const phases = eventsOf(script, 'phase').sort((a, b) => a.value - b.value);
  const pad = 20;
  const gap = 18;
  const headerH = 40;
  const phaseH = phases.length ? 90 : 0;
  const colW = (width - pad * 2 - gap * Math.max(0, groups.length - 1)) / Math.max(1, groups.length);
  const maxN = Math.max(1, ...groups.map((g) => services.filter((s) => s.group === g.id).length));
  const tileH = Math.max(18, Math.min(40, (height - pad * 2 - headerH - phaseH) / maxN - 6));
  const tfs = Math.min(15, tileH * 0.45);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);

  return (
    <svg width={width} height={height} style={{display: 'block', fontFamily: font}}>
      {groups.map((g, gi) => {
        const x0 = pad + gi * (colW + gap);
        const col = layerColors[g.layer];
        const list = services.filter((s) => s.group === g.id).sort((a, b) => a.at - b.at);
        const ready = list.filter((s) => t >= (s.end ?? s.at)).length;
        return (
          <g key={g.id}>
            <text x={x0} y={pad + 16} fontSize={17} fontWeight={700} fill={col}>
              {fitText(g.label, colW - 60, 17)}
            </text>
            <text x={x0 + colW} y={pad + 16} fontSize={14} fill={colors.muted} textAnchor="end" fontFamily={mono}>
              {`${ready}/${list.length}`}
            </text>
            {list.map((s, i) => {
              const y = pad + headerH + i * (tileH + 6);
              const end = s.end ?? s.at;
              const st = t < s.at ? 'pending' : t < end ? 'starting' : 'ready';
              const fresh = st === 'ready' && t - end < 300;
              return (
                <g key={s.name} opacity={st === 'pending' ? 0.28 : 1}>
                  <rect
                    x={x0}
                    y={y}
                    width={colW}
                    height={tileH}
                    rx={7}
                    fill={st === 'ready' ? col : colors.panel2}
                    fillOpacity={st === 'ready' ? (fresh ? 0.5 : 0.22) : 1}
                    stroke={st === 'starting' ? colors.warn : st === 'ready' ? col : colors.border}
                    strokeWidth={st === 'starting' ? 2 + pulse * 1.5 : 1.2}
                    strokeDasharray={st === 'pending' ? '4 4' : undefined}
                  />
                  <text x={x0 + 10} y={y + tileH / 2 + 1} fontSize={tfs} dominantBaseline="middle" fill={colors.fg}>
                    {fitText(s.name, colW - 56, tfs)}
                  </text>
                  <text
                    x={x0 + colW - 8}
                    y={y + tileH / 2 + 1}
                    fontSize={11}
                    dominantBaseline="middle"
                    textAnchor="end"
                    fill={st === 'starting' ? colors.warn : colors.ok}
                  >
                    {st === 'starting' ? '启动中' : st === 'ready' ? '✓' : ''}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {phases.length > 0 &&
        (() => {
          const y = height - pad - 50;
          const pw = (width - pad * 2 - 8 * (phases.length - 1)) / phases.length;
          const reached = phases.filter((p) => p.at <= t);
          const cur = reached[reached.length - 1];
          return (
            <g>
              <text x={pad} y={y - 12} fontSize={14} fill={colors.muted}>
                SystemServiceManager.startBootPhase
              </text>
              {phases.map((p, i) => {
                const on = p.at <= t;
                const isCur = cur === p;
                const px = pad + i * (pw + 8);
                return (
                  <g key={p.value}>
                    <rect
                      x={px}
                      y={y}
                      width={pw}
                      height={46}
                      rx={8}
                      fill={on ? colors.ok : colors.panel2}
                      fillOpacity={on ? (isCur ? 0.5 : 0.2) : 1}
                      stroke={isCur ? '#fff' : on ? colors.ok : colors.border}
                      strokeWidth={isCur ? 2 : 1}
                    />
                    <text x={px + 10} y={y + 18} fontSize={15} fontWeight={800} fontFamily={mono} fill={colors.fg}>
                      {p.value}
                    </text>
                    <text x={px + 10} y={y + 36} fontSize={11} fill={colors.muted}>
                      {fitText(p.label, pw - 16, 11)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}
    </svg>
  );
};
