import React from 'react';
import {getStateMachine} from '../catalog';
import type {FlowScript} from '../dsl/types';
import {fieldsAt, getInstance, objectsOf} from '../engine/instances';
import {activeSpan, eventsOf, objectStateAt, stateSourceLane, timersOf} from '../engine/state';
import {clamp01, ease, fmtSim} from '../engine/text';
import {colors, layerColors, mono} from '../theme';
import {StateView, stateNodeRect} from './StateView';

/**
 * 状态驱动模板的主视图：状态机居中，参与的泳道（进程 / 线程）摆在四周；
 * 每次迁移从"来源泳道"飞一条箭头打进新状态；挂在对象上的超时计时器画成倒计时环。
 */

const SRC_W = 210;
const SRC_H = 78;

export interface StateStageProps {
  script: FlowScript;
  t: number;
  width: number;
  height: number;
  frame: number;
  object?: string;
  /** 当前镜头时间窗：箭头飞行 / 高亮时长按窗宽比例换算（毫秒级和秒级流程都适用） */
  view?: [number, number];
}

/** 默认对象：挂了计时器的对象优先，否则第一个状态机对象 */
export const defaultStateObject = (s: FlowScript) =>
  eventsOf(s, 'timeout').find((e) => e.object)?.object ?? objectsOf(s)[0]?.id;

/** 箭头飞行时长：时间窗宽度的 4%（停点规则同样用它） */
export const stateStagePulse = (view: [number, number]) => Math.max(1, (view[1] - view[0]) * 0.04);

export const StateStageView: React.FC<StateStageProps> = ({script, t, width, height, frame, object, view}) => {
  const obj = object ?? defaultStateObject(script);
  const def = objectsOf(script).find((o) => o.id === obj);
  if (!def) return <div style={{color: colors.muted, padding: 20}}>没有状态机对象</div>;
  const machine = getStateMachine(def.stateMachine);
  const v = view ?? script.window;
  const pulse = stateStagePulse(v);
  const st = objectStateAt(script, def.id, t);

  const stateEvents = eventsOf(script, 'state')
    .filter((e) => e.object === def.id)
    .sort((a, b) => a.at - b.at);
  const timers = timersOf(script, t, def.id);
  // 四周的来源：迁移的来源泳道、计时器的启动泳道，以及对象存续期间有活动的泳道（被阻塞的线程往往才是主角），
  // 按脚本泳道顺序左右交替，最多 6 条
  const bornAt = stateEvents[0]?.at ?? -Infinity;
  const involved = new Set(
    [
      ...stateEvents.map((e) => stateSourceLane(script, e)),
      ...eventsOf(script, 'timeout').filter((e) => e.object === def.id).map((e) => e.lane),
      ...eventsOf(script, 'span').filter((e) => e.end >= bornAt && e.style !== 'display').map((e) => e.lane),
    ].filter((x): x is string => !!x),
  );
  const srcLanes = script.lanes.map((l) => l.id).filter((id) => involved.has(id)).slice(0, 6);
  const left = srcLanes.filter((_, i) => i % 2 === 0);
  const right = srcLanes.filter((_, i) => i % 2 === 1);
  const colY = (n: number, i: number) => {
    const total = n * SRC_H + (n - 1) * 26;
    return (height - 120 - total) / 2 + 40 + i * (SRC_H + 26);
  };
  const srcRect = new Map<string, {x: number; y: number; w: number; h: number; side: 'l' | 'r'}>();
  left.forEach((l, i) => srcRect.set(l, {x: 16, y: colY(left.length, i), w: SRC_W, h: SRC_H, side: 'l'}));
  right.forEach((l, i) => srcRect.set(l, {x: width - 16 - SRC_W, y: colY(right.length, i), w: SRC_W, h: SRC_H, side: 'r'}));

  const sm = {x: SRC_W + 40, y: 30, w: width - 2 * (SRC_W + 40), h: height - 150};
  const recent = stateEvents.filter((e) => e.at <= t && t - e.at < pulse);
  const breathe = 0.5 + 0.5 * Math.sin(frame / 6);
  const laneDef = (id: string) => script.lanes.find((l) => l.id === id);
  const laneColor = (id: string) => {
    const p = script.processes?.find((x) => x.id === laneDef(id)?.process);
    return p ? layerColors[p.layer] : colors.muted;
  };

  // 计时器环：放在状态机区域右上角
  const ringR = 46;
  const isInst = !!getInstance(script, def.id);
  const fields = isInst ? [...fieldsAt(script, def.id, t).entries()] : [];

  return (
    <div style={{position: 'relative', width, height}}>
      <div style={{position: 'absolute', left: sm.x, top: sm.y, width: sm.w, height: sm.h}}>
        <StateView machine={machine.id} current={st.state} prev={st.prev} width={sm.w} height={sm.h} title={`${def.label} · ${machine.title}`} />
      </div>

      {/* 来源泳道 */}
      {[...srcRect.entries()].map(([id, r]) => {
        const sp = activeSpan(script, [id], t);
        const hit = recent.some((e) => stateSourceLane(script, e) === id);
        const c = laneColor(id);
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              boxSizing: 'border-box',
              padding: '8px 12px',
              borderRadius: 12,
              border: `1.5px solid ${hit ? colors.info : sp?.style === 'wait' ? colors.bad : colors.border}`,
              borderLeft: `5px solid ${c}`,
              background: hit ? 'rgba(56,189,248,0.12)' : colors.panel2,
              boxShadow: hit ? `0 0 ${8 + 10 * breathe}px ${colors.info}66` : undefined,
              overflow: 'hidden',
            }}
          >
            <div style={{fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{laneDef(id)?.label ?? id}</div>
            <div style={{fontSize: 11, color: colors.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{laneDef(id)?.sub}</div>
            <div
              style={{
                fontSize: 12,
                marginTop: 4,
                color: sp ? (sp.style === 'wait' ? colors.bad : colors.info) : '#475569',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {sp ? `${sp.style === 'wait' ? '⏸' : '▶'} ${sp.label}` : '空闲'}
            </div>
          </div>
        );
      })}

      {/* 迁移箭头：来源泳道 → 新状态节点 */}
      <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        {recent.map((e, i) => {
          const lane = stateSourceLane(script, e);
          const r = lane ? srcRect.get(lane) : undefined;
          const node = stateNodeRect(machine.id, e.to, sm.w, sm.h);
          if (!r || !node) return null;
          const sx = r.side === 'l' ? r.x + r.w : r.x;
          const sy = r.y + r.h / 2;
          const ex = sm.x + node.x + (r.side === 'l' ? 0 : node.w);
          const ey = sm.y + node.y + node.h / 2;
          const p = ease(clamp01((t - e.at) / (pulse * 0.5)));
          const fade = 1 - clamp01((t - e.at - pulse * 0.6) / (pulse * 0.4));
          const cx1 = sx + (ex - sx) * 0.5;
          const pts = (k: number) => {
            const u = 1 - k;
            return {
              x: u * u * u * sx + 3 * u * u * k * cx1 + 3 * u * k * k * cx1 + k * k * k * ex,
              y: u * u * u * sy + 3 * u * u * k * sy + 3 * u * k * k * ey + k * k * k * ey,
            };
          };
          const n = 24;
          const d = Array.from({length: Math.max(2, Math.round(n * p))}, (_, j) => pts((j / (Math.max(2, Math.round(n * p)) - 1)) * p));
          const via = machine.edges.find((x) => x.to === e.to && x.from === stateEvents[stateEvents.indexOf(e) - 1]?.to)?.via;
          const head = d[d.length - 1];
          const c = laneColor(lane as string);
          return (
            <g key={i} opacity={fade}>
              <path d={'M' + d.map((q) => `${q.x},${q.y}`).join(' L')} fill="none" stroke={c} strokeWidth={3} />
              <circle cx={head.x} cy={head.y} r={6} fill={c} />
              {p > 0.3 && via && (
                <g>
                  {/* 标签贴在目标状态上方，短箭头时也不会压住来源框 */}
                  <rect x={sm.x + node.x + node.w / 2 - 125} y={sm.y + node.y - 34} width={250} height={24} rx={6} fill="rgba(13,17,23,0.92)" stroke={c} />
                  <text x={sm.x + node.x + node.w / 2} y={sm.y + node.y - 21} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill={c} fontFamily={mono}>
                    {via.length > 30 ? via.slice(0, 29) + '…' : via}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* 计时器倒计时环 */}
      {timers
        .filter((tm) => tm.status !== 'idle')
        .map((tm, i) => {
          const cx = sm.x + sm.w - ringR - 10 - i * (ringR * 2 + 30);
          const cy = sm.y + sm.h + 50;
          const col = tm.status === 'cancelled' ? colors.ok : tm.status === 'fired' ? colors.bad : tm.progress > 0.75 ? colors.warn : colors.info;
          const a = tm.progress * Math.PI * 2;
          const arc = `M${cx},${cy - ringR} A${ringR},${ringR} 0 ${a > Math.PI ? 1 : 0} 1 ${cx + ringR * Math.sin(a)},${cy - ringR * Math.cos(a)}`;
          return (
            <React.Fragment key={tm.id}>
              <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
                <circle cx={cx} cy={cy} r={ringR} fill={colors.panel2} stroke="#334155" strokeWidth={8} />
                {tm.progress > 0.001 && tm.progress < 0.999 && <path d={arc} fill="none" stroke={col} strokeWidth={8} strokeLinecap="round" />}
                {tm.progress >= 0.999 && <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={col} strokeWidth={8} opacity={0.6 + 0.4 * breathe} />}
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize={15} fontWeight={800} fill={col} fontFamily={mono}>
                  {tm.status === 'cancelled' ? '✓' : tm.status === 'fired' ? '超时' : fmtSim(tm.remaining, script.timeUnit)}
                </text>
                <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill={colors.muted}>
                  {tm.status === 'cancelled' ? '已取消' : tm.status === 'fired' ? '已到期' : '剩余'}
                </text>
              </svg>
              <div style={{position: 'absolute', left: cx - 260 - ringR - 16, top: cy - 22, width: 260, textAlign: 'right', fontSize: 13, color: col, lineHeight: 1.4}}>
                <div style={{fontWeight: 700}}>{tm.label}</div>
                <div style={{color: colors.muted, fontFamily: mono, fontSize: 12}}>
                  启动 {fmtSim(tm.armedAt, script.timeUnit)} · 到期 {fmtSim(tm.deadline, script.timeUnit)}
                </div>
              </div>
            </React.Fragment>
          );
        })}

      {/* 实例字段（对象是实例时） */}
      {fields.length > 0 && (
        <div style={{position: 'absolute', left: sm.x, top: sm.y + sm.h + 18, display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: sm.w - 400}}>
          {fields.map(([k, fv]) => {
            const fresh = t - fv.since < pulse;
            return (
              <span
                key={k}
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  padding: '3px 9px',
                  borderRadius: 6,
                  border: `1px solid ${fresh ? colors.lime : colors.border}`,
                  background: fresh ? 'rgba(163,230,53,0.15)' : colors.panel2,
                }}
              >
                <span style={{color: colors.muted}}>{k}</span> = <span style={{color: colors.fg, fontWeight: 700}}>{fv.value ?? 'null'}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
