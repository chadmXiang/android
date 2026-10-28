import React from 'react';
import type {FlowScript} from '../dsl/types';
import {dumpAt} from '../engine/state';
import {fmtSim} from '../engine/text';
import {colors, mono} from '../theme';

/**
 * dumpsys 视图：每个 section 一个终端面板，显示 t 时刻的快照。
 *   + 绿色  上一步之后新出现的行        ~ 黄色  上一步之后值变了（显示旧值 → 新值）
 *   − 红色  上一步之后消失的行          Δ      与启动前（时间窗起点）相比不同
 * 格式是示意：只保留关键字段，字段名对照各 dump 方法（RootWindowContainer / DisplayContent / ProcessList …）。
 */
export const DumpsysView: React.FC<{script: FlowScript; t: number; width: number; height: number; since?: number}> = ({script, t, width, height, since}) => {
  const snap = dumpAt(script, t);
  const from = since ?? script.window[0];
  const sections = [...snap.keys()];
  const cols = sections.length > 2 ? 2 : sections.length;
  const rowsN = Math.ceil(sections.length / Math.max(cols, 1));
  const gap = 14;
  const pw = (width - gap * (cols + 1)) / Math.max(cols, 1);
  const ph = (height - gap * (rowsN + 1) - 26) / Math.max(rowsN, 1);
  return (
    <div style={{position: 'relative', width, height}}>
      {sections.map((sec, i) => {
        const lines = snap.get(sec) ?? [];
        const x = gap + (i % cols) * (pw + gap);
        const y = gap + Math.floor(i / cols) * (ph + gap);
        const changed = lines.filter((l) => l.since > from && l.since <= t).length;
        return (
          <div
            key={sec}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: pw,
              height: ph,
              boxSizing: 'border-box',
              borderRadius: 12,
              border: `1.5px solid ${changed ? colors.info : colors.border}`,
              background: '#05080f',
              overflow: 'hidden',
              fontFamily: mono,
            }}
          >
            <div style={{padding: '8px 14px', background: '#0e1525', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 10}}>
              <span style={{color: colors.lime, fontSize: 14}}>$</span>
              <span style={{color: colors.fg, fontSize: 15, fontWeight: 700}}>{/^(getprop|ps |service |logcat|cat )/.test(sec) ? sec : `dumpsys ${sec}`}</span>
              <span style={{marginLeft: 'auto', fontSize: 12, color: changed ? colors.info : colors.muted}}>{changed ? `本步变化 ${changed} 行` : '本步无变化'}</span>
            </div>
            <div style={{padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 5}}>
              {lines.map((l) => {
                const fresh = l.since > from && l.since <= t;
                const removed = l.value === null;
                if (removed && !fresh) return null;
                if (removed && l.prev === null) return null;
                const added = fresh && !removed && l.prev === null;
                const mod = fresh && !removed && l.prev !== null;
                const col = removed ? colors.bad : added ? colors.ok : mod ? colors.warn : '#cbd5e1';
                const sign = removed ? '−' : added ? '+' : mod ? '~' : ' ';
                return (
                  <div
                    key={l.key}
                    style={{
                      display: 'flex',
                      gap: 8,
                      fontSize: 13.5,
                      lineHeight: 1.45,
                      padding: '1px 6px',
                      margin: '0 -6px',
                      borderRadius: 4,
                      background: fresh ? `${col}1f` : undefined,
                    }}
                  >
                    <span style={{color: col, width: 10, flexShrink: 0}}>{sign}</span>
                    <span style={{color: colors.muted, flexShrink: 0}}>{l.key}</span>
                    <span style={{color: col, textDecoration: removed ? 'line-through' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {mod && <span style={{color: colors.muted, textDecoration: 'line-through'}}>{l.prev}</span>}
                      {mod && ' → '}
                      {removed ? l.prev : l.value}
                    </span>
                    {l.changedFromBase && !removed && <span style={{marginLeft: 'auto', color: colors.info, fontSize: 11, flexShrink: 0}}>Δ</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: gap, bottom: 4, fontSize: 13, color: colors.muted, display: 'flex', gap: 18}}>
        <span>对比的是 {fmtSim(from, script.timeUnit)} → {fmtSim(t, script.timeUnit)} 之间的变化</span>
        <span style={{color: colors.ok}}>+ 新增</span>
        <span style={{color: colors.warn}}>~ 变化</span>
        <span style={{color: colors.bad}}>− 消失</span>
        <span style={{color: colors.info}}>Δ 与启动前不同</span>
        <span>（格式示意：只保留关键字段）</span>
      </div>
    </div>
  );
};
