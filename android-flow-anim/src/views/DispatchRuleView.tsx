import React from 'react';
import type {FlowScript} from '../dsl/types';
import {fmtSim} from '../engine/text';
import {colors, mono} from '../theme';

/**
 * 分发标准视图：InputDispatcher 怎么决定"这个事件发给哪个窗口"。
 *   touch：按 Z 序从前到后逐个窗口做 windowAcceptsTouchAt 判定，第一个全部通过的窗口成为 DOWN 的目标；
 *   key：不看坐标，只看 FocusResolver 判定的焦点窗口；前后各有一次策略拦截。
 * 判定条件逐行出现（at + i × step），和脚本里的命中检测 / 焦点判定时刻对齐。
 */

export interface TouchRule {
  at: number;
  step: number;
  point: string;
  columns: string[];
  windows: {name: string; checks: (boolean | null)[]; hit?: boolean; note?: string}[];
  note: string;
}
export interface KeyRule {
  at: number;
  step: number;
  rows: {label: string; pass: boolean; detail?: string}[];
  result: string;
  note: string;
}
export interface DispatchRuleConfig {
  touch?: TouchRule;
  key?: KeyRule;
}

const Mark: React.FC<{v: boolean | null; shown: boolean}> = ({v, shown}) => (
  <span style={{fontFamily: mono, fontSize: 16, fontWeight: 800, color: !shown ? '#334155' : v === null ? '#475569' : v ? colors.ok : colors.bad}}>
    {!shown ? '·' : v === null ? '—' : v ? '✓' : '✗'}
  </span>
);

export const DispatchRuleView: React.FC<{script: FlowScript; t: number; width: number; height: number; config?: DispatchRuleConfig}> = ({
  script,
  t,
  width,
  height,
  config,
}) => {
  if (!config) return <div style={{color: colors.bad}}>dispatch-rules 槽位需要 options.dispatchRules</div>;
  const {touch, key} = config;
  const unit = script.timeUnit;
  // 当前更相关的一边高亮：t 更接近哪一边的判定时刻
  const activeTouch = !!touch && (!key || t < key.at - 1);
  // touch 表格列多，给它多一点宽度
  const touchW = (width - 42) * 0.57;
  const keyW = width - 42 - touchW;
  const panel = (active: boolean, w: number): React.CSSProperties => ({
    position: 'absolute',
    top: 14,
    width: w,
    height: height - 28,
    boxSizing: 'border-box',
    padding: 18,
    borderRadius: 14,
    border: `2px solid ${active ? colors.info : colors.border}`,
    background: active ? 'rgba(56,189,248,0.06)' : colors.panel2,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    opacity: active ? 1 : 0.75,
  });

  return (
    <div style={{position: 'relative', width, height}}>
      {touch && (
        <div style={{...panel(activeTouch, touchW), left: 14}}>
          <div style={{fontSize: 20, fontWeight: 800}}>touch：发给哪个窗口？</div>
          <div style={{fontSize: 13.5, color: colors.muted, lineHeight: 1.5}}>
            ACTION_DOWN 在 {touch.point}：DispatcherWindowInfo.findTouchedWindowAt 按 Z 序<b style={{color: colors.fg}}>从前到后</b>遍历，
            第一个 windowAcceptsTouchAt 全部通过的窗口就是目标（判定时刻 {fmtSim(touch.at, unit)}）
          </div>
          <div style={{display: 'grid', gridTemplateColumns: `minmax(0, 1.7fr) repeat(${touch.columns.length}, minmax(0, 0.8fr)) minmax(0, 0.7fr)`, gap: '8px 4px', alignItems: 'center', fontSize: 12.5}}>
            <span style={{color: colors.muted}}>窗口（前 → 后）</span>
            {touch.columns.map((c) => (
              <span key={c} style={{color: colors.muted, textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-line', fontSize: 11.5}}>
                {c}
              </span>
            ))}
            <span style={{color: colors.muted, textAlign: 'center'}}>结果</span>
            {touch.windows.map((w, i) => {
              const shown = t >= touch.at + i * touch.step;
              const reached = touch.windows.slice(0, i).every((x) => !x.hit);
              return (
                <React.Fragment key={w.name}>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      wordBreak: 'break-all',
                      fontWeight: w.hit && shown ? 800 : 500,
                      color: !reached ? '#475569' : w.hit && shown ? colors.ok : colors.fg,
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: w.hit && shown ? 'rgba(34,197,94,0.15)' : undefined,
                    }}
                  >
                    {i + 1}. {w.name}
                    {w.note && <div style={{fontSize: 11, color: colors.muted, fontWeight: 400}}>{w.note}</div>}
                  </span>
                  {w.checks.map((c, ci) => (
                    <span key={ci} style={{textAlign: 'center'}}>
                      <Mark v={reached ? c : null} shown={shown} />
                    </span>
                  ))}
                  <span style={{textAlign: 'center', fontSize: 13, fontWeight: 700, color: !shown || !reached ? '#475569' : w.hit ? colors.ok : colors.bad}}>
                    {!reached ? '不再检查' : !shown ? '' : w.hit ? '命中' : '跳过'}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{marginTop: 'auto', fontSize: 13.5, lineHeight: 1.6, color: '#cbd5e1', whiteSpace: 'pre-line', borderTop: `1px solid ${colors.border}`, paddingTop: 10}}>
            {touch.note}
          </div>
        </div>
      )}
      {key && (
        <div style={{...panel(!activeTouch, keyW), left: 28 + touchW}}>
          <div style={{fontSize: 20, fontWeight: 800}}>key：发给哪个窗口？</div>
          <div style={{fontSize: 13.5, color: colors.muted, lineHeight: 1.5}}>
            按键<b style={{color: colors.fg}}>不看坐标</b>：先过两次策略拦截，再发给 FocusResolver 记录的焦点窗口（判定时刻 {fmtSim(key.at, unit)}）
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {key.rows.map((r, i) => {
              const shown = t >= key.at + i * key.step;
              return (
                <div
                  key={r.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${shown ? (r.pass ? colors.ok : colors.bad) : colors.border}`,
                    background: shown ? (r.pass ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : undefined,
                    opacity: shown ? 1 : 0.4,
                  }}
                >
                  <Mark v={r.pass} shown={shown} />
                  <div style={{display: 'flex', flexDirection: 'column'}}>
                    <span style={{fontSize: 14, fontWeight: 700}}>{r.label}</span>
                    {r.detail && <span style={{fontFamily: mono, fontSize: 12, color: colors.muted}}>{r.detail}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: t >= key.at + key.rows.length * key.step ? colors.ok : '#475569',
              fontFamily: mono,
            }}
          >
            → {key.result}
          </div>
          <div style={{marginTop: 'auto', fontSize: 13.5, lineHeight: 1.6, color: '#cbd5e1', whiteSpace: 'pre-line', borderTop: `1px solid ${colors.border}`, paddingTop: 10}}>
            {key.note}
          </div>
        </div>
      )}
    </div>
  );
};
