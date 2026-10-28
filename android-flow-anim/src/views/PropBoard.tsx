import React from 'react';
import type {FlowScript} from '../dsl/types';
import {propsAt} from '../engine/state';
import {colors, mono} from '../theme';

/** 关键系统属性在 t 时刻的值；刚变化的行高亮 */
export const PropBoard: React.FC<{script: FlowScript; t: number; within?: number}> = ({script, t, within = 600}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 5}}>
    <div style={{fontSize: 16, fontWeight: 700, marginBottom: 2}}>关键属性（getprop）</div>
    {propsAt(script, t).map((p) => {
      const fresh = p.at !== undefined && t - p.at < within;
      return (
        <div
          key={p.key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            padding: '4px 8px',
            borderRadius: 6,
            background: fresh ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.03)',
            fontFamily: mono,
            fontSize: 12,
          }}
        >
          <span style={{color: colors.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{p.key}</span>
          <span style={{color: p.value ? colors.fg : colors.muted, fontWeight: 700}}>{p.value ?? '—'}</span>
        </div>
      );
    })}
  </div>
);
