import React from 'react';
import type {FlowScript} from '../dsl/types';
import {diffAt, firstDivergence} from '../engine/diff';
import {fmtSim} from '../engine/text';
import {colors, mono} from '../theme';

const TAG: Record<string, {text: string; color: string}> = {
  'only-a': {text: '仅 A', color: colors.ok},
  'only-b': {text: '仅 B', color: colors.bad},
  shifted: {text: '时刻不同', color: colors.warn},
  timer: {text: '计时器', color: colors.pink},
};

/** 对比模板的差异面板：只列 t 之前已经出现的差异，最新的在下面并高亮 */
export const DiffView: React.FC<{a: FlowScript; b: FlowScript; t: number; recent?: number; max?: number}> = ({a, b, t, recent, max = 14}) => {
  const all = diffAt(a, b, t);
  const span = Math.max(a.window[1] - a.window[0], b.window[1] - b.window[0]);
  const fresh = recent ?? span * 0.03;
  const first = firstDivergence(a, b);
  const unit = a.timeUnit;
  const shown = all.slice(-max);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 6, height: '100%', overflow: 'hidden'}}>
      <div style={{fontSize: 16, fontWeight: 700}}>差异</div>
      <div style={{fontSize: 12, color: colors.muted, lineHeight: 1.5}}>
        <span style={{color: colors.ok}}>A</span> {a.title}
        <br />
        <span style={{color: colors.bad}}>B</span> {b.title}
      </div>
      <div style={{fontSize: 13, fontFamily: mono, color: first !== undefined && t >= first ? colors.warn : colors.muted}}>
        {first === undefined ? '两份脚本没有差异' : t >= first ? `首次分歧：${fmtSim(first, unit)}` : '目前两边一致'}
      </div>
      {all.length > shown.length && <div style={{fontSize: 11, color: colors.muted}}>… 更早的 {all.length - shown.length} 条</div>}
      {shown.map((d, i) => {
        const tag = TAG[d.kind];
        const hot = t - d.at < fresh;
        return (
          <div
            key={`${d.kind}${d.label}${d.at}${i}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '4px 8px',
              borderRadius: 6,
              borderLeft: `3px solid ${tag.color}`,
              background: hot ? `${tag.color}22` : 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5}}>
              <span style={{fontSize: 10.5, padding: '0 5px', borderRadius: 4, border: `1px solid ${tag.color}`, color: tag.color, flexShrink: 0}}>{tag.text}</span>
              <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.label}</span>
            </div>
            {d.kind !== 'timer' && (
              <div style={{fontFamily: mono, fontSize: 11, color: colors.muted}}>
                {d.atA !== undefined && `A ${fmtSim(d.atA, unit)}`}
                {d.atA !== undefined && d.atB !== undefined && ' · '}
                {d.atB !== undefined && `B ${fmtSim(d.atB, unit)}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
