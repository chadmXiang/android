import React from 'react';
import {getComponent, getProcess} from '../catalog';
import type {ComponentDef, Rect} from '../catalog/types';
import {center, clipToRect, polylineMid, toPath, type Pt} from '../engine/geom';
import {clamp01, ease, fitText, textWidth} from '../engine/text';
import {colors, font, layerColors} from '../theme';

export interface MapEdge {
  from: string;
  to: string;
  label: string;
  color: string;
  /** 手工路由拐点（画布绝对坐标） */
  via?: [number, number][];
  labelAt?: [number, number];
  appearAt: number;
  desc?: string;
}

/** 连线编号：和字幕里的序号一一对应 */
export const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];
/** 按 catalog 里的进程坑位，把组件堆叠进进程框 */
export const layoutMap = (ids: string[]) => {
  const groups = new Map<string, ComponentDef[]>();
  ids.forEach((id) => {
    const c = getComponent(id);
    const g = groups.get(c.process) ?? [];
    g.push(c);
    groups.set(c.process, g);
  });

  const rects = new Map<string, Rect>();
  groups.forEach((list, pid) => {
    const b = getProcess(pid).box;
    const n = list.length;
    if (b.h < 160) {
      // 矮框横排
      const w = (b.w - 60 - 12 * (n - 1)) / n;
      list.forEach((c, i) => rects.set(c.id, {x: b.x + 30 + i * (w + 12), y: b.y + 46, w, h: b.h - 64}));
    } else {
      // 高框竖排
      const h = Math.min(64, (b.h - 60) / n - 12);
      list.forEach((c, i) => rects.set(c.id, {x: b.x + 30, y: b.y + 52 + i * (h + 12), w: b.w - 60, h}));
    }
  });
  return {groups, rects};
};

export const MapView: React.FC<{
  components: string[];
  edges: MapEdge[];
  sec: number;
  active?: number;
  width?: number;
  height?: number;
}> = ({components, edges, sec, active = -1, width = 1920, height = 860}) => {
  const {groups, rects} = layoutMap(components);
  const procIds = [...groups.keys()];
  const markerColors = [...new Set(edges.map((e) => e.color))];

  return (
    <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, fontFamily: font}}>
      <defs>
        {markerColors.map((c) => (
          <marker
            key={c}
            id={`map-${c.slice(1)}`}
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={c} />
          </marker>
        ))}
      </defs>

      {procIds.map((pid, i) => {
        const pr = getProcess(pid);
        const col = layerColors[pr.layer];
        const o = ease(clamp01((sec - i * 0.3) / 0.6));
        const b = pr.box;
        return (
          <g key={pid} opacity={o} transform={`translate(0, ${(1 - o) * 14})`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={16} fill="rgba(255,255,255,0.03)" stroke={col} strokeWidth={2} />
            <text x={b.x + 20} y={b.y + 32} fill={col} fontSize={21} fontWeight={700}>
              {pr.label}
            </text>
            {(groups.get(pid) ?? []).map((c) => {
              const r = rects.get(c.id);
              if (!r) return null;
              return (
                <g key={c.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={10} fill={colors.panel} stroke={colors.border} />
                  {(() => {
                    const base = Math.min(18, r.h * 0.6);
                    const tw = textWidth(c.label, base);
                    const fsz = tw > r.w - 28 ? Math.max(10, (base * (r.w - 28)) / tw) : base;
                    return (
                      <text x={r.x + 14} y={r.y + r.h / 2 + 1} dominantBaseline="middle" fontSize={fsz} fill={colors.fg}>
                        {fitText(c.label, r.w - 20, fsz)}
                      </text>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        );
      })}

      {edges.map((e, i) => {
        const fr = rects.get(e.from);
        const tr = rects.get(e.to);
        if (!fr || !tr) return null;
        const p = ease(clamp01((sec - e.appearAt) / 0.8));
        if (p <= 0) return null;

        const via: Pt[] = (e.via ?? []).map(([x, y]) => ({x, y}));
        const start = clipToRect(fr, via[0] ?? center(tr));
        const end = clipToRect(tr, via[via.length - 1] ?? center(fr));
        const pts = [start, ...via, end];
        const lab = e.labelAt ? {x: e.labelAt[0], y: e.labelAt[1]} : polylineMid(pts);
        const isActive = i === active;
        const num = NUM[i] ?? String(i + 1);
        // 只有当前这条显示完整文字，其余只留编号：连线多了之后不会糊成一团
        const lw = textWidth(e.label, 16) + 48;
        return (
          <g key={i} opacity={isActive || active < 0 ? 1 : 0.2}>
            <path
              d={toPath(pts)}
              fill="none"
              stroke={e.color}
              strokeWidth={isActive ? 4 : 2.2}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - p}
              markerEnd={p > 0.97 ? `url(#map-${e.color.slice(1)})` : undefined}
            />
            {p > 0.92 &&
              (isActive ? (
                <g opacity={clamp01((p - 0.92) / 0.08)}>
                  <rect x={lab.x - lw / 2} y={lab.y - 15} width={lw} height={30} rx={7} fill={colors.panel2} stroke={e.color} strokeWidth={1.6} />
                  <text x={lab.x - lw / 2 + 17} y={lab.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={17} fontWeight={800} fill={e.color}>
                    {num}
                  </text>
                  <text x={lab.x + 14} y={lab.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={16} fill={e.color}>
                    {e.label}
                  </text>
                </g>
              ) : (
                <g opacity={clamp01((p - 0.92) / 0.08)}>
                  <circle cx={lab.x} cy={lab.y} r={13} fill={colors.panel2} stroke={e.color} strokeWidth={1.6} />
                  <text x={lab.x} y={lab.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={800} fill={e.color}>
                    {num}
                  </text>
                </g>
              ))}
          </g>
        );
      })}
    </svg>
  );
};
