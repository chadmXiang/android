import React from 'react';
import {CLASS_RELATIONS, getClass} from '../catalog/classes';
import type {ClassKind, ClassMapDef, ClassOwner, ClassRelation, RelationKind} from '../catalog/types';
import {center, clipToRect, toPath, type Pt} from '../engine/geom';
import {clamp01, ease, fitText} from '../engine/text';
import {colors, font, mono} from '../theme';

export const OWNER_COLORS: Record<ClassOwner, string> = {
  app: '#3b82f6',
  atms: '#fb923c',
  wms: '#f59e0b',
  ams: '#facc15',
  pms: '#a78bfa',
  gfx: '#10b981',
  zygote: '#34d399',
  input: '#f472b6',
  view: '#22d3ee',
  ime: '#c084fc',
  init: '#a3e635',
};
export const OWNER_LABELS: Record<ClassOwner, string> = {
  app: '应用进程',
  atms: 'ATMS',
  wms: 'WMS',
  ams: 'AMS',
  pms: 'PMS',
  gfx: '图形',
  zygote: 'Zygote',
  input: '输入系统',
  view: 'View 树',
  ime: '输入法',
  init: 'init / native',
};
export const KIND_LABELS: Record<ClassKind, string> = {
  service: '系统服务',
  'binder-stub': 'binder 实现',
  container: '容器',
  record: '记录',
  controller: '控制器',
  helper: '辅助类',
  data: '数据',
  ui: '界面',
};

export const RELATION_STYLES: Record<
  RelationKind,
  {color: string; width: number; dash?: string; start?: 'diamond'; end?: 'arrow' | 'tri'; name: string}
> = {
  extends: {color: '#e5e7eb', width: 1.6, end: 'tri', name: '继承'},
  owns: {color: '#94a3b8', width: 1.6, start: 'diamond', end: 'arrow', name: '持有（组合）'},
  holds: {color: '#64748b', width: 1.4, end: 'arrow', name: '引用'},
  creates: {color: '#a3e635', width: 1.4, dash: '6 4', end: 'arrow', name: '创建'},
  binder: {color: '#60a5fa', width: 2.4, dash: '8 4', end: 'arrow', name: 'binder（跨进程）'},
  mirror: {color: '#e879f9', width: 2, dash: '2 4', name: '一一对应'},
  children: {color: '#f59e0b', width: 1.4, dash: '3 4', end: 'arrow', name: '运行时子节点'},
};

const CARD_H = 52;

export const mapRelations = (map: ClassMapDef): ClassRelation[] => {
  const ids = new Set(map.classes.map((c) => c.id));
  const hide = new Set(map.hide ?? []);
  return [...CLASS_RELATIONS, ...(map.extraRelations ?? [])].filter(
    (r) => ids.has(r.from) && ids.has(r.to) && !hide.has(`${r.from}>${r.to}`),
  );
};

/** A relation's identity follows its stable position in the unfiltered map order. */
export const relationKey = (relation: ClassRelation, index: number): string =>
  `${index}\u0000${relation.from}\u0000${relation.to}\u0000${relation.kind}\u0000${relation.label ?? ''}`;

/** Longest segment midpoint, used to keep the numbered badge on its edge. */
const longestMid = (pts: Pt[]): Pt => {
  let best = 0;
  let mid = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d > best) {
      best = d;
      mid = {x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2};
    }
  }
  return mid;
};

export const ClassMapView: React.FC<{
  map: ClassMapDef;
  visible: Set<string>;
  focus: Set<string>;
  /** Relation to emphasize; keys come from relationKey(). */
  activeRelationKey?: string;
  /** Keep all non-active relations dim, including conceptual summary steps. */
  dimInactiveRelations?: boolean;
  /** Optional subset of map relations that have already been introduced. */
  visibleRelationKeys?: Set<string>;
  /** 本镜头新出现的类：淡入 */
  fresh: Set<string>;
  local: number;
  frame: number;
  width: number;
  height: number;
}> = ({map, visible, visibleRelationKeys, focus, fresh, activeRelationKey, dimInactiveRelations = false, local, frame, width, height}) => {
  const pos = new Map(map.classes.map((c) => [c.id, {x: c.x, y: c.y, w: c.w ?? map.cardW, h: CARD_H}] as const));
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const opacityOf = (id: string) => (!visible.has(id) ? 0 : fresh.has(id) ? ease(clamp01(local / 0.6)) : 1);
  const isFocusEdge = (r: ClassRelation) => focus.size > 0 && focus.has(r.from) && focus.has(r.to);

  /** Route same-column relations through the narrow spine beside their cards. */
  const route = (r: ClassRelation): Pt[] => {
    const fr = pos.get(r.from)!;
    const tr = pos.get(r.to)!;
    const via = map.vias?.[`${r.from}>${r.to}`];
    if (via) {
      const vp = via.map(([x, y]) => ({x, y}));
      return [clipToRect(fr, vp[0]), ...vp, clipToRect(tr, vp[vp.length - 1])];
    }
    if (Math.abs(fr.x - tr.x) < 2) {
      if (Math.abs(fr.y - tr.y) <= fr.h + 60) {
        // 同列相邻：直接竖线
        const down = tr.y > fr.y;
        const x = fr.x + Math.min(fr.w, tr.w) / 2;
        return [
          {x, y: down ? fr.y + fr.h : fr.y},
          {x, y: down ? tr.y : tr.y + tr.h},
        ];
      }
      // 同列不相邻：走左侧脊线（多条同源关系会自然合成一棵树）
      const sx = fr.x - 10;
      return [
        {x: fr.x, y: fr.y + fr.h / 2},
        {x: sx, y: fr.y + fr.h / 2},
        {x: sx, y: tr.y + tr.h / 2},
        {x: tr.x, y: tr.y + tr.h / 2},
      ];
    }
    return [clipToRect(fr, center(tr)), clipToRect(tr, center(fr))];
  };

  const rels = mapRelations(map)
    .map((relation, index) => ({relation, number: index + 1, key: relationKey(relation, index)}))
    .filter(({relation, key}) => visible.has(relation.from) && visible.has(relation.to) && (!visibleRelationKeys || visibleRelationKeys.has(key)))
    .map((entry) => {
      const active = activeRelationKey !== undefined && entry.key === activeRelationKey;
      const highlighted = activeRelationKey !== undefined ? active : isFocusEdge(entry.relation);
      const endpointOpacity = Math.min(opacityOf(entry.relation.from), opacityOf(entry.relation.to));
      const dimmed = dimInactiveRelations || activeRelationKey !== undefined;
      const opacity = dimmed ? (active ? 1 : endpointOpacity * 0.22) : endpointOpacity * (focus.size === 0 || highlighted ? 1 : 0.4);
      const badgeOpacity = dimmed ? (active ? 1 : endpointOpacity * 0.22) : opacity;
      return {...entry, pts: route(entry.relation), active, highlighted, opacity, badgeOpacity};
    })
    .sort((a, b) => Number(a.highlighted) - Number(b.highlighted));

  const card = (id: string, expanded: boolean) => {
    const c = getClass(id);
    const p = pos.get(id)!;
    const col = OWNER_COLORS[c.owner];
    const h = CARD_H;
    return (
      <g key={`${id}-${expanded ? 'x' : 'n'}`} opacity={opacityOf(id)}>
        {expanded && (
          <rect x={p.x - 4} y={p.y - 4} width={p.w + 8} height={h + 8} rx={12} fill="none" stroke={colors.info} strokeWidth={2} opacity={0.4 + 0.6 * pulse} />
        )}
        <rect x={p.x} y={p.y} width={p.w} height={h} rx={9} fill={colors.panel2} stroke={expanded ? col : colors.border} strokeWidth={expanded ? 2 : 1.2} />
        <rect x={p.x} y={p.y} width={5} height={h} rx={2} fill={col} />
        <text x={p.x + 14} y={p.y + 21} fontSize={14} fontWeight={800} fontFamily={mono} fill={colors.fg}>
          {fitText(c.name, p.w - 22, 14)}
        </text>
        <text x={p.x + 14} y={p.y + 40} fontSize={11} fill={colors.muted}>
          {`${KIND_LABELS[c.kind]} · ${OWNER_LABELS[c.owner]}`}
        </text>
      </g>
    );
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block', fontFamily: font}}>
      <defs>
        {(Object.keys(RELATION_STYLES) as RelationKind[]).map((k) => {
          const st = RELATION_STYLES[k];
          return (
            <React.Fragment key={k}>
              {st.end === 'arrow' && (
                <marker id={`cm-${k}-end`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={8} markerHeight={8} orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10" fill="none" stroke={st.color} strokeWidth={1.6} />
                </marker>
              )}
              {st.end === 'tri' && (
                <marker id={`cm-${k}-end`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={11} markerHeight={11} orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={colors.panel2} stroke={st.color} strokeWidth={1.4} />
                </marker>
              )}
              {st.start === 'diamond' && (
                <marker id={`cm-${k}-start`} viewBox="0 0 12 8" refX={0} refY={4} markerWidth={12} markerHeight={8} orient="auto">
                  <path d="M0,4 L6,0 L12,4 L6,8 z" fill={st.color} />
                </marker>
              )}
            </React.Fragment>
          );
        })}
      </defs>

      {map.regions.map((r) => (
        <g key={r.label}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={14} fill="rgba(255,255,255,0.02)" stroke={r.color ?? colors.border} strokeDasharray="6 5" />
          <text x={r.x + 12} y={r.y + 16} fontSize={13} fontWeight={700} fill={r.color ?? colors.muted}>
            {r.label}
          </text>
        </g>
      ))}

      {rels.map(({relation: r, number, pts, highlighted, opacity}) => {
        const st = RELATION_STYLES[r.kind];
        return (
          <path
            key={`rel-${number}`}
            d={toPath(pts)}
            fill="none"
            opacity={opacity}
            stroke={st.color}
            strokeWidth={st.width + (highlighted ? 1.2 : 0)}
            strokeDasharray={st.dash}
            markerEnd={st.end ? `url(#cm-${r.kind}-end)` : undefined}
            markerStart={st.start ? `url(#cm-${r.kind}-start)` : undefined}
          />
        );
      })}

      {map.classes.filter((c) => !focus.has(c.id)).map((c) => card(c.id, false))}
      {map.classes.filter((c) => focus.has(c.id)).map((c) => card(c.id, true))}

      {/* Stable numbered badges replace line labels; relation meaning is shown in the caption. */}
      {rels.map(({relation: r, number, pts, active, badgeOpacity}) => {
        const st = RELATION_STYLES[r.kind];
        const m = longestMid(pts);
        const badgeW = number >= 10 ? 24 : 18;
        const x = Math.min(Math.max(m.x, badgeW / 2 + 2), width - badgeW / 2 - 2);
        return (
          <g key={`badge-${number}`} opacity={badgeOpacity}>
            <rect x={x - badgeW / 2} y={m.y - 9} width={badgeW} height={18} rx={9} fill={colors.panel2} stroke={st.color} strokeWidth={active ? 2 : 1} />
            <text x={x} y={m.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={800} fontFamily={mono} fill={st.color}>
              {number}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const RelationLegend: React.FC<{x: number; y: number}> = ({x, y}) => (
  <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 20, alignItems: 'center', fontSize: 15, color: colors.muted}}>
    {(Object.keys(RELATION_STYLES) as RelationKind[]).map((k) => {
      const st = RELATION_STYLES[k];
      return (
        <span key={k} style={{display: 'flex', alignItems: 'center', gap: 6}}>
          <svg width={34} height={12}>
            <line x1={2} x2={32} y1={6} y2={6} stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} />
            {st.start === 'diamond' && <path d="M0,6 L5,2 L10,6 L5,10 z" fill={st.color} />}
            {st.end === 'tri' && <path d="M24,1 L33,6 L24,11 z" fill={colors.panel2} stroke={st.color} />}
            {st.end === 'arrow' && <path d="M26,1 L33,6 L26,11" fill="none" stroke={st.color} strokeWidth={1.5} />}
          </svg>
          {st.name}
        </span>
      );
    })}
  </div>
);
