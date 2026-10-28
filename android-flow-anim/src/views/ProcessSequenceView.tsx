import React from 'react';
import type {FlowScript} from '../dsl/types';
import {activeSpan, eventsOf, laneBornAt} from '../engine/state';
import {clamp01, ease, fmtSim} from '../engine/text';
import {colors, layerColors, mono} from '../theme';
import {ARROW_STYLES, type ArrowKind} from './SwimlaneView';

/**
 * 进程时序图（进程交互型模板的主视图）：一列一个进程，只画跨进程的交互，按发生顺序编号成行。
 * 线程级 / 实例级泳道按 lane.process 聚合，所以和其它视图共用同一份脚本。
 */

export interface ProcRow {
  at: number;
  end?: number;
  from: string;
  to: string;
  label: string;
  kind: ArrowKind;
}

const procOfLane = (s: FlowScript, lane: string) => s.lanes.find((l) => l.id === lane)?.process;

/** 所有跨进程交互（同进程内的调用不进这张图） */
export const crossProcessRows = (s: FlowScript): ProcRow[] => {
  const rows: ProcRow[] = [];
  const push = (at: number, fromLane: string, toLane: string, label: string, kind: ArrowKind, end?: number) => {
    const a = procOfLane(s, fromLane);
    const b = procOfLane(s, toLane);
    if (a && b && a !== b) rows.push({at, from: a, to: b, label, kind, end});
  };
  eventsOf(s, 'call').forEach((e) => push(e.at, e.from, e.to, e.method, 'call', e.returnAt));
  eventsOf(s, 'oneway').forEach((e) => push(e.at, e.from, e.to, e.method, 'oneway'));
  eventsOf(s, 'socket').forEach((e) => push(e.at, e.from, e.to, e.label, 'socket'));
  eventsOf(s, 'fork').forEach((e) => push(e.at, e.from, e.to, e.label ?? 'fork', e.exec ? 'spawn' : 'fork'));
  eventsOf(s, 'batch').forEach((e) => push(e.at, e.from, e.to, e.label, 'batch'));
  eventsOf(s, 'message').forEach((e) => push(e.at, e.from, e.to, e.label, 'message'));
  eventsOf(s, 'post').forEach((e) => push(e.at, e.from, e.to, e.msg, 'post', e.handledAt));
  return rows.sort((x, y) => x.at - y.at);
};

const GUTTER = 210;
const HEAD = 92;

export const ProcessSequenceView: React.FC<{script: FlowScript; t: number; width: number; height: number; frame: number}> = ({
  script,
  t,
  width,
  height,
  frame,
}) => {
  const rows = React.useMemo(() => crossProcessRows(script), [script]);
  const procs = script.processes ?? [];
  const colW = (width - GUTTER - 20) / Math.max(procs.length, 1);
  const cx = (pid: string) => GUTTER + colW * (procs.findIndex((p) => p.id === pid) + 0.5);
  const rowH = Math.min(40, (height - HEAD - 16) / Math.max(rows.length, 1));
  const yOf = (i: number) => HEAD + 10 + i * rowH + rowH / 2;
  const span = script.window[1] - script.window[0];
  const anim = span * 0.006;
  const latest = rows.filter((r) => r.at <= t).pop();
  const breathe = 0.5 + 0.5 * Math.sin(frame / 6);
  const procBorn = (pid: string) => {
    const lanes = script.lanes.filter((l) => l.process === pid);
    return Math.min(...lanes.map((l) => laneBornAt(script, l.id)));
  };
  const chapters = script.chapters ?? [];
  const markerId = `ps-${script.id}`;

  return (
    <div style={{position: 'relative', width, height}}>
      <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          {Object.entries(ARROW_STYLES).map(([k, st]) => (
            <marker key={k} id={`${markerId}-${k}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={st.hollow ? colors.bg : st.color} stroke={st.color} />
            </marker>
          ))}
        </defs>

        {/* 章节带：左侧括号 */}
        {chapters.map((c) => {
          const idx = rows.map((r, i) => ({r, i})).filter(({r}) => r.at >= c.start && r.at < c.end);
          if (!idx.length) return null;
          const y0 = yOf(idx[0].i) - rowH / 2 + 2;
          const y1 = yOf(idx[idx.length - 1].i) + rowH / 2 - 2;
          const cur = t >= c.start && t < c.end;
          return (
            <g key={c.id} opacity={t >= c.start ? 1 : 0.35}>
              <rect x={10} y={y0} width={GUTTER - 24} height={y1 - y0} rx={8} fill={cur ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)'} stroke={cur ? colors.info : colors.border} />
              <text x={20} y={(y0 + y1) / 2} dominantBaseline="middle" fontSize={14} fontWeight={700} fill={cur ? colors.info : colors.muted}>
                {c.title}
              </text>
            </g>
          );
        })}

        {/* 生命线 */}
        {procs.map((p) => {
          const born = procBorn(p.id);
          const bornRow = rows.findIndex((r) => r.to === p.id && (r.kind === 'fork' || r.kind === 'spawn'));
          const y0 = Number.isFinite(born) && bornRow >= 0 ? yOf(bornRow) : HEAD;
          return (
            <line key={p.id} x1={cx(p.id)} x2={cx(p.id)} y1={y0} y2={height - 6} stroke={layerColors[p.layer]} strokeOpacity={t >= born ? 0.45 : 0.15} strokeDasharray="4 6" strokeWidth={2} />
          );
        })}

        {/* 交互行 */}
        {rows.map((r, i) => {
          if (r.at > t) return null;
          const y = yOf(i);
          const x1 = cx(r.from);
          const x2 = cx(r.to);
          const st = ARROW_STYLES[r.kind];
          const p = ease(clamp01((t - r.at) / anim));
          const isLatest = r === latest;
          const recent = t - r.at < span * 0.03;
          const op = isLatest || recent ? 1 : 0.45;
          const dir = x2 > x1 ? 1 : -1;
          const xe = x1 + (x2 - x1) * p;
          const returned = r.kind === 'call' && r.end !== undefined && t >= r.end;
          return (
            <g key={i} opacity={op}>
              {isLatest && <rect x={GUTTER - 6} y={y - rowH / 2 + 1} width={width - GUTTER} height={rowH - 2} rx={6} fill="rgba(56,189,248,0.10)" />}
              <circle cx={GUTTER + 10} cy={y} r={10} fill={isLatest ? colors.info : '#334155'} />
              <text x={GUTTER + 10} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={800} fill={isLatest ? '#0b1020' : colors.fg}>
                {i + 1}
              </text>
              {st.double ? (
                <>
                  <line x1={x1} x2={xe} y1={y - 2} y2={y - 2} stroke={st.color} strokeWidth={1.6} />
                  <line x1={x1} x2={xe} y1={y + 2} y2={y + 2} stroke={st.color} strokeWidth={1.6} markerEnd={p > 0.95 ? `url(#${markerId}-${r.kind})` : undefined} />
                </>
              ) : (
                <line x1={x1} x2={xe} y1={y} y2={y} stroke={st.color} strokeWidth={isLatest ? st.width + 1 : st.width} strokeDasharray={st.dash} markerEnd={p > 0.95 ? `url(#${markerId}-${r.kind})` : undefined} />
              )}
              {p > 0.6 && (
                <text
                  x={(x1 + x2) / 2}
                  y={y - 7}
                  textAnchor="middle"
                  fontSize={isLatest ? 14 : 12.5}
                  fontWeight={isLatest ? 800 : 500}
                  fill={st.color}
                  fontFamily={mono}
                  stroke={colors.bg}
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {r.label}
                </text>
              )}
              {r.kind === 'call' && r.end !== undefined && p > 0.95 && (
                <text x={x1 - dir * 8} y={y + 4} textAnchor={dir > 0 ? 'end' : 'start'} fontSize={11} fill={returned ? colors.muted : colors.warn} fontFamily={mono}>
                  {returned ? `↩ ${fmtSim(r.end - r.at, script.timeUnit)}` : '⏳ 阻塞中'}
                </text>
              )}
              <text x={width - 8} y={y + 4} textAnchor="end" fontSize={10.5} fill={colors.muted} fontFamily={mono}>
                {fmtSim(r.at, script.timeUnit)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 进程头：名字 + 此刻在做什么 */}
      {procs.map((p) => {
        const born = procBorn(p.id);
        const alive = t >= born;
        const lanes = script.lanes.filter((l) => l.process === p.id).map((l) => l.id);
        const sp = alive ? activeSpan(script, lanes, t) : undefined;
        const c = layerColors[p.layer];
        const involved = latest && (latest.from === p.id || latest.to === p.id);
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: cx(p.id) - colW / 2 + 6,
              top: 8,
              width: colW - 12,
              height: HEAD - 16,
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 12,
              border: `2px ${alive ? 'solid' : 'dashed'} ${alive ? c : '#334155'}`,
              background: alive ? `${c}18` : 'transparent',
              boxShadow: involved ? `0 0 ${8 + 8 * breathe}px ${c}88` : undefined,
              opacity: alive ? 1 : 0.5,
              overflow: 'hidden',
            }}
          >
            <div style={{fontSize: colW < 150 ? 12.5 : 16, fontWeight: 800, color: alive ? colors.fg : colors.muted, lineHeight: 1.25, wordBreak: 'break-all'}}>{p.label}</div>
            <div style={{fontSize: 12, color: sp ? colors.info : colors.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 4}}>
              {!alive ? '尚未 fork' : sp ? `▶ ${sp.label}` : '空闲'}
            </div>
          </div>
        );
      })}
    </div>
  );
};
