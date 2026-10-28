import React from 'react';
import {getPool, getStateMachine} from '../catalog';
import type {FlowScript} from '../dsl/types';
import {gpuWriting, resourceAt, resourceFence} from '../engine/state';
import {colors, mono, resourceColor, stateColor} from '../theme';

export const ResourcePoolView: React.FC<{script: FlowScript; t: number; focus?: string[]; compact?: boolean}> = ({
  script,
  t,
  focus = [],
  compact = false,
}) => {
  const cfg = script.pool;
  if (!cfg) return null;
  const pool = getPool(cfg.def);
  const sm = getStateMachine(pool.stateMachine);
  const laneLabel = (id: string) => script.lanes.find((l) => l.id === id)?.label ?? id;
  const fs = compact ? 14 : 16;

  const snaps = script.resources.map((r) => ({
    r,
    s: resourceAt(script, r.id, t),
    gpu: gpuWriting(script, r.id, t),
    fence: resourceFence(script, r.id, t),
  }));
  const count = (st: string) => snaps.filter((x) => x.s.state === st).length;
  const cap = pool.quotas.reduce((sum, q) => sum + (cfg.params[q.param] ?? 0), 0);
  const inUse = snaps.filter((x) => x.s.state !== pool.freeState).length;

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: compact ? 7 : 11, height: '100%'}}>
      <div style={{fontSize: compact ? 15 : 19, fontWeight: 700}}>
        {compact ? `资源池 · ${script.resources.length} 块` : `${pool.title} · ${script.resources.length} 块`}
      </div>

      {snaps.map(({r, s, gpu, fence}) => {
        const badges: {text: string; color: string}[] = [];
        if (gpu) badges.push({text: 'GPU 写入中', color: colors.gpu});
        if (fence && !fence.signaled) {
          badges.push(
            fence.kind === 'release-fence'
              ? {text: 'release fence 未 signal', color: colors.warn}
              : {text: 'acquire fence 未 signal', color: colors.bad},
          );
        }
        const shown = compact ? badges.slice(0, 1) : badges.slice(0, 2);
        return (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: compact ? '4px 8px' : '8px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${focus.includes(r.id) ? resourceColor(r.id) : colors.border}`,
            }}
          >
            <div
              style={{
                width: compact ? 26 : 32,
                height: compact ? 26 : 32,
                borderRadius: 8,
                background: resourceColor(r.id),
                color: '#111',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 14 : 17,
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: stateColor(s.state),
                fontFamily: mono,
                fontSize: fs - 3,
                fontWeight: 700,
                minWidth: compact ? 80 : 94,
                textAlign: 'center',
              }}
            >
              {s.state}
            </div>
            <div style={{fontSize: fs - 1, color: colors.muted, whiteSpace: 'nowrap'}}>{laneLabel(s.owner)}</div>
            <div style={{marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end'}}>
              {shown.map((b) => (
                <div
                  key={b.text}
                  style={{
                    fontSize: fs - 4,
                    padding: '1px 6px',
                    borderRadius: 6,
                    border: `1px solid ${b.color}`,
                    color: b.color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.text}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
        {sm.states
          .filter((st) => st !== pool.freeState)
          .map((st) => {
            const n = count(st);
            const q = pool.quotas.find((x) => x.state === st);
            const max = q ? cfg.params[q.param] : undefined;
            const text = max === undefined ? `${n}` : `${n}/${max}${n > max ? ' +1 豁免' : ''}`;
            return (
              <div
                key={st}
                style={{
                  border: `1px solid ${stateColor(st)}`,
                  color: '#cbd5e1',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontFamily: mono,
                  fontSize: fs - 3,
                }}
              >
                {st} {text}
              </div>
            );
          })}
      </div>

      {pool.quotas.length > 0 && (
        <div style={{fontSize: fs - 1, color: inUse >= cap ? colors.warn : colors.muted}}>
          在用 {inUse} / 总量 {cap}
          {inUse >= cap ? `（已满：再 ${pool.onExhausted.wait} 就要等）` : ''}
        </div>
      )}
    </div>
  );
};
