import React from 'react';
import type {FlowScript} from '../dsl/types';
import {activeSpan, displayedAt, gpuWriting, messageActive, resourceAt, resourceFence} from '../engine/state';
import {TOKEN_ANIM_MS, clamp01, ease, fitText, textWidth} from '../engine/text';
import {colors, font, mono, resourceColor, spanColors, stateColor} from '../theme';
import {FenceFlag} from './FenceFlag';

export interface PipelineStage {
  id: string;
  label: string;
  sub?: string;
  lanes: string[];
  group: string;
}
export interface PipelineGroup {
  id: string;
  label: string;
  color: string;
}
/** 阶段之间的流向（画在阶段下方）；对应交互发生时高亮 */
export interface PipelineReturn {
  from: string;
  to: string;
  label: string;
  match: string;
}
export interface PipelineConfig {
  stages: PipelineStage[];
  groups: PipelineGroup[];
  handoffs?: {after: string; label: string; desc: string}[];
  returns?: PipelineReturn[];
  displayStage?: string;
  /** 相邻阶段之间画默认 → 箭头（流向不是单向时关掉），默认 true */
  connectors?: boolean;
  stageHeight?: number;
  /** 流向高亮的时间窗（模拟时间），默认 5 */
  activeWithin?: number;
}

const STAGE_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const PipelineView: React.FC<{
  script: FlowScript;
  t: number;
  config: PipelineConfig;
  width: number;
  height: number;
  frame: number;
  focus?: string[];
}> = ({script, t, config, width, height, frame, focus = []}) => {
  const n = config.stages.length;
  const padX = 34;
  const gap = 40;
  const stageW = (width - padX * 2 - gap * (n - 1)) / n;
  const stageY = 70;
  const stageH = config.stageHeight ?? Math.min(220, height * 0.47);
  const sx = (i: number) => padX + i * (stageW + gap);
  const stageIdx = (id: string) => config.stages.findIndex((s) => s.id === id);
  const stageOfLane = (lane: string) => config.stages.findIndex((s) => s.lanes.includes(lane));
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const tokenY = stageY + stageH - 42;
  const tokenX = (stage: number, ri: number) => sx(stage) + 34 + ri * 46;
  const retBase = stageY + stageH + 46;
  const display = displayedAt(script, t);
  const dispIdx = config.displayStage ? stageIdx(config.displayStage) : -1;
  const returns = config.returns ?? [];
  const within = config.activeWithin ?? 5;

  return (
    <svg width={width} height={height} style={{display: 'block', fontFamily: font}}>
      <defs>
        <marker id="pl-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
        </marker>
        <marker id="pl-arrow-on" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={colors.info} />
        </marker>
      </defs>

      {config.groups.map((g) => {
        const ids = config.stages.map((s, i) => (s.group === g.id ? i : -1)).filter((i) => i >= 0);
        if (!ids.length) return null;
        const x1 = sx(Math.min(...ids)) - 16;
        const x2 = sx(Math.max(...ids)) + stageW + 16;
        return (
          <g key={g.id}>
            <rect x={x1} y={20} width={x2 - x1} height={stageY + stageH + 14 - 20} rx={14} fill="rgba(255,255,255,0.02)" stroke={g.color} strokeDasharray="6 5" />
            <text x={x1 + 14} y={46} fill={g.color} fontSize={17} fontWeight={700}>
              {g.label}
            </text>
          </g>
        );
      })}

      {config.connectors !== false &&
        config.stages.slice(0, -1).map((st, i) => {
          const y = stageY + stageH / 2;
          const xa = sx(i) + stageW + 3;
          const xb = sx(i + 1) - 3;
          const h = config.handoffs?.find((x) => x.after === st.id);
          return (
            <g key={`h${i}`}>
              <line x1={xa} x2={xb} y1={y} y2={y} stroke="#64748b" strokeWidth={2} markerEnd="url(#pl-arrow)" />
              {h && (
                <g>
                  <circle cx={(xa + xb) / 2} cy={y - 18} r={12} fill={colors.info} />
                  <text x={(xa + xb) / 2} y={y - 17} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={800} fill="#0b1020">
                    {h.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

      {config.stages.map((st, i) => {
        const sp = activeSpan(script, st.lanes, t);
        const c = sp ? spanColors[sp.style] : colors.border;
        return (
          <g key={st.id}>
            <rect x={sx(i)} y={stageY} width={stageW} height={stageH} rx={12} fill={sp ? 'rgba(255,255,255,0.06)' : colors.panel2} stroke={c} strokeWidth={sp ? 2.5 + pulse : 1.5} />
            <circle cx={sx(i) + 20} cy={stageY + 26} r={11} fill={colors.info} />
            <text x={sx(i) + 20} y={stageY + 27} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={800} fill="#0b1020">
              {STAGE_NUMBERS[i]}
            </text>
            <text x={sx(i) + 38} y={stageY + 32} fontSize={19} fontWeight={700} fill={colors.fg}>
              {fitText(st.label, stageW - 50, 19)}
            </text>
            {st.sub && (
              <text x={sx(i) + 16} y={stageY + 56} fontSize={13} fill={colors.muted}>
                {fitText(st.sub, stageW - 24, 13)}
              </text>
            )}
            {sp && (
              <g>
                <rect x={sx(i) + 12} y={stageY + 70} width={stageW - 24} height={26} rx={6} fill={c} fillOpacity={0.85} />
                <text x={sx(i) + 20} y={stageY + 84} fontSize={13} fill="#fff" dominantBaseline="middle">
                  {fitText(sp.label, stageW - 40, 13)}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {returns.map((r, k) => {
        const a = stageIdx(r.from);
        const b = stageIdx(r.to);
        if (a < 0 || b < 0) return null;
        const off = 14 + k * 7; // 多条流向按序号错开，避免竖线重叠
        const dir = b > a ? 1 : -1;
        const xa = sx(a) + stageW / 2 + dir * off;
        const xb = sx(b) + stageW / 2 - dir * off;
        const y = retBase + k * 42;
        const on = messageActive(script, r.match, t, within);
        const col = on ? colors.info : '#475569';
        const lw = textWidth(r.label, 13) + 16;
        return (
          <g key={`r${k}`}>
            <path
              d={`M${xa},${stageY + stageH} L${xa},${y} L${xb},${y} L${xb},${stageY + stageH + 2}`}
              fill="none"
              stroke={col}
              strokeWidth={on ? 3 : 1.6}
              strokeDasharray={on ? undefined : '5 5'}
              markerEnd={`url(#${on ? 'pl-arrow-on' : 'pl-arrow'})`}
            />
            <rect x={(xa + xb) / 2 - lw / 2} y={y - 12} width={lw} height={24} rx={5} fill={colors.panel2} stroke={col} />
            <text x={(xa + xb) / 2} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill={on ? colors.info : colors.muted}>
              {r.label}
            </text>
          </g>
        );
      })}

      {display && display.resource && dispIdx >= 0 && (
        <g>
          {(() => {
            const ri = script.resources.findIndex((r) => r.id === display.resource);
            const xx = tokenX(dispIdx, Math.max(0, ri));
            return (
              <g>
                <rect x={xx - 16} y={tokenY - 16} width={32} height={32} rx={8} fill={resourceColor(display.resource)} fillOpacity={0.35} stroke={resourceColor(display.resource)} strokeDasharray="4 3" strokeWidth={2} />
                <text x={xx} y={tokenY + 1} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={800} fill={colors.fg}>
                  {display.resource}
                </text>
                <text x={xx} y={tokenY + 30} textAnchor="middle" fontSize={11} fill={colors.muted}>
                  扫出中 · {display.frame}
                </text>
              </g>
            );
          })()}
        </g>
      )}

      {script.resources.map((r, ri) => {
        const s = resourceAt(script, r.id, t);
        const cur = stageOfLane(s.owner);
        if (cur < 0) return null;
        const prevStage = stageOfLane(s.prevOwner);
        const pv = prevStage < 0 ? cur : prevStage;
        const p = ease(clamp01((t - s.since) / TOKEN_ANIM_MS));
        const xx = tokenX(pv, ri) + (tokenX(cur, ri) - tokenX(pv, ri)) * p;
        const yy = tokenY - Math.sin(Math.PI * p) * (pv !== cur ? 40 : 0);
        const c = resourceColor(r.id);
        const fence = resourceFence(script, r.id, t);
        const writing = gpuWriting(script, r.id, t);
        return (
          <g key={r.id} opacity={s.state === 'NONE' ? 0.25 : 1}>
            {writing && <circle cx={xx} cy={yy} r={22 + pulse * 4} fill="none" stroke={colors.gpu} strokeWidth={3} opacity={0.5 + 0.5 * pulse} />}
            {focus.includes(r.id) && <circle cx={xx} cy={yy} r={28 + pulse * 3} fill="none" stroke={c} strokeWidth={2} opacity={0.5} />}
            <rect x={xx - 16} y={yy - 16} width={32} height={32} rx={8} fill={c} stroke={stateColor(s.state)} strokeWidth={4} />
            <text x={xx} y={yy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={800} fill="#111">
              {r.label}
            </text>
            {fence && !fence.signaled && (
              <FenceFlag x={xx + 14} y={yy - 14} color={fence.kind === 'release-fence' ? colors.warn : colors.bad} scale={1.2} />
            )}
            <text x={xx} y={yy + 30} textAnchor="middle" fontSize={11} fill={colors.muted} fontFamily={mono}>
              {s.state}
            </text>
          </g>
        );
      })}

      {config.handoffs && (
        <text x={padX} y={retBase + returns.length * 42 + 16} fontSize={15} fill={colors.muted}>
          {config.handoffs.map((h) => `${h.label} ${h.desc}`).join('　　')}
        </text>
      )}
    </svg>
  );
};
