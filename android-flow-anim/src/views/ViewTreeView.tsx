import React from 'react';
import {getClass} from '../catalog/classes';
import type {FlowScript} from '../dsl/types';
import {fieldsAt, getInstance, instanceBornAt, instanceSpanAt, interactionsOf} from '../engine/instances';
import {eventsOf} from '../engine/state';
import {clamp01, ease} from '../engine/text';
import {colors, mono} from '../theme';
import {OWNER_COLORS} from './ClassMapView';

/**
 * View 树视图（应用布局内部）：
 *   左：按各 View 的 bounds 画出的界面框图，标出触摸点、按下 / 焦点、待重绘（DIRTY）/ 待重新布局（FORCE_LAYOUT）；
 *   右：View 树（由 mParent 字段推导，根是 ViewRootImpl），每行显示标志位和正在执行的方法；
 *       正在进行的调用画成箭头：向下（蓝）= 分发 / measure / layout / draw，向上（橙）= invalidate / requestLayout 冒泡。
 * 数据全部来自脚本：实例的初始字段 bounds / mParent，set 事件改标志位，invoke 事件是调用。
 */

export interface ViewTreeConfig {
  /** 参与的实例（自上而下的树顺序），第一个是根（通常是 ViewRootImpl） */
  views: string[];
  /** 屏幕坐标系尺寸（bounds 的单位） */
  screen: {w: number; h: number};
  /** 触摸点：[at, until) 期间显示 */
  touches?: {x: number; y: number; at: number; until: number; label: string}[];
}

const FLAG_CHIPS: {field: string; on: string; label: string; color: string}[] = [
  {field: 'isPressed()', on: 'true', label: 'PRESSED', color: '#3b82f6'},
  {field: 'isFocused()', on: 'true', label: 'FOCUSED', color: '#fbbf24'},
  {field: 'PFLAG_FORCE_LAYOUT', on: 'true', label: 'FORCE_LAYOUT', color: '#e879f9'},
  {field: 'PFLAG_DIRTY', on: 'true', label: 'DIRTY', color: '#fb923c'},
];

const parseBounds = (v?: string | null) => {
  if (!v) return undefined;
  const n = v.split(',').map((x) => Number(x.trim()));
  return n.length === 4 && n.every((x) => !Number.isNaN(x)) ? {l: n[0], t: n[1], r: n[2], b: n[3]} : undefined;
};

export const ViewTreeView: React.FC<{script: FlowScript; t: number; width: number; height: number; frame: number; config?: ViewTreeConfig}> = ({
  script,
  t,
  width,
  height,
  frame,
  config,
}) => {
  if (!config) return <div style={{color: colors.bad}}>view-tree 槽位需要 options.viewTree</div>;
  const ids = config.views.filter((id) => getInstance(script, id));
  const breathe = 0.5 + 0.5 * Math.sin(frame / 6);
  const fv = (id: string) => fieldsAt(script, id, t);
  const depth = new Map<string, number>();
  ids.forEach((id) => {
    const p = fv(id).get('mParent')?.value;
    depth.set(id, p && depth.has(p) ? (depth.get(p) as number) + 1 : 0);
  });

  // —— 左：界面框图 ——
  const phoneH = height - 40;
  const phoneW = (phoneH * config.screen.w) / config.screen.h;
  const sx = phoneW / config.screen.w;
  const px0 = 20;
  const py0 = 20;
  const touch = (config.touches ?? []).find((p) => t >= p.at && t < p.until);

  // —— 右：树 ——
  const treeX = px0 + phoneW + 40;
  const treeW = width - treeX - 16;
  const rowH = Math.min(90, (height - 200) / Math.max(ids.length, 1));
  const rowY = (i: number) => 48 + i * rowH;
  const vri = ids[0];
  const vriSpan = instanceSpanAt(script, vri, t);

  const calls = interactionsOf(script).filter(
    (c) => (c.kind === 'invoke' || c.kind === 'call') && ids.includes(c.from) && ids.includes(c.to) && c.at <= t && t < c.end && c.from !== c.to,
  );
  const upKinds = /invalidate|requestLayout|onDescendantInvalidated|invalidateChild/;

  return (
    <div style={{position: 'relative', width, height}}>
      {/* 界面框图 */}
      <svg width={px0 + phoneW + 20} height={height} style={{position: 'absolute', left: 0, top: 0}}>
        <rect x={px0 - 6} y={py0 - 6} width={phoneW + 12} height={phoneH + 12} rx={18} fill="#0b1020" stroke="#334155" strokeWidth={2} />
        {ids.slice(1).map((id) => {
          const b = parseBounds(fv(id).get('bounds')?.value);
          if (!b || t < instanceBornAt(script, id)) return null;
          const f = fv(id);
          const pressed = f.get('isPressed()')?.value === 'true';
          const focused = f.get('isFocused()')?.value === 'true';
          const dirty = f.get('PFLAG_DIRTY')?.value === 'true';
          const relayout = f.get('PFLAG_FORCE_LAYOUT')?.value === 'true';
          const cls = getClass(getInstance(script, id)!.cls);
          const isLeaf = !ids.some((x) => fv(x).get('mParent')?.value === id);
          const x = px0 + b.l * sx;
          const y = py0 + b.t * sx;
          const w = (b.r - b.l) * sx;
          const h = (b.b - b.t) * sx;
          const text = f.get('mText')?.value;
          return (
            <g key={id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={isLeaf ? 8 : 2}
                fill={isLeaf ? (pressed ? '#1d4ed8' : cls.id === 'edit-text' ? 'rgba(255,255,255,0.06)' : '#3b82f6') : 'transparent'}
                stroke={relayout ? '#e879f9' : dirty ? '#fb923c' : isLeaf ? 'none' : '#334155'}
                strokeWidth={relayout || dirty ? 2.5 : 1}
                strokeDasharray={relayout || dirty ? '6 4' : isLeaf ? undefined : '3 4'}
              />
              {focused && <rect x={x - 5} y={y - 5} width={w + 10} height={h + 10} rx={10} fill="none" stroke="#fbbf24" strokeWidth={3} opacity={0.6 + 0.4 * breathe} />}
              {isLeaf && (
                <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(16, h * 0.4)} fontWeight={700} fill="#fff">
                  {text ?? cls.name}
                </text>
              )}
              {!isLeaf && (
                <text x={x + 4} y={y + 12} fontSize={10} fill="#64748b">
                  {cls.name}
                </text>
              )}
            </g>
          );
        })}
        {touch && (
          <g>
            <circle cx={px0 + touch.x * sx} cy={py0 + touch.y * sx} r={16 + 4 * breathe} fill="rgba(244,114,182,0.25)" stroke="#f472b6" strokeWidth={2} />
            <circle cx={px0 + touch.x * sx} cy={py0 + touch.y * sx} r={4} fill="#f472b6" />
            <text x={px0 + touch.x * sx} y={py0 + touch.y * sx - 26} textAnchor="middle" fontSize={12} fontWeight={700} fill="#f472b6">
              {touch.label}
            </text>
          </g>
        )}
      </svg>

      {/* View 树 */}
      <div style={{position: 'absolute', left: treeX, top: 10, fontSize: 15, fontWeight: 700, color: colors.muted}}>
        View 树（mParent 链 → ViewRootImpl）
        {vriSpan && <span style={{marginLeft: 12, color: colors.info, fontWeight: 600}}>▶ {vriSpan.label}</span>}
      </div>
      {ids.map((id, i) => {
        const inst = getInstance(script, id)!;
        const cls = getClass(inst.cls);
        const f = fv(id);
        const sp = instanceSpanAt(script, id, t);
        const alive = t >= instanceBornAt(script, id);
        const d = depth.get(id) ?? 0;
        const target = f.get('mFirstTouchTarget')?.value;
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: treeX + 60 + d * 26,
              top: rowY(i),
              width: treeW - 70 - d * 26,
              height: rowH - 10,
              boxSizing: 'border-box',
              padding: '6px 12px',
              borderRadius: 10,
              border: `1.5px solid ${sp ? colors.info : colors.border}`,
              borderLeft: `5px solid ${OWNER_COLORS[cls.owner]}`,
              background: sp ? 'rgba(56,189,248,0.10)' : colors.panel2,
              opacity: alive ? 1 : 0.35,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 4,
              overflow: 'hidden',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
              <span style={{fontFamily: mono, fontSize: 14, fontWeight: 800}}>{cls.name}</span>
              {inst.label && <span style={{fontSize: 11, color: colors.muted}}>{inst.label}</span>}
              {FLAG_CHIPS.filter((c) => f.get(c.field)?.value === c.on).map((c) => (
                <span key={c.label} style={{fontFamily: mono, fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: `${c.color}33`, color: c.color}}>
                  {c.label}
                </span>
              ))}
              {target && target !== 'null' && (
                <span style={{fontFamily: mono, fontSize: 10.5, color: colors.lime}}>mFirstTouchTarget → {getInstance(script, target) ? getClass(getInstance(script, target)!.cls).name : target}</span>
              )}
              {f.get('mFocused')?.value && (
                <span style={{fontFamily: mono, fontSize: 10.5, color: '#fbbf24'}}>mFocused → {getClass(getInstance(script, f.get('mFocused')!.value as string)!.cls).name}</span>
              )}
            </div>
            <div style={{fontSize: 12, color: sp ? colors.info : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {sp ? `▶ ${sp.label}` : f.get('bounds')?.value ? `bounds [${f.get('bounds')?.value}]` : cls.file.split('/').pop()}
            </div>
          </div>
        );
      })}

      {/* 调用箭头：左侧竖向，向下蓝、向上橙 */}
      <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        {calls.map((c, k) => {
          const a = ids.indexOf(c.from);
          const b = ids.indexOf(c.to);
          const up = upKinds.test(c.label) || b < a;
          const x = treeX + 44 - (k % 3) * 14;
          const y1 = rowY(a) + rowH / 2 - 5;
          const y2 = rowY(b) + rowH / 2 - 5;
          const p = ease(clamp01((t - c.at) / 0.8));
          const ye = y1 + (y2 - y1) * p;
          const col = up ? colors.orange : colors.info;
          return (
            <g key={k}>
              <line x1={x} x2={x} y1={y1} y2={ye} stroke={col} strokeWidth={3} />
              <line x1={x} x2={treeX + 58} y1={y1} y2={y1} stroke={col} strokeWidth={1.5} />
              <path d={`M${x - 6},${ye - (up ? -8 : 8)} L${x},${ye} L${x + 6},${ye - (up ? -8 : 8)}`} fill="none" stroke={col} strokeWidth={2.5} />
            </g>
          );
        })}
      </svg>
      {/* 正在进行的调用（外层在上） */}
      <div style={{position: 'absolute', left: treeX, top: rowY(ids.length) + 4, width: treeW, display: 'flex', flexDirection: 'column', gap: 4}}>
        <div style={{fontSize: 13, color: colors.muted}}>正在进行的调用（↓ 向下分发 / 遍历 · ↑ 向上冒泡）</div>
        {calls.slice(-5).map((c, k) => {
          const up = upKinds.test(c.label) || ids.indexOf(c.to) < ids.indexOf(c.from);
          const name = (id: string) => getClass(getInstance(script, id)!.cls).name;
          return (
            <div key={k} style={{fontFamily: mono, fontSize: 12.5, color: up ? colors.orange : colors.info, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {up ? '↑' : '↓'} {name(c.from)} → {name(c.to)} · {c.label}
            </div>
          );
        })}
        {calls.length === 0 && <div style={{fontSize: 12.5, color: '#475569'}}>（View 树此刻没有进行中的调用）</div>}
      </div>
      {/* 当前事件 */}
      {(() => {
        const ev = eventsOf(script, 'input').filter((e) => e.at <= t).pop();
        return ev ? (
          <div style={{position: 'absolute', left: px0, bottom: 4, fontSize: 12.5, color: colors.pink, fontFamily: mono}}>最近输入：{ev.label}</div>
        ) : null;
      })()}
    </div>
  );
};
