import React from 'react';
import {getClass} from '../catalog/classes';
import type {FlowScript} from '../dsl/types';
import {callStackAt, getInstance} from '../engine/instances';
import {colors, layerColors, mono} from '../theme';
import {ARROW_STYLES} from './SwimlaneView';

const nameOf = (script: FlowScript, id: string) => {
  const i = getInstance(script, id);
  return i ? getClass(i.cls).name : id;
};

const procColor = (script: FlowScript, id: string) => {
  const i = getInstance(script, id);
  const p = script.processes?.find((x) => x.id === i?.process);
  return p ? layerColors[p.layer] : colors.muted;
};

/** t 时刻还没返回的同步调用（外层在上），以及 MessageQueue 里排队的消息 */
/** only：只看这些实例参与的调用（如某个进程），避免别的进程里永不返回的调用混进来 */
export const CallStackView: React.FC<{script: FlowScript; t: number; unit?: string; only?: string[]}> = ({script, t, unit = '步', only}) => {
  const all = callStackAt(script, t);
  const keep = (c: {from: string; to: string}) => !only || (only.includes(c.from) && only.includes(c.to)) || only.includes(c.to);
  const open = all.frames.filter((f) => keep(f.call));
  const frames = open.map((f) => ({call: f.call, depth: open.filter((p) => p !== f && p.call.at <= f.call.at && f.call.end <= p.call.end).length}));
  const queued = all.queued.filter(keep);
  const deepest = frames.reduce((m, f) => Math.max(m, f.call.at), -Infinity);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 6, height: '100%', overflow: 'hidden'}}>
      <div style={{fontSize: 16, fontWeight: 700}}>
        调用栈 <span style={{fontSize: 12, color: colors.muted, fontWeight: 400}}>未返回的同步调用 · 外层在上</span>
      </div>
      {frames.length === 0 && <div style={{fontSize: 13, color: colors.muted}}>（此刻没有阻塞中的同步调用）</div>}
      {frames.map((f, i) => {
        const c = f.call;
        const top = c.at === deepest;
        const binder = c.kind === 'call';
        return (
          <div
            key={i}
            style={{
              marginLeft: f.depth * 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 6,
              borderLeft: `3px solid ${procColor(script, c.to)}`,
              background: top ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.03)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              fontFamily: mono,
              fontSize: 12.5,
            }}
          >
            {binder && (
              <span style={{fontSize: 10, padding: '0 5px', borderRadius: 4, border: `1px solid ${ARROW_STYLES.call.color}`, color: ARROW_STYLES.call.color}}>
                binder
              </span>
            )}
            <span style={{color: colors.fg, fontWeight: top ? 800 : 500}}>{nameOf(script, c.to)}</span>
            <span style={{color: colors.info, overflow: 'hidden', textOverflow: 'ellipsis'}}>.{c.label}</span>
          </div>
        );
      })}
      {queued.length > 0 && (
        <>
          <div style={{fontSize: 14, fontWeight: 700, marginTop: 6, color: ARROW_STYLES.post.color}}>MessageQueue 排队</div>
          {queued.map((q, i) => (
            <div key={`q${i}`} style={{fontFamily: mono, fontSize: 12.5, color: '#d8b4fe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              ◆ {nameOf(script, q.to)} ← {q.label}
              <span style={{color: colors.muted}}>（已等 {Math.round(t - q.at)} {unit}）</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
