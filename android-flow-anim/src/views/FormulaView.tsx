import React from 'react';
import {getClockProfile} from '../catalog';
import {deriveClock} from '../engine/clock';
import {clamp01} from '../engine/text';
import {colors, font, mono} from '../theme';

export const FORMULA_ROWS = 8;
export const formulaSeconds = (rowStart = 1, rowGap = 1.4) => rowStart + FORMULA_ROWS * rowGap + 0.4;

const f2 = (v: number) => `${Number(v.toFixed(2))}`;

export const FormulaView: React.FC<{
  profiles: string[];
  maxDequeued: number;
  sec: number;
  rowStart?: number;
  rowGap?: number;
}> = ({profiles, maxDequeued, sec, rowStart = 1, rowGap = 1.4}) => {
  const cols = profiles.map((id) => {
    const p = getClockProfile(id);
    return {p, d: deriveClock(p)};
  });

  const rows: {k: string; v: string[]; strong?: boolean; code?: boolean}[] = [
    {k: 'VSYNC 周期', v: cols.map((c) => `${f2(c.d.period)}ms`)},
    {k: 'appWorkDuration', code: true, v: cols.map((c) => `${f2(c.d.appWork)}ms`)},
    {k: 'sfWorkDuration', code: true, v: cols.map((c) => `${f2(c.d.sfWork)}ms`)},
    {k: 'presentLatency = app + sf', v: cols.map((c) => `${f2(c.d.presentLatency)}ms`)},
    {k: 'pipelineDepth = ⌈latency / 周期⌉', v: cols.map((c) => `${c.d.depth}`)},
    {k: 'maxAcquired = depth − 1', v: cols.map((c) => `${c.d.maxAcquired}`)},
    {k: '+ maxDequeued（HWUI）', v: cols.map(() => `${maxDequeued}`)},
    {k: '总块数', strong: true, v: cols.map((c) => `${c.d.maxAcquired + maxDequeued}`)},
  ];

  const done = sec >= rowStart + rows.length * rowGap;
  const valW = Math.floor(620 / cols.length);

  return (
    <div style={{fontFamily: font, color: colors.fg}}>
      <div style={{display: 'flex', fontSize: 19, color: colors.muted, marginBottom: 10}}>
        <div style={{width: 400}} />
        {cols.map((c) => (
          <div key={c.p.id} style={{width: valW, textAlign: 'center'}}>
            {c.p.label}
          </div>
        ))}
      </div>

      {rows.map((r, i) => {
        const start = rowStart + i * rowGap;
        const o = clamp01((sec - start) / 0.4);
        const active = !done && sec >= start && sec < start + rowGap;
        return (
          <div
            key={r.k}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 72,
              opacity: o,
              borderRadius: 10,
              borderTop: `1px solid ${colors.border}`,
              background: active
                ? 'rgba(56,189,248,0.12)'
                : r.strong
                  ? 'rgba(255,255,255,0.04)'
                  : 'transparent',
            }}
          >
            <div
              style={{
                width: 400,
                paddingLeft: 12,
                fontSize: r.strong ? 26 : 21,
                fontWeight: r.strong ? 800 : 500,
                fontFamily: r.code ? mono : font,
              }}
            >
              {r.k}
            </div>
            {r.v.map((v, j) => (
              <div
                key={j}
                style={{
                  width: valW,
                  textAlign: 'center',
                  fontFamily: mono,
                  fontSize: r.strong ? 40 : 24,
                  fontWeight: r.strong ? 800 : 500,
                  color: r.strong ? (Number(v) > 3 ? colors.bad : colors.ok) : colors.fg,
                }}
              >
                {v}
              </div>
            ))}
          </div>
        );
      })}

      {cols.some((c) => c.p.note) && (
        <div style={{marginTop: 16, fontSize: 15, color: colors.muted}}>
          {cols
            .filter((c) => c.p.note)
            .map((c) => `${c.p.label}：${c.p.note}`)
            .join('；')}
        </div>
      )}
    </div>
  );
};
