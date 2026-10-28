import React from 'react';
import type {FlowScript} from '../dsl/types';
import {objectsOf} from '../engine/instances';
import {objectStateAt} from '../engine/state';
import {colors, mono, stateColors} from '../theme';

/** 脚本里所有对象（ActivityRecord / ProcessRecord / Transition…）的当前状态 */
export const ObjectBoard: React.FC<{script: FlowScript; t: number; within?: number}> = ({script, t, within = 20}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
    <div style={{fontSize: 16, fontWeight: 700}}>对象状态</div>
    {objectsOf(script).map((o) => {
      const s = objectStateAt(script, o.id, t);
      const recent = !!s.state && t - s.since < within;
      return (
        <div
          key={o.id}
          style={{
            padding: '6px 10px',
            borderRadius: 10,
            border: `1.5px solid ${recent ? colors.info : colors.border}`,
            background: recent ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={{fontSize: 13, color: colors.muted}}>{o.label}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 3}}>
            {s.prev && <span style={{fontFamily: mono, fontSize: 11, color: colors.muted}}>{s.prev} →</span>}
            <span
              style={{
                fontFamily: mono,
                fontSize: 14,
                fontWeight: 800,
                padding: '1px 8px',
                borderRadius: 6,
                background: s.state ? stateColors[s.state] ?? '#0e7490' : '#334155',
              }}
            >
              {s.state ?? '—'}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);
