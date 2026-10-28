import React from 'react';
import type {FlowScript} from '../dsl/types';
import {timersOf} from '../engine/state';
import {fmtSim} from '../engine/text';
import {colors, mono} from '../theme';

/** 超时倒计时面板：脚本里所有 timeout 的进度条 + 剩余时间 + 状态 */
export const TimerView: React.FC<{script: FlowScript; t: number}> = ({script, t}) => {
  const timers = timersOf(script, t);
  const unit = script.timeUnit;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
      <div style={{fontSize: 16, fontWeight: 700}}>超时倒计时</div>
      {timers.length === 0 && <div style={{fontSize: 13, color: colors.muted}}>（这个流程没有超时计时器）</div>}
      {timers.map((tm) => {
        const col =
          tm.status === 'cancelled' ? colors.ok : tm.status === 'fired' ? colors.bad : tm.status === 'idle' ? '#475569' : tm.progress > 0.75 ? colors.warn : colors.info;
        const text =
          tm.status === 'idle'
            ? '未启动'
            : tm.status === 'cancelled'
              ? `已取消（还剩 ${fmtSim(tm.remaining, unit)}）`
              : tm.status === 'fired'
                ? '已到期 → 超时处理'
                : `剩余 ${fmtSim(tm.remaining, unit)}`;
        return (
          <div key={tm.id} style={{display: 'flex', flexDirection: 'column', gap: 5}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
              <span style={{fontSize: 14, fontWeight: 700}}>{tm.label}</span>
              <span style={{marginLeft: 'auto', fontFamily: mono, fontSize: 13, color: col}}>{text}</span>
            </div>
            <div style={{height: 14, borderRadius: 7, background: '#1f2937', overflow: 'hidden', position: 'relative'}}>
              <div style={{width: `${tm.progress * 100}%`, height: '100%', background: col, borderRadius: 7}} />
            </div>
            <div style={{fontFamily: mono, fontSize: 11.5, color: colors.muted}}>
              启动 {fmtSim(tm.armedAt, unit)} · 期限 {fmtSim(tm.deadline - tm.armedAt, unit)} · 到期点 {fmtSim(tm.deadline, unit)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
