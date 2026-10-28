import React from 'react';
import {getClockProfile} from '../catalog';
import type {FlowScript, Tone} from '../dsl/types';
import {deriveClock, hwVsyncs, wakeTimes} from '../engine/clock';
import {checkOk, eventsOf, laneBornAt, resourceAt, resourceFence} from '../engine/state';
import {MSG_ANIM_MS, TOKEN_ANIM_MS, clamp01, ease, fitText, textWidth} from '../engine/text';
import {colors, font, frameColor, layerColors, resourceColor, spanColors, stateColor, toneColors} from '../theme';
import {FenceFlag} from './FenceFlag';

export type ArrowKind =
  | 'message'
  | 'batch'
  | 'call'
  | 'return'
  | 'oneway'
  | 'socket'
  | 'fork'
  | 'spawn'
  | 'post'
  | 'invoke'
  | 'iret';

export const ARROW_STYLES: Record<
  ArrowKind,
  {color: string; dash?: string; width: number; hollow?: boolean; double?: boolean; name: string}
> = {
  message: {color: colors.fg, width: 2, name: '消息 / 回调'},
  batch: {color: colors.orange, dash: '6 4', width: 2, name: 'Transaction'},
  call: {color: '#60a5fa', width: 2.4, name: '同步 binder'},
  return: {color: '#60a5fa', dash: '3 4', width: 1.4, name: '返回'},
  oneway: {color: '#60a5fa', dash: '7 4', width: 2, hollow: true, name: 'oneway binder'},
  socket: {color: colors.lime, width: 2, double: true, name: 'socket'},
  fork: {color: colors.pink, width: 3.5, name: 'fork'},
  spawn: {color: colors.sf, dash: '8 4', width: 3, name: 'init 拉起（fork+exec）'},
  post: {color: '#c084fc', dash: '2 4', width: 2, name: 'Handler post'},
  invoke: {color: '#e2e8f0', width: 1.6, name: '进程内调用'},
  iret: {color: '#94a3b8', dash: '3 4', width: 1.2, name: '调用返回'},
};

interface Arrow {
  at: number;
  from: string;
  to: string;
  label: string;
  kind: ArrowKind;
}

export interface SwimlaneProps {
  script: FlowScript;
  t: number;
  width: number;
  height: number;
  frame: number;
  focus?: string[];
  compact?: boolean;
  /** 可视时间窗（镜头缩放），默认 script.window */
  view?: [number, number];
  /** 只给最近 N 个时间单位内的箭头显示文字（长流程防堆叠），默认全部显示 */
  labelRecent?: number;
  /** 箭头 / 标注出现的动画时长（模拟时间单位）；秒级流程应随视窗放大 */
  animMs?: number;
  /** 额外的竖向标记线（如对比模板的"首次分歧"） */
  markLines?: {at: number; label: string; color?: string}[];
}

export const SwimlaneView: React.FC<SwimlaneProps> = ({
  script,
  t,
  width,
  height,
  frame,
  focus = [],
  compact = false,
  view,
  labelRecent = Infinity,
  animMs = MSG_ANIM_MS,
  markLines = [],
}) => {
  const hasRes = script.resources.length > 0;
  const labelW = compact ? 190 : 268;
  const chipGap = 34;
  const chipColW = hasRes ? script.resources.length * chipGap + 18 : 0;
  const chartX = labelW + chipColW;
  const chartW = width - chartX - 18;
  const headerH = 38;
  const laneH = (height - headerH - 6) / script.lanes.length;
  const dense = compact || laneH < 60;
  const [w0, w1] = view ?? script.window;
  const fs = compact ? 12 : laneH < 60 ? 13 : 15;
  const spanH = laneH * (compact ? 0.5 : 0.46);
  const pid = script.id;
  const markH = dense ? 16 : 22;
  const markFs = dense ? 11 : 13;

  const x = (v: number) => chartX + ((v - w0) / (w1 - w0)) * chartW;
  const idx = (id: string) => Math.max(0, script.lanes.findIndex((l) => l.id === id));
  const top = (id: string) => headerH + idx(id) * laneH;
  const mid = (id: string) => top(id) + laneH / 2;
  const procColor = (laneId: string) => {
    const l = script.lanes.find((v) => v.id === laneId);
    const p = l?.process ? script.processes?.find((q) => q.id === l.process) : undefined;
    return p ? layerColors[p.layer] : undefined;
  };

  const profile = script.clockProfile ? getClockProfile(script.clockProfile) : undefined;
  const period = profile ? deriveClock(profile).period : 0;
  const showClock = !!profile && (w1 - w0) / period <= 30;
  const vsyncs = showClock && profile ? hwVsyncs(profile, [w0, w1]) : [];
  const ticks: {at: number; lane: string; label: string}[] = [];
  const appLane = script.vsyncLanes?.app;
  const sfLane = script.vsyncLanes?.sf;
  if (showClock && profile && appLane) {
    wakeTimes(profile, 'app', [w0, w1]).forEach((at) => ticks.push({at, lane: appLane, label: 'VSYNC-app'}));
  }
  if (showClock && profile && sfLane) {
    wakeTimes(profile, 'sf', [w0, w1]).forEach((at) => ticks.push({at, lane: sfLane, label: 'VSYNC-sf'}));
  }

  const spans = eventsOf(script, 'span');
  const calls = eventsOf(script, 'call');
  const posts = eventsOf(script, 'post');

  const arrows: Arrow[] = [
    ...eventsOf(script, 'message').map((m): Arrow => ({at: m.at, from: m.from, to: m.to, label: m.label, kind: 'message'})),
    ...eventsOf(script, 'batch').map((b): Arrow => ({at: b.at, from: b.from, to: b.to, label: b.label, kind: 'batch'})),
    ...calls.flatMap((c): Arrow[] => {
      const out: Arrow[] = [{at: c.at, from: c.from, to: c.to, label: c.method, kind: 'call'}];
      if (c.returnAt !== undefined) out.push({at: c.returnAt, from: c.to, to: c.from, label: '', kind: 'return'});
      return out;
    }),
    ...eventsOf(script, 'invoke').flatMap((c): Arrow[] => {
      const out: Arrow[] = [{at: c.at, from: c.from, to: c.to, label: c.method, kind: 'invoke'}];
      if (c.returnAt !== undefined) out.push({at: c.returnAt, from: c.to, to: c.from, label: '', kind: 'iret'});
      return out;
    }),
    ...eventsOf(script, 'oneway').map((o): Arrow => ({at: o.at, from: o.from, to: o.to, label: `oneway ${o.method}`, kind: 'oneway'})),
    ...eventsOf(script, 'socket').map((s): Arrow => ({at: s.at, from: s.from, to: s.to, label: s.label, kind: 'socket'})),
    ...eventsOf(script, 'fork').map(
      (f): Arrow => ({at: f.at, from: f.from, to: f.to, label: f.label ?? (f.exec ? 'spawn' : 'fork'), kind: f.exec ? 'spawn' : 'fork'}),
    ),
    ...posts.map((p): Arrow => ({at: p.at, from: p.from, to: p.to, label: `post ${p.msg}`, kind: 'post'})),
  ];

  const markers: {at: number; lane: string; label: string; tone: Tone}[] = [
    ...eventsOf(script, 'marker').map((m) => ({at: m.at, lane: m.lane, label: m.label, tone: m.tone})),
    ...eventsOf(script, 'check').map((c) => {
      const ok = checkOk(script, c.signal, c.at);
      return {at: c.at, lane: c.lane, label: `${c.label} ${ok ? '✓' : '✗'}`, tone: (ok ? 'ok' : 'bad') as Tone};
    }),
    ...eventsOf(script, 'jank').map((j) => ({at: j.at, lane: j.lane, label: j.label, tone: 'warn' as Tone})),
    ...eventsOf(script, 'input').map((m) => ({at: m.at, lane: m.lane, label: m.label, tone: 'info' as Tone})),
  ];

  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const px = x(Math.max(w0, Math.min(w1, t)));
  const spanMs = w1 - w0;
  const timeLabel =
    script.timeUnit === 's'
      ? `t = ${(t / 1000).toFixed(2)} s`
      : script.timeUnit === 'step'
        ? `逻辑时刻 ${t.toFixed(0)}`
        : spanMs > 200
          ? `t = ${t.toFixed(0)} ms`
          : `t = ${t.toFixed(1)} ms`;
  const markAnim = animMs * 1.2;

  return (
    <svg width={width} height={height} style={{fontFamily: font, display: 'block'}}>
      <defs>
        <pattern id={`stripe-${pid}`} width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={4} height={10} fill="rgba(255,255,255,0.25)" />
        </pattern>
        <pattern id={`dim-${pid}`} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width={12} height={12} fill="rgba(0,0,0,0.25)" />
          <rect width={2} height={12} fill="rgba(148,163,184,0.12)" />
        </pattern>
        <clipPath id={`clip-${pid}`}>
          <rect x={chartX} y={0} width={chartW + 18} height={height} />
        </clipPath>
        {(Object.keys(ARROW_STYLES) as ArrowKind[]).map((k) => {
          const st = ARROW_STYLES[k];
          return (
            <marker key={k} id={`arr-${k}-${pid}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={st.hollow ? colors.panel2 : st.color} stroke={st.color} strokeWidth={st.hollow ? 1.5 : 0} />
            </marker>
          );
        })}
      </defs>

      {script.lanes.map((l, i) => {
        const y = headerH + i * laneH;
        const pc = procColor(l.id);
        const born = laneBornAt(script, l.id);
        const alive = t >= born;
        const hl = !!l.cls && focus.includes(l.cls);
        return (
          <g key={l.id}>
            <rect
              x={0}
              y={y}
              width={width}
              height={laneH}
              fill={hl ? colors.info : pc ?? '#ffffff'}
              fillOpacity={hl ? 0.12 : pc ? 0.045 : i % 2 ? 0.025 : 0}
            />
            {pc && <rect x={0} y={y + 2} width={5} height={laneH - 4} rx={2} fill={pc} />}
            <line x1={0} x2={width} y1={y + laneH} y2={y + laneH} stroke={colors.border} />
            <g opacity={alive ? 1 : 0.4}>
              <text
                x={14}
                y={y + laneH / 2 - (l.sub && !dense ? fs * 0.45 : 0)}
                fill={hl ? colors.info : colors.fg}
                fontSize={fs + 1}
                fontWeight={600}
                dominantBaseline="middle"
              >
                {fitText(l.label, labelW - 22, fs + 1)}
              </text>
              {l.sub && !dense && (
                <text x={14} y={y + laneH / 2 + fs * 0.85} fill={colors.muted} fontSize={fs - 3} dominantBaseline="middle">
                  {l.sub}
                </text>
              )}
            </g>
          </g>
        );
      })}
      <line x1={labelW} x2={labelW} y1={headerH} y2={height} stroke={colors.border} />
      {hasRes && (
        <>
          <line x1={chartX} x2={chartX} y1={headerH} y2={height} stroke={colors.border} />
          <text x={labelW + 10} y={headerH - 8} fill={colors.muted} fontSize={12}>
            buffer
          </text>
        </>
      )}

      <g clipPath={`url(#clip-${pid})`}>
        {script.lanes.map((l) => {
          const born = laneBornAt(script, l.id);
          if (!(born > w0)) return null;
          const xb = Math.min(x(born), chartX + chartW);
          return <rect key={`dim-${l.id}`} x={chartX} y={top(l.id)} width={Math.max(0, xb - chartX)} height={laneH} fill={`url(#dim-${pid})`} />;
        })}

        {vsyncs.map((v, i) => (
          <g key={`v${i}`}>
            <line x1={x(v)} x2={x(v)} y1={headerH - 4} y2={height} stroke="#94a3b8" strokeOpacity={0.45} strokeDasharray="6 6" />
            <text x={x(v) + 4} y={headerH - 6} fill={colors.muted} fontSize={12}>
              VSYNC
            </text>
          </g>
        ))}

        {ticks.map((k, i) => {
          const yb = top(k.lane) + laneH - 4;
          const xx = x(k.at);
          return (
            <g key={`k${i}`} opacity={t >= k.at ? 1 : 0.3}>
              <path d={`M${xx - 6},${yb} L${xx + 6},${yb} L${xx},${yb - 10} z`} fill={colors.info} />
              <text x={xx + 8} y={yb - 2} fontSize={fs - 4} fill={colors.info}>
                {k.label}
              </text>
            </g>
          );
        })}

        {calls
          .filter((c) => c.returnAt !== undefined && c.at <= t)
          .map((c, i) => {
            const xa = x(c.at);
            const xb = x(Math.min(c.returnAt as number, t));
            const y = mid(c.from) - 4;
            return (
              <g key={`blk${i}`}>
                <rect x={xa} y={y} width={Math.max(0, xb - xa)} height={8} fill="#64748b" fillOpacity={0.45} />
                <rect x={xa} y={y} width={Math.max(0, xb - xa)} height={8} fill={`url(#stripe-${pid})`} />
              </g>
            );
          })}

        {posts
          .filter((p) => p.at <= t)
          .map((p, i) => {
            const yy = top(p.to) + laneH * 0.18;
            const xa = x(p.at);
            const xb = x(Math.min(p.handledAt, t));
            const handled = p.handledAt <= t;
            return (
              <g key={`q${i}`}>
                <line x1={xa} x2={xb} y1={yy} y2={yy} stroke="#c084fc" strokeWidth={2} strokeDasharray="2 3" opacity={0.8} />
                {handled && <path d={`M${xb},${yy - 5} L${xb + 5},${yy} L${xb},${yy + 5} L${xb - 5},${yy} z`} fill="#c084fc" />}
              </g>
            );
          })}

        {spans
          .filter((s) => s.start <= t)
          .map((s, i) => {
            const x1 = x(s.start);
            const w = Math.max(0, x(Math.min(s.end, t)) - x1);
            const m = mid(s.lane);
            const y = m - spanH / 2;
            const rc = s.resource ? resourceColor(s.resource) : undefined;
            const fc = frameColor(s.frame);
            const tagW = s.resource && w > 26 ? 22 : 0;
            // span 起点在视窗左侧时，文字跟着滑出屏幕；把它钉在可视区内
            const lx0 = Math.max(x1, chartX) + 8 + tagW;
            const label = fitText(s.label, x1 + w - lx0 - 6, fs);
            return (
              <g key={`s${i}`}>
                <rect
                  x={x1}
                  y={y}
                  width={w}
                  height={spanH}
                  rx={5}
                  fill={spanColors[s.style]}
                  fillOpacity={s.style === 'display' ? 0.4 : 0.88}
                  stroke={rc ?? 'none'}
                  strokeWidth={rc ? 2.5 : 0}
                />
                {s.style === 'wait' && <rect x={x1} y={y} width={w} height={spanH} rx={5} fill={`url(#stripe-${pid})`} />}
                {fc && w > 8 && <rect x={x1 + 3} y={y + spanH - 5} width={w - 6} height={3} rx={1.5} fill={fc} />}
                {tagW > 0 && rc && (
                  <g>
                    <rect x={x1 + 4} y={m - 9} width={18} height={18} rx={4} fill={rc} />
                    <text x={x1 + 13} y={m + 1} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={800} fill="#111">
                      {s.resource}
                    </text>
                  </g>
                )}
                {label && (
                  <text x={lx0} y={m + 1} fill="#fff" fontSize={fs} dominantBaseline="middle">
                    {label}
                  </text>
                )}
              </g>
            );
          })}

        {arrows
          .filter((a) => t >= a.at)
          .map((a, i) => {
            const st = ARROW_STYLES[a.kind];
            const p = ease(clamp01((t - a.at) / animMs));
            const y1 = mid(a.from);
            const y2 = mid(a.to);
            const dir = Math.sign(y2 - y1) || 1;
            const ys = y1 + (dir * spanH) / 2;
            const ye = y2 - (dir * spanH) / 2;
            const yc = ys + (ye - ys) * p;
            const xx = x(a.at);
            const old = t - a.at > labelRecent;
            const lfs = fs - 3;
            const iconW = a.kind === 'batch' ? 18 : 0;
            const lw = textWidth(a.label, lfs) + 14 + iconW;
            const ly = (ys + ye) / 2;
            const marker = p > 0.2 ? `url(#arr-${a.kind}-${pid})` : undefined;
            return (
              <g key={`a${i}`} opacity={old ? 0.45 : 1}>
                {st.double ? (
                  <g>
                    <line x1={xx - 2} x2={xx - 2} y1={ys} y2={yc} stroke={st.color} strokeWidth={1.4} />
                    <line x1={xx + 2} x2={xx + 2} y1={ys} y2={yc} stroke={st.color} strokeWidth={1.4} markerEnd={marker} />
                  </g>
                ) : (
                  <line x1={xx} x2={xx} y1={ys} y2={yc} stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} markerEnd={marker} />
                )}
                {p > 0.6 && !old && a.label && (
                  <g opacity={clamp01((p - 0.6) / 0.4)}>
                    <rect x={xx + 6} y={ly - 11} width={lw} height={22} rx={4} fill={colors.panel2} stroke={st.color} />
                    {a.kind === 'batch' && (
                      <g>
                        <rect x={xx + 12} y={ly - 5} width={13} height={10} rx={1.5} fill="none" stroke={colors.orange} strokeWidth={1.4} />
                        <path d={`M${xx + 12},${ly - 5} L${xx + 18.5},${ly + 1} L${xx + 25},${ly - 5}`} fill="none" stroke={colors.orange} strokeWidth={1.4} />
                      </g>
                    )}
                    <text x={xx + 13 + iconW} y={ly + 1} fontSize={lfs} fill={colors.fg} dominantBaseline="middle">
                      {a.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

        {markers
          .filter((m) => t >= m.at)
          .map((m, i) => {
            const p = clamp01((t - m.at) / markAnim);
            const s = 0.6 + 0.4 * ease(p);
            const tw = textWidth(m.label, markFs) + 16;
            const mx = Math.max(chartX + tw / 2, Math.min(chartX + chartW - tw / 2, x(m.at)));
            return (
              <g key={`m${i}`} transform={`translate(${mx},${top(m.lane) + (dense ? 2 : 5)}) scale(${s})`} opacity={p}>
                <rect x={-tw / 2} y={0} width={tw} height={markH} rx={markH / 2} fill={toneColors[m.tone]} />
                <text x={0} y={markH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={markFs} fontWeight={700} fill="#0b1020">
                  {m.label}
                </text>
              </g>
            );
          })}

        {markLines
          .filter((m) => m.at >= w0 && m.at <= w1)
          .map((m) => (
            <g key={`ml-${m.label}-${m.at}`}>
              <line x1={x(m.at)} x2={x(m.at)} y1={headerH - 2} y2={height} stroke={m.color ?? colors.warn} strokeWidth={2} strokeDasharray="5 4" />
              <text x={x(m.at) + 5} y={headerH + 12} fontSize={12} fill={m.color ?? colors.warn} fontWeight={700}>
                {m.label}
              </text>
            </g>
          ))}
        <line x1={px} x2={px} y1={headerH - 2} y2={height} stroke="#fff" strokeWidth={2} />
        <rect x={px - 52} y={3} width={104} height={20} rx={4} fill="#fff" />
        <text x={px} y={14} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} fill="#0b1020">
          {timeLabel}
        </text>
      </g>

      {script.resources.map((r, i) => {
        const s = resourceAt(script, r.id, t);
        const p = ease(clamp01((t - s.since) / TOKEN_ANIM_MS));
        const ya = mid(s.prevOwner);
        const yy = ya + (mid(s.owner) - ya) * p;
        const cx = labelW + 20 + i * chipGap;
        const c = resourceColor(r.id);
        const fence = resourceFence(script, r.id, t);
        return (
          <g key={r.id} opacity={s.state === 'NONE' ? 0.25 : 1}>
            {focus.includes(r.id) && (
              <circle cx={cx} cy={yy} r={17 + pulse * 3} fill="none" stroke={c} strokeWidth={2} opacity={0.4 + 0.6 * pulse} />
            )}
            <rect x={cx - 12} y={yy - 12} width={24} height={24} rx={6} fill={c} stroke={stateColor(s.state)} strokeWidth={3} />
            <text x={cx} y={yy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={800} fill="#111">
              {r.label}
            </text>
            {fence && !fence.signaled && (
              <FenceFlag x={cx + 10} y={yy - 10} color={fence.kind === 'release-fence' ? colors.warn : colors.bad} />
            )}
          </g>
        );
      })}
    </svg>
  );
};
