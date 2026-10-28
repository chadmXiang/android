import React from 'react';
import type {FlowScript} from '../dsl/types';
import {eventsOf, objectStateAt, treeAt} from '../engine/state';
import {fmtSim} from '../engine/text';
import {colors, mono, stateColors} from '../theme';

/**
 * 生命周期视图（前台切换）：每个 Activity 一张卡片——
 *   客户端回调（ActivityLifecycleItem 状态 → onCreate / onStart …）、服务端 ActivityRecord.State、可见 / 前台 / 焦点徽标；
 * 底部一条"先后顺序轴"：两个 Activity 的回调和关键里程碑按发生顺序排开（等距，不按时间比例），看清交错关系。
 */

export interface LifecycleRow {
  title: string;
  sub?: string;
  color: string;
  /** 客户端生命周期对象（状态机 activity-lifecycle） */
  client: string;
  /** 服务端 ActivityRecord 对象 */
  server?: string;
  /** 窗口的树节点：note === '焦点窗口' 时显示输入焦点 */
  windowNode?: string;
  /** 可见性：给一个绘制状态对象，到 HAS_DRAWN 即可见；或直接给"可见区间" */
  visibleWhenDrawn?: string;
  visibleUntil?: number;
}

export interface LifecycleConfig {
  rows: LifecycleRow[];
  /** 顺序轴上额外显示的里程碑：取脚本里同名 marker 的时刻 */
  milestones?: string[];
  tree?: string;
}

const CALLBACK: Record<string, string> = {
  PRE_ON_CREATE: 'new Activity',
  ON_CREATE: 'onCreate',
  ON_START: 'onStart',
  ON_RESUME: 'onResume',
  ON_PAUSE: 'onPause',
  ON_STOP: 'onStop',
  ON_RESTART: 'onRestart',
  ON_DESTROY: 'onDestroy',
};

const Badge: React.FC<{on: boolean; text: string; color: string}> = ({on, text, color}) => (
  <span
    style={{
      fontSize: 13,
      fontWeight: 700,
      padding: '2px 10px',
      borderRadius: 10,
      border: `1.5px solid ${on ? color : '#334155'}`,
      background: on ? `${color}26` : 'transparent',
      color: on ? color : '#475569',
    }}
  >
    {on ? '●' : '○'} {text}
  </span>
);

export const LifecycleView: React.FC<{script: FlowScript; t: number; width: number; height: number; frame: number; config?: LifecycleConfig}> = ({
  script,
  t,
  width,
  height,
  frame,
  config,
}) => {
  if (!config) return <div style={{color: colors.bad}}>lifecycle 槽位需要 options.lifecycle</div>;
  const breathe = 0.5 + 0.5 * Math.sin(frame / 6);
  const nodes = treeAt(script, config.tree ?? 'wm', t);
  const states = eventsOf(script, 'state');
  const markers = eventsOf(script, 'marker');
  const unit = script.timeUnit;
  const cardH = Math.min(230, (height - 230) / config.rows.length - 14);

  // 顺序轴：所有行的客户端回调 + 里程碑，按时刻排序
  type Tick = {at: number; label: string; color: string; row?: number};
  const ticks: Tick[] = [];
  config.rows.forEach((r, ri) =>
    states
      .filter((e) => e.object === r.client && e.at > script.window[0])
      .forEach((e) => ticks.push({at: e.at, label: `${r.title.split(' ')[0]} ${CALLBACK[e.to] ?? e.to}`, color: r.color, row: ri})),
  );
  (config.milestones ?? []).forEach((m) => {
    const e = markers.find((x) => x.label === m);
    if (e) ticks.push({at: e.at, label: m, color: colors.warn});
  });
  ticks.sort((a, b) => a.at - b.at);
  const axisY = height - 120;
  const ax0 = 60;
  const ax1 = width - 60;
  const tx = (i: number) => (ticks.length < 2 ? (ax0 + ax1) / 2 : ax0 + ((ax1 - ax0) * i) / (ticks.length - 1));
  // 播放头：落在相邻两个刻度之间按时间插值
  const k = ticks.filter((x) => x.at <= t).length;
  const headX =
    k === 0 ? ax0 - 30 : k >= ticks.length ? ax1 + 20 : tx(k - 1) + ((tx(k) - tx(k - 1)) * (t - ticks[k - 1].at)) / Math.max(1e-6, ticks[k].at - ticks[k - 1].at);

  return (
    <div style={{position: 'relative', width, height}}>
      {config.rows.map((r, ri) => {
        const cl = objectStateAt(script, r.client, t);
        const sv = r.server ? objectStateAt(script, r.server, t) : undefined;
        const seq = states.filter((e) => e.object === r.client);
        const focused = !!r.windowNode && nodes.get(r.windowNode)?.note === '焦点窗口';
        const drawn = r.visibleWhenDrawn ? objectStateAt(script, r.visibleWhenDrawn, t).state === 'HAS_DRAWN' : false;
        const visible = r.visibleWhenDrawn ? drawn : r.visibleUntil !== undefined ? t < r.visibleUntil : false;
        const top = sv?.state === 'RESUMED';
        const y = 14 + ri * (cardH + 14);
        return (
          <div
            key={r.client}
            style={{
              position: 'absolute',
              left: 14,
              top: y,
              width: width - 28,
              height: cardH,
              boxSizing: 'border-box',
              padding: '12px 18px',
              borderRadius: 14,
              border: `2px solid ${top ? r.color : colors.border}`,
              borderLeft: `6px solid ${r.color}`,
              background: colors.panel2,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <span style={{fontSize: 21, fontWeight: 800}}>{r.title}</span>
              {r.sub && <span style={{fontSize: 13, color: colors.muted}}>{r.sub}</span>}
              <span style={{marginLeft: 'auto', display: 'flex', gap: 8}}>
                <Badge on={top} text="前台（RESUMED）" color={colors.ok} />
                <Badge on={visible} text="可见" color={colors.info} />
                <Badge on={focused} text="输入焦点" color={colors.pink} />
              </span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
              <span style={{fontSize: 13, color: colors.muted, width: 92}}>客户端回调</span>
              {seq.map((e, i) => {
                const reached = e.at <= t;
                const cur = reached && cl.state === e.to && cl.since === e.at;
                const initial = e.at <= script.window[0];
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{color: reached ? colors.fg : '#334155'}}>→</span>}
                    <span
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '5px 12px',
                        borderRadius: 9,
                        border: `1.5px solid ${reached ? r.color : '#334155'}`,
                        background: cur ? `${r.color}33` : reached ? `${r.color}12` : 'transparent',
                        boxShadow: cur ? `0 0 ${8 + 10 * breathe}px ${r.color}88` : undefined,
                        opacity: reached ? 1 : 0.45,
                        minWidth: 86,
                      }}
                    >
                      <span style={{fontFamily: mono, fontSize: 15, fontWeight: 800}}>{CALLBACK[e.to] ?? e.to}</span>
                      <span style={{fontFamily: mono, fontSize: 10.5, color: colors.muted}}>{initial ? '启动前' : reached ? fmtSim(e.at, unit) : '…'}</span>
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
            {sv && (
              <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <span style={{fontSize: 13, color: colors.muted, width: 92}}>服务端状态</span>
                <span style={{fontSize: 13, color: colors.muted}}>ActivityRecord.State</span>
                {sv.prev && <span style={{fontFamily: mono, fontSize: 12, color: colors.muted}}>{sv.prev} →</span>}
                <span style={{fontFamily: mono, fontSize: 14, fontWeight: 800, padding: '2px 10px', borderRadius: 6, background: stateColors[sv.state ?? ''] ?? '#0e7490'}}>
                  {sv.state ?? '—'}
                </span>
                {sv.state && cl.state && (
                  <span style={{fontSize: 12, color: colors.warn, marginLeft: 6}}>
                    {sv.state === 'RESUMED' && cl.state !== 'ON_RESUME' ? '服务端已 RESUMED，客户端还没走到 onResume' : ''}
                    {sv.state === 'PAUSING' && cl.state === 'ON_RESUME' ? 'Pause 已下发，客户端还没执行 onPause' : ''}
                    {sv.state === 'STOPPING' && cl.state !== 'ON_STOP' ? 'Stop 已下发，客户端还没执行 onStop' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 先后顺序轴 */}
      <div style={{position: 'absolute', left: 20, top: axisY - 78, fontSize: 15, fontWeight: 700, color: colors.muted}}>先后顺序（等距排列，不按时间比例）</div>
      <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={ax0 - 20} x2={ax1 + 20} y1={axisY} y2={axisY} stroke="#475569" strokeWidth={2} />
        {ticks.map((tk, i) => {
          const x = tx(i);
          const reached = tk.at <= t;
          const up = tk.row === 0 || (tk.row === undefined && i % 2 === 0);
          return (
            <g key={i} opacity={reached ? 1 : 0.35}>
              <circle cx={x} cy={axisY} r={reached ? 8 : 6} fill={reached ? tk.color : colors.bg} stroke={tk.color} strokeWidth={2} />
              <line x1={x} x2={x} y1={axisY + (up ? -10 : 10)} y2={axisY + (up ? -26 : 26)} stroke={tk.color} />
              <text x={x} y={axisY + (up ? -34 : 42)} textAnchor="middle" fontSize={13} fontWeight={700} fill={tk.color}>
                {tk.label}
              </text>
              <text x={x} y={axisY + (up ? -50 : 58)} textAnchor="middle" fontSize={10.5} fill={colors.muted} fontFamily={mono}>
                {fmtSim(tk.at, unit)}
              </text>
            </g>
          );
        })}
        <line x1={headX} x2={headX} y1={axisY - 70} y2={axisY + 70} stroke="#fff" strokeWidth={2} />
      </svg>
    </div>
  );
};
