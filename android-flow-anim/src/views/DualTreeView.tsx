import React from 'react';
import type {FlowScript} from '../dsl/types';
import {treeAt, treeChangeAt, type TreeNode} from '../engine/state';
import {clamp01, ease, textWidth} from '../engine/text';
import {colors, font, layerColors} from '../theme';

const ROW = 48;
const BOX_H = 34;
const INDENT = 26;
const FS = 14;
const TREE_ANIM_MS = 1.5;
const TREE_COLORS = [layerColors.system_server, layerColors.native];

const boxW = (n: TreeNode) => textWidth(n.label, FS) + 26;

type Layout = {pos: Map<string, {x: number; y: number}>; floatY: number | null};

const layoutTree = (nodes: Map<string, TreeNode>, rootId: string, x0: number, y0: number): Layout => {
  const pos = new Map<string, {x: number; y: number}>();
  const kids = (pid: string) =>
    [...nodes.values()].filter((n) => n.parent === pid).sort((a, b) => a.order - b.order);
  let row = 0;
  const walk = (id: string, depth: number) => {
    pos.set(id, {x: x0 + depth * INDENT, y: y0 + row * ROW});
    row++;
    kids(id).forEach((c) => walk(c.id, depth + 1));
  };
  if (nodes.has(rootId)) walk(rootId, 0);
  const floating = [...nodes.values()]
    .filter((n) => n.id !== rootId && (n.parent === null || !nodes.has(n.parent)))
    .sort((a, b) => a.order - b.order);
  let floatY: number | null = null;
  if (floating.length) {
    row += 0.7;
    floatY = y0 + row * ROW - 10;
    row += 0.3;
    floating.forEach((f) => walk(f.id, 1));
  }
  return {pos, floatY};
};

const NodeBox: React.FC<{n: TreeNode; x: number; y: number; col: string; hl: boolean; pulse: number; opacity: number}> = ({
  n,
  x,
  y,
  col,
  hl,
  pulse,
  opacity,
}) => {
  const w = boxW(n);
  const isBuf = n.kind === 'buffer';
  const isLeash = n.kind === 'leash';
  const isRoot = n.kind === 'root';
  const fill = isBuf ? colors.orange : isLeash ? 'rgba(232,121,249,0.15)' : colors.panel2;
  const stroke = hl ? '#fff' : isBuf ? colors.orange : isLeash ? colors.pink : isRoot ? colors.muted : col;
  return (
    <g opacity={opacity}>
      {hl && (
        <rect x={x - 4} y={y - 4} width={w + 8} height={BOX_H + 8} rx={10} fill="none" stroke={colors.info} strokeWidth={2} opacity={0.4 + 0.6 * pulse} />
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={BOX_H}
        rx={7}
        fill={fill}
        stroke={stroke}
        strokeWidth={hl ? 2.2 : 1.5}
        strokeDasharray={isLeash || isRoot ? '5 4' : undefined}
      />
      <text x={x + 13} y={y + BOX_H / 2 + 1} fontSize={FS} dominantBaseline="middle" fill={isBuf ? '#111' : isRoot ? colors.muted : colors.fg}>
        {n.label}
      </text>
      {n.note && (
        <g>
          <rect x={x + w + 10} y={y + 4} width={textWidth(n.note, 12) + 16} height={BOX_H - 8} rx={(BOX_H - 8) / 2} fill={colors.pink} />
          <text x={x + w + 18} y={y + BOX_H / 2 + 1} fontSize={12} fill="#111" dominantBaseline="middle">
            {n.note}
          </text>
        </g>
      )}
    </g>
  );
};

export const DualTreeView: React.FC<{script: FlowScript; t: number; width: number; height: number; frame: number}> = ({
  script,
  t,
  width,
  height,
  frame,
}) => {
  const trees = (script.trees ?? []).slice(0, 2);
  const {lastAt, changed} = treeChangeAt(script, t);
  const p = ease(clamp01((t - lastAt) / TREE_ANIM_MS));
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const colX = [28, width / 2 + 8];
  const y0 = 70;

  const data = trees.map((tr, ti) => {
    const cur = treeAt(script, tr.id, t);
    const prev = treeAt(script, tr.id, lastAt - 1e-6);
    const lc = layoutTree(cur, tr.root, colX[ti], y0);
    const lp = layoutTree(prev, tr.root, colX[ti], y0);
    const at = (id: string) => {
      const c = lc.pos.get(id);
      const q = lp.pos.get(id);
      if (c && q) return {x: q.x + (c.x - q.x) * p, y: q.y + (c.y - q.y) * p};
      return c ?? q;
    };
    return {tr, ti, cur, prev, lc, at};
  });

  return (
    <svg width={width} height={height} style={{display: 'block', fontFamily: font}}>
      {/* 两棵树之间的一一对应 */}
      {data.length === 2 &&
        [...data[0].cur.values()]
          .filter((n) => n.mapTo && data[1].cur.has(n.mapTo))
          .map((n) => {
            const a = data[0].at(n.id);
            const b = data[1].at(n.mapTo as string);
            if (!a || !b) return null;
            const x1 = a.x + boxW(n) + 4;
            const y1 = a.y + BOX_H / 2;
            const x2 = b.x - 4;
            const y2 = b.y + BOX_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path key={`m-${n.id}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#64748b" strokeOpacity={0.55} strokeDasharray="4 5" />
            );
          })}

      {data.map(({tr, ti, cur, prev, lc, at}) => {
        const col = TREE_COLORS[ti];
        return (
          <g key={tr.id}>
            <text x={colX[ti]} y={36} fontSize={20} fontWeight={700} fill={col}>
              {tr.title}
            </text>

            {lc.floatY !== null && (
              <g>
                <line x1={colX[ti]} x2={colX[ti] + width / 2 - 60} y1={lc.floatY} y2={lc.floatY} stroke={colors.border} strokeDasharray="6 6" />
                <text x={colX[ti]} y={lc.floatY - 8} fontSize={13} fill={colors.warn}>
                  未挂到树上（NOT_ADD_TO_ROOT）
                </text>
              </g>
            )}

            {[...cur.values()]
              .filter((n) => n.parent && cur.has(n.parent))
              .map((n) => {
                const a = at(n.parent as string);
                const b = at(n.id);
                if (!a || !b) return null;
                return (
                  <path
                    key={`c-${n.id}`}
                    d={`M${a.x + 12},${a.y + BOX_H} L${a.x + 12},${b.y + BOX_H / 2} L${b.x},${b.y + BOX_H / 2}`}
                    fill="none"
                    stroke={n.kind === 'leash' || cur.get(n.parent as string)?.kind === 'leash' ? colors.pink : '#475569'}
                    strokeWidth={1.5}
                  />
                );
              })}

            {[...cur.values()].map((n) => {
              const q = at(n.id);
              if (!q) return null;
              return (
                <NodeBox key={n.id} n={n} x={q.x} y={q.y} col={col} hl={changed.has(n.id)} pulse={pulse} opacity={prev.has(n.id) ? 1 : p} />
              );
            })}

            {[...prev.values()]
              .filter((n) => !cur.has(n.id))
              .map((n) => {
                const q = at(n.id);
                if (!q) return null;
                return <NodeBox key={`gone-${n.id}`} n={n} x={q.x} y={q.y} col={col} hl={false} pulse={pulse} opacity={1 - p} />;
              })}
          </g>
        );
      })}
    </svg>
  );
};
