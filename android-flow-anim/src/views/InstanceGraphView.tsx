import React from 'react';
import {fieldsOf, getClass} from '../catalog/classes';
import type {Rect} from '../catalog/types';
import type {FlowScript, InstanceDef} from '../dsl/types';
import type {Pt} from '../engine/geom';
import {
  fieldNamesOf,
  fieldsAt,
  getInstance,
  instanceBornAt,
  instanceMarkerAt,
  instancesOf,
  instanceSpanAt,
  interactionsOf,
  type Interaction,
} from '../engine/instances';
import {eventsOf, objectStateAt} from '../engine/state';
import {clamp01, ease, textWidth} from '../engine/text';
import {colors, layerColors, mono, stateColors} from '../theme';
import {OWNER_COLORS, OWNER_LABELS, RELATION_STYLES} from './ClassMapView';
import {ARROW_STYLES} from './SwimlaneView';

/**
 * 对象协作图：每张卡片是一个实例，卡片里是它的字段当前值和正在执行的方法；
 * 实例按 进程 →（system_server 再按 owner）自动分列，不需要手写坐标。
 */

const PAD = 14;
const GAP_X = 40;
const GAP_Y = 14;
const REGION_HEAD = 30;
const COL_HEAD = 22;
const CARD_HEAD = 40;
const STATUS_H = 22;
const ROW_H = 18;

export interface GraphLayout {
  cards: Map<string, Rect & {col: number}>;
  regions: {process: string; label: string; color: string; rect: Rect}[];
  columns: {label?: string; color: string; x: number; w: number}[];
  rows: number;
}

/** 卡片里要显示的字段行：脚本里出现过的字段在前，其余是类目录里的静态成员 */
export const cardFieldRows = (script: FlowScript, id: string, max: number): {name: string; type?: string; dynamic: boolean}[] => {
  const inst = getInstance(script, id);
  if (!inst) return [];
  const dyn = fieldNamesOf(script, id);
  const rows: {name: string; type?: string; dynamic: boolean}[] = dyn.map((name) => ({
    name,
    type: fieldsOf(inst.cls).find((f) => f.name === name)?.type,
    dynamic: true,
  }));
  fieldsOf(inst.cls)
    .filter((f) => !dyn.includes(f.name))
    .forEach((f) => rows.push({name: f.name, type: f.type, dynamic: false}));
  return rows.slice(0, Math.max(0, max));
};

const EXT = '__ext';

/**
 * 按进程（或给定实例集合）过滤：only 里的实例正常显示，和它们有调用 / 引用往来的"其他进程"实例
 * 收进最右侧一列，方便看到跨进程的边界。不传 only 则显示全部。
 */
export const graphInstances = (script: FlowScript, only?: string[]): InstanceDef[] => {
  const all = instancesOf(script);
  if (!only) return all;
  const inSet = new Set(only);
  const procOf = new Map(all.map((i): [string, string] => [i.id, i.process]));
  const inProcs = new Set(only.map((id) => procOf.get(id)));
  // 只收"跨进程"的往来对象：同进程里没选中的对象不进这一列，避免把整个进程又画一遍
  const ext = new Set<string>();
  const addExt = (id: string) => {
    if (!inSet.has(id) && procOf.has(id) && !inProcs.has(procOf.get(id))) ext.add(id);
  };
  interactionsOf(script).forEach((c) => {
    if (inSet.has(c.from)) addExt(c.to);
    if (inSet.has(c.to)) addExt(c.from);
  });
  all.forEach((i) => {
    if (!inSet.has(i.id)) return;
    fieldsAt(script, i.id, Infinity).forEach((v) => v.value && addExt(v.value));
  });
  // 反向引用：其他进程的对象字段指向本集合（如 ProcessRecord.mThread → ApplicationThread）
  all.forEach((i) => {
    if (inSet.has(i.id)) return;
    fieldsAt(script, i.id, Infinity).forEach((v) => v.value && inSet.has(v.value) && addExt(i.id));
  });
  return [
    ...all.filter((i) => inSet.has(i.id)),
    ...all.filter((i) => ext.has(i.id)).map((i) => ({...i, process: EXT, group: '其他进程'})),
  ];
};

export const layoutGraph = (script: FlowScript, width: number, height: number, shown?: InstanceDef[]): GraphLayout => {
  const insts = shown ?? instancesOf(script);
  const procOrder = [...(script.processes ?? []).map((p) => p.id), EXT].filter((p) => insts.some((i) => i.process === p));
  // 一个进程内：写了 group 就按 group 拆列；否则有多个 owner（ATMS / WMS / AMS / PMS）时按 owner 拆列
  const colKeys: {key: string; process: string; owner?: string; group?: string}[] = [];
  const groupOf = (i: (typeof insts)[number]) => i.group ?? getClass(i.cls).owner;
  procOrder.forEach((p) => {
    const inP = insts.filter((i) => i.process === p);
    if (inP.some((i) => i.group)) {
      [...new Set(inP.map(groupOf))].forEach((g) => colKeys.push({key: `${p}|${g}`, process: p, group: g}));
      return;
    }
    const owners = [...new Set(inP.map((i) => getClass(i.cls).owner))];
    if (owners.length > 1) owners.forEach((o) => colKeys.push({key: `${p}|${o}`, process: p, owner: o}));
    else colKeys.push({key: p, process: p});
  });
  const colOf = (id: string) => {
    const i = insts.find((x) => x.id === id)!;
    return colKeys.findIndex(
      (c) => c.process === i.process && (c.group ? c.group === groupOf(i) : !c.owner || c.owner === getClass(i.cls).owner),
    );
  };

  const n = Math.max(colKeys.length, 1);
  const counts = colKeys.map((_, ci) => insts.filter((i) => colOf(i.id) === ci).length);
  // 只有一张卡片的列（Launcher、PMS）收窄，把宽度让给类名更长的列
  const weights = counts.map((c) => (c > 1 ? 1 : 0.72));
  const unit = (width - PAD * 2 - GAP_X * (n - 1)) / weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  weights.reduce((x, w, i) => {
    colX[i] = x;
    return x + w * unit + GAP_X;
  }, PAD);
  const colW = (ci: number) => weights[ci] * unit;
  const maxCount = Math.max(1, ...counts);
  const top = PAD + REGION_HEAD + (colKeys.some((c) => c.owner || c.group) ? COL_HEAD : 0);
  const cardH = Math.min(170, (height - top - PAD - GAP_Y * (maxCount - 1)) / maxCount);
  const rows = Math.floor((cardH - CARD_HEAD - STATUS_H - 8) / ROW_H);

  const cards = new Map<string, Rect & {col: number}>();
  const fill = new Array(n).fill(0);
  insts.forEach((i) => {
    const c = colOf(i.id);
    const k = fill[c]++;
    cards.set(i.id, {x: colX[c], y: top + k * (cardH + GAP_Y), w: colW(c), h: cardH, col: c});
  });

  const columns = colKeys.map((c, ci) => ({
    label: c.group ?? (c.owner ? OWNER_LABELS[c.owner as keyof typeof OWNER_LABELS] : undefined),
    color: c.owner ? OWNER_COLORS[c.owner as keyof typeof OWNER_COLORS] : colors.muted,
    x: colX[ci],
    w: colW(ci),
  }));

  const regions = procOrder.map((p) => {
    const cis = colKeys.map((c, ci) => (c.process === p ? ci : -1)).filter((x) => x >= 0);
    const last = cis[cis.length - 1];
    const x0 = colX[cis[0]] - 10;
    const x1 = colX[last] + colW(last) + 10;
    const proc = script.processes!.find((x) => x.id === p);
    return {
      process: p,
      label: proc ? proc.label : '其他进程（交互对象）',
      color: proc ? layerColors[proc.layer] : colors.muted,
      rect: {x: x0, y: 4, w: x1 - x0, h: height - 8},
    };
  });

  return {cards, regions, columns, rows};
};

// —— 三次贝塞尔：按进度截取，保证虚线样式在"画出"过程中也正确 ——
type Bez = [Pt, Pt, Pt, Pt];
const lerp = (a: Pt, b: Pt, k: number): Pt => ({x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k});
const splitBez = ([p0, p1, p2, p3]: Bez, k: number): Bez => {
  const a = lerp(p0, p1, k);
  const b = lerp(p1, p2, k);
  const c = lerp(p2, p3, k);
  const d = lerp(a, b, k);
  const e = lerp(b, c, k);
  return [p0, a, d, lerp(d, e, k)];
};
const bezPath = ([a, b, c, d]: Bez) => `M${a.x},${a.y} C${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
const arrowHead = (b: Bez, size: number) => {
  const tip = b[3];
  const from = Math.hypot(b[3].x - b[2].x, b[3].y - b[2].y) > 0.5 ? b[2] : b[1];
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
  const p = (da: number) => `${tip.x - size * Math.cos(ang + da)},${tip.y - size * Math.sin(ang + da)}`;
  return `M${tip.x},${tip.y} L${p(0.45)} L${p(-0.45)} z`;
};

/** 两张卡片之间的曲线：同列走侧边弧（向下走右侧、向上走左侧），跨列走水平切线 */
const route = (a: Rect & {col: number}, b: Rect & {col: number}, lane = 0): Bez => {
  const ay = a.y + a.h / 2 + lane;
  const by = b.y + b.h / 2 + lane;
  if (a.col === b.col) {
    const down = by > ay;
    const x = down ? a.x + a.w : a.x;
    const bulge = (down ? 1 : -1) * 34;
    return [
      {x, y: ay},
      {x: x + bulge, y: ay},
      {x: x + bulge, y: by},
      {x, y: by},
    ];
  }
  const right = b.x > a.x;
  const sx = right ? a.x + a.w : a.x;
  const ex = right ? b.x : b.x + b.w;
  const dx = (ex - sx) * 0.45;
  return [
    {x: sx, y: ay},
    {x: sx + dx, y: ay},
    {x: ex - dx, y: by},
    {x: ex, y: by},
  ];
};

const KIND_STYLE = {
  invoke: ARROW_STYLES.invoke,
  call: ARROW_STYLES.call,
  oneway: ARROW_STYLES.oneway,
  post: ARROW_STYLES.post,
  new: {color: RELATION_STYLES.creates.color, dash: '6 4', width: 2, name: 'new 实例'},
} as const;

const shortName = (script: FlowScript, id: string) => {
  const i = getInstance(script, id);
  return i ? getClass(i.cls).name : id;
};

export interface InstanceGraphProps {
  script: FlowScript;
  t: number;
  width: number;
  height: number;
  frame: number;
  /** 聚焦的类 id（与 Step.focus 一致） */
  focus?: string[];
  /** 只画这个时间窗起点之后的调用轨迹（章节内） */
  view?: [number, number];
  /** 调用线画出的时长（模拟时间单位） */
  animMs?: number;
  /** oneway / new / 返回 的高亮时长 */
  pulse?: number;
  /** 点击卡片（交互式浏览页用）：参数是类 id */
  onSelect?: (cls: string) => void;
  /** 只看这些实例（如一个进程）；与之交互的其他实例放进"其他进程"列 */
  only?: string[];
}

export const InstanceGraphView: React.FC<InstanceGraphProps> = ({
  script,
  t,
  width,
  height,
  frame,
  focus = [],
  view,
  animMs = 0.8,
  pulse = 4,
  onSelect,
  only,
}) => {
  const shown = React.useMemo(() => graphInstances(script, only), [script, only]);
  const L = React.useMemo(() => layoutGraph(script, width, height, shown), [script, width, height, shown]);
  const interactions = React.useMemo(() => interactionsOf(script), [script]);
  const since = view ? view[0] : -Infinity;
  const breathe = 0.5 + 0.5 * Math.sin(frame / 7);

  // —— 卡片 ——
  const cards = shown.map((inst) => {
    const isExt = inst.process === EXT;
    const realProc = isExt ? script.processes?.find((p) => p.id === instancesOf(script).find((x) => x.id === inst.id)?.process)?.label : undefined;
    const r = L.cards.get(inst.id)!;
    const cls = getClass(inst.cls);
    const owner = OWNER_COLORS[cls.owner];
    const born = instanceBornAt(script, inst.id);
    const alive = t >= born;
    const pop = alive ? ease(clamp01((t - born) / 1.5)) : 0;
    const span = alive ? instanceSpanAt(script, inst.id, t) : undefined;
    const marker = alive ? instanceMarkerAt(script, inst.id, t, 4) : undefined;
    const st = cls.stateMachine ? objectStateAt(script, inst.id, t) : undefined;
    const focused = focus.includes(inst.cls);
    const values = fieldsAt(script, inst.id, t);
    const rows = cardFieldRows(script, inst.id, L.rows);

    const border = span ? colors.info : focused ? owner : colors.border;
    return (
      <div
        key={inst.id}
        onClick={onSelect ? () => onSelect(inst.cls) : undefined}
        style={{
          cursor: onSelect ? 'pointer' : undefined,
          position: 'absolute',
          left: r.x,
          top: r.y,
          width: r.w,
          height: r.h,
          boxSizing: 'border-box',
          padding: '6px 10px 6px 12px',
          borderRadius: 10,
          border: `1.5px ${alive ? 'solid' : 'dashed'} ${alive ? border : '#334155'}`,
          borderLeft: `5px solid ${alive ? owner : '#334155'}`,
          background: span ? 'rgba(56,189,248,0.10)' : alive ? colors.panel2 : 'transparent',
          boxShadow: focused && alive ? `0 0 ${10 + 10 * breathe}px ${owner}66` : undefined,
          opacity: alive ? 0.55 + 0.45 * pop : 0.35,
          transform: `scale(${alive ? 0.94 + 0.06 * pop : 1})`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden'}}>
          <span
            style={{
              fontFamily: mono,
              fontSize: Math.min(14, Math.max(10.5, (r.w - 28) / textWidth(cls.name, 1.05))),
              fontWeight: 800,
              color: alive ? colors.fg : colors.muted,
            }}
          >
            {cls.name}
          </span>
        </div>
        <div style={{fontSize: 11, color: colors.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: 18}}>
          {isExt ? `${realProc} · ` : inst.label ? `${inst.label} · ` : ''}
          {alive ? cls.file.split('/').pop() : '尚未创建'}
        </div>
        {/* 状态行：状态机 > 正在执行 > 最近标注 */}
        <div style={{height: STATUS_H, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {st?.state && (
            <span
              style={{
                fontFamily: mono,
                fontSize: 11,
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: 5,
                background: stateColors[st.state] ?? '#0e7490',
                boxShadow: t - st.since < pulse ? `0 0 8px ${colors.info}` : undefined,
              }}
            >
              {st.state}
            </span>
          )}
          {span ? (
            <span style={{fontSize: 12, color: colors.info, overflow: 'hidden', textOverflow: 'ellipsis'}}>▶ {span.label}</span>
          ) : marker ? (
            <span style={{fontSize: 12, color: colors.warn, overflow: 'hidden', textOverflow: 'ellipsis'}}>✎ {marker.label}</span>
          ) : null}
        </div>
        {rows.map((row) => {
          const v = values.get(row.name);
          const fresh = !!v && t - v.since < pulse;
          const isRef = !!v?.value && !!getInstance(script, v.value);
          const text = v ? (v.value === null ? 'null' : isRef ? `→ ${shortName(script, v.value)}` : v.value) : row.type ?? '';
          return (
            <div
              key={row.name}
              style={{
                height: ROW_H,
                fontFamily: mono,
                fontSize: 11.5,
                display: 'flex',
                gap: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                borderRadius: 4,
                padding: '0 4px',
                margin: '0 -4px',
                background: fresh ? 'rgba(163,230,53,0.18)' : undefined,
              }}
            >
              <span style={{color: v ? '#cbd5e1' : '#64748b'}}>{row.name}</span>
              <span
                style={{
                  color: !v ? '#475569' : isRef ? colors.lime : colors.fg,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>
    );
  });

  // —— 字段引用线：只画流程中发生的赋值（初始值只写在卡片里） ——
  const refEdges: React.ReactNode[] = [];
  shown.forEach((inst) => {
    if (t < instanceBornAt(script, inst.id)) return;
    const a = L.cards.get(inst.id)!;
    const rows = cardFieldRows(script, inst.id, L.rows);
    fieldsAt(script, inst.id, t).forEach((v, name) => {
      if (!Number.isFinite(v.since) || !v.value || !getInstance(script, v.value)) return;
      const b = L.cards.get(v.value);
      if (!b) return;
      const ri = rows.findIndex((r) => r.name === name);
      const y = ri >= 0 ? a.y + CARD_HEAD + STATUS_H + 6 + ri * ROW_H + ROW_H / 2 : a.y + a.h / 2;
      const fromRight = b.x >= a.x;
      const start = {x: fromRight ? a.x + a.w : a.x, y};
      const bez: Bez =
        a.col === b.col
          ? [start, {x: start.x + (fromRight ? 26 : -26), y}, {x: start.x + (fromRight ? 26 : -26), y: b.y + b.h / 2}, {x: start.x, y: b.y + b.h / 2}]
          : (() => {
              const ex = b.x > a.x ? b.x : b.x + b.w;
              const ey = b.y + 14;
              const dx = (ex - start.x) * 0.45;
              return [start, {x: start.x + dx, y}, {x: ex - dx, y: ey}, {x: ex, y: ey}] as Bez;
            })();
      const fresh = t - v.since < pulse;
      const draw = ease(clamp01((t - v.since) / animMs));
      const part = splitBez(bez, draw);
      refEdges.push(
        <g key={`ref-${inst.id}-${name}`} opacity={fresh ? 1 : 0.32}>
          <circle cx={start.x} cy={start.y} r={3} fill={colors.lime} />
          <path d={bezPath(part)} fill="none" stroke={colors.lime} strokeWidth={fresh ? 2 : 1.2} strokeDasharray="2 4" />
          {draw > 0.95 && <path d={arrowHead(part, 8)} fill={colors.lime} />}
        </g>,
      );
    });
  });

  // —— 调用线 ——
  const callEdges: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  interactions
    .filter((c) => c.at <= t && c.at >= since)
    .forEach((c: Interaction, idx) => {
      const a = L.cards.get(c.from);
      const b = L.cards.get(c.to);
      if (!a || !b || c.from === c.to) return;
      const style = KIND_STYLE[c.kind];
      const open = (c.kind === 'invoke' || c.kind === 'call') && t < c.end;
      const queued = c.kind === 'post' && t < c.end;
      const justReturned = (c.kind === 'invoke' || c.kind === 'call') && t >= c.end && t - c.end < pulse * 0.5 && c.end > c.at;
      const blip = (c.kind === 'oneway' || c.kind === 'new') && t - c.at < pulse;
      const handled = c.kind === 'post' && t >= c.end && t - c.end < pulse;
      const active = open || queued || blip || handled;
      const bez = route(a, b, c.kind === 'post' ? 6 : c.kind === 'oneway' ? -6 : 0);
      const draw = ease(clamp01((t - c.at) / animMs));
      const part = splitBez(bez, draw);
      callEdges.push(
        <g key={`c${idx}`} opacity={active ? 1 : 0.16}>
          <path d={bezPath(part)} fill="none" stroke="#0d1117" strokeWidth={style.width + 4} opacity={active ? 0.8 : 0} />
          <path d={bezPath(part)} fill="none" stroke={style.color} strokeWidth={active ? style.width + 0.6 : 1.2} strokeDasharray={style.dash} />
          {draw > 0.95 &&
            ('hollow' in style && style.hollow ? (
              <path d={arrowHead(part, 10)} fill={colors.bg} stroke={style.color} strokeWidth={1.5} />
            ) : (
              <path d={arrowHead(part, active ? 10 : 7)} fill={style.color} />
            ))}
          {handled && <path d={`M${bez[3].x},${bez[3].y - 7} l7,7 l-7,7 l-7,-7 z`} fill={ARROW_STYLES.post.color} />}
          {justReturned && (
            <path d={bezPath([bez[3], bez[2], bez[1], bez[0]])} fill="none" stroke={ARROW_STYLES.iret.color} strokeWidth={1.4} strokeDasharray="3 4" />
          )}
        </g>,
      );
      if (active && draw > 0.5) {
        const mid = splitBez(bez, 0.5)[3];
        const text = queued ? `${c.label} · 排队中` : c.label;
        labels.push(
          <div
            key={`l${idx}`}
            style={{
              position: 'absolute',
              left: Math.min(Math.max(mid.x, 130), width - 130),
              top: mid.y,
              transform: 'translate(-50%, -50%)',
              maxWidth: 260,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(13,17,23,0.92)',
              border: `1px solid ${style.color}`,
              color: style.color,
              fontFamily: mono,
              fontSize: 12,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: clamp01((draw - 0.5) * 3),
            }}
          >
            {text}
          </div>,
        );
      }
    });

  // —— 进程诞生前的斜纹 ——
  const unbornProc = (pid: string) => {
    const p = script.processes?.find((x) => x.id === pid);
    const b = p?.bornAt ?? eventsOf(script, 'fork').find((f) => f.process === pid)?.at;
    return b !== undefined && t < b;
  };
  const hatchId = `ig-hatch-${script.id}`;

  return (
    <div style={{position: 'relative', width, height}}>
      <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          <pattern id={hatchId} width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={10} stroke="#334155" strokeWidth={3} opacity={0.5} />
          </pattern>
        </defs>
        {L.regions.map((rg) => (
          <g key={rg.process}>
            <rect
              x={rg.rect.x}
              y={rg.rect.y}
              width={rg.rect.w}
              height={rg.rect.h}
              rx={12}
              fill={unbornProc(rg.process) ? `url(#${hatchId})` : `${rg.color}0d`}
              stroke={rg.color}
              strokeOpacity={0.55}
              strokeDasharray="6 5"
            />
            <text x={rg.rect.x + 12} y={rg.rect.y + 22} fill={rg.color} fontSize={15} fontWeight={700}>
              {rg.label}
              {unbornProc(rg.process) ? '（尚未 fork）' : ''}
            </text>
          </g>
        ))}
        {L.columns.map(
          (c, i) =>
            c.label && (
              <text key={i} x={c.x + 2} y={PAD + REGION_HEAD + 12} fill={c.color} fontSize={13} fontWeight={700}>
                {c.label}
              </text>
            ),
        )}
      </svg>
      {cards}
      <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {refEdges}
        {callEdges}
      </svg>
      {labels}
    </div>
  );
};

export const GraphLegend: React.FC<{x: number; y: number}> = ({x, y}) => {
  const item = (name: string, color: string, dash?: string, hollow?: boolean) => (
    <span key={name} style={{display: 'flex', alignItems: 'center', gap: 6}}>
      <svg width={34} height={12}>
        <line x1={0} x2={28} y1={6} y2={6} stroke={color} strokeWidth={2} strokeDasharray={dash} />
        <path d="M28,1 L34,6 L28,11 z" fill={hollow ? 'none' : color} stroke={color} />
      </svg>
      {name}
    </span>
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 18, alignItems: 'center', fontSize: 15, color: colors.muted}}>
      {(['invoke', 'call', 'oneway', 'post'] as const).map((k) => item(KIND_STYLE[k].name, KIND_STYLE[k].color, KIND_STYLE[k].dash, k === 'oneway'))}
      {item('new 实例', KIND_STYLE.new.color, KIND_STYLE.new.dash)}
      {item('字段赋值 → 引用', colors.lime, '2 4')}
      <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
        <i style={{width: 22, height: 12, borderRadius: 3, border: `1.5px solid ${colors.info}`, background: 'rgba(56,189,248,0.12)', display: 'inline-block'}} />
        正在执行
      </span>
      <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
        <i style={{width: 22, height: 12, borderRadius: 3, border: '1.5px dashed #475569', display: 'inline-block'}} />
        尚未创建
      </span>
    </div>
  );
};
