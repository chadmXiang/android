import React from 'react';
import {createRoot} from 'react-dom/client';
import {CLASSES, getClass} from '../catalog/classes';
import {validateScript} from '../dsl/validate';
import type {FlowScript, Step} from '../dsl/types';
import {instancesOf, objectsOf} from '../engine/instances';
import {firstDivergence} from '../engine/diff';
import {slotKind} from '../layouts/slots';
import {templateFor} from '../layouts/templates';
import {DiffView} from '../views/DiffView';
import {PipelineView} from '../views/PipelineView';
import {crossProcessRows, ProcessSequenceView} from '../views/ProcessSequenceView';
import {LifecycleView} from '../views/LifecycleView';
import {DumpsysView} from '../views/DumpsysView';
import {DispatchRuleView} from '../views/DispatchRuleView';
import {ViewTreeView} from '../views/ViewTreeView';
import {StateStageView} from '../views/StateStageView';
import {TimerView} from '../views/TimerView';
import {eventsOf} from '../engine/state';
import {classUsage} from '../engine/usage';
import {colors, font, mono} from '../theme';
import {CallStackView} from '../views/CallStackView';
import {ClassInfoView} from '../views/ClassInfoView';
import {OWNER_COLORS} from '../views/ClassMapView';
import {CodeView} from '../views/CodeView';
import {DualTreeView} from '../views/DualTreeView';
import {GraphLegend, InstanceGraphView} from '../views/InstanceGraphView';
import {ObjectBoard} from '../views/ObjectBoard';
import {ScreenView} from '../views/ScreenView';
import {ServiceGrid} from '../views/ServiceGrid';
import {SwimlaneView} from '../views/SwimlaneView';
import {TaskStackView} from '../views/TaskStackView';
import {ENTRIES, type ExplorerEntry} from './registry';

/**
 * 交互式浏览页：选流程 → 选视图 → 拖时间轴；左侧类索引可以反查"这个类出现在哪些流程、什么时刻"。
 * 视图组件与视频完全共用（都是 t 的纯函数），这里只负责交互。
 */

const STAGE_W = 1400;
const STAGE_H = 760;

type ViewKind = 'swimlane' | 'graph' | 'task-stack' | 'tree' | 'services' | 'state-stage' | 'pipeline' | 'compare' | 'proc-seq' | 'lifecycle' | 'dumpsys' | 'dispatch-rules' | 'view-tree';
const VIEW_NAMES: Record<ViewKind, string> = {
  'proc-seq': '进程时序图',
  'dispatch-rules': '分发标准',
  'view-tree': 'View 树',
  lifecycle: '生命周期',
  dumpsys: 'dumpsys',
  compare: 'A / B 对比',
  swimlane: '时序泳道',
  graph: '对象协作图',
  'task-stack': 'Task 栈',
  tree: 'WMS ↔ SF 双树',
  services: '服务网格',
  'state-stage': '状态机舞台',
  pipeline: '流水线',
};

/** 模板主视图 → 浏览页视图 */
const MAIN_TO_VIEW: Record<string, ViewKind> = {
  swimlane: 'swimlane',
  graph: 'graph',
  'task-stack': 'task-stack',
  tree: 'tree',
  services: 'services',
  'state-stage': 'state-stage',
  pipeline: 'pipeline',
  'proc-seq': 'proc-seq',
  lifecycle: 'lifecycle',
  dumpsys: 'dumpsys',
  'dispatch-rules': 'dispatch-rules',
  'view-tree': 'view-tree',
};

/** 这条流程能用哪些视图：按数据判断可用性，按模板（kind）把主视图排在第一个 */
const viewsOf = (e: ExplorerEntry): ViewKind[] => {
  const s = e.script;
  const v: ViewKind[] = [];
  if (e.compare) v.push('compare');
  if (instancesOf(s).length) v.push('graph');
  v.push('swimlane');
  if (eventsOf(s, 'tree').some((x) => x.node === 'wm:tda')) v.push('task-stack');
  if ((s.trees ?? []).length >= 2) v.push('tree');
  if ((s.serviceGroups ?? []).length) v.push('services');
  if (eventsOf(s, 'timeout').length || objectsOf(s).length) v.push('state-stage');
  if (e.options?.pipeline) v.push('pipeline');
  if (crossProcessRows(s).length) v.push('proc-seq');
  if (e.options?.lifecycle) v.push('lifecycle');
  if (eventsOf(s, 'dump').length) v.push('dumpsys');
  if (e.options?.dispatchRules) v.push('dispatch-rules');
  if (e.options?.viewTree) v.push('view-tree');
  const preferred = e.compare ? 'compare' : MAIN_TO_VIEW[slotKind(templateFor(s, e.kind).slots.main)];
  return preferred && v.includes(preferred) ? [preferred, ...v.filter((x) => x !== preferred)] : v;
};

const fmt = (s: FlowScript, t: number) =>
  s.timeUnit === 'step' ? `步 ${t.toFixed(1)}` : s.timeUnit === 's' ? `${(t / 1000).toFixed(2)} s` : `${t.toFixed(1)} ms`;

/** 当前时刻对应的分镜：to ≤ t 的最后一步（按 to 排序） */
const stepAt = (steps: Step[], t: number) => {
  const sorted = steps.map((s, i) => ({s, i})).sort((a, b) => a.s.to - b.s.to);
  return sorted.filter((x) => x.s.to <= t + 1e-6).pop() ?? sorted[0];
};

const USAGE = classUsage(ENTRIES.map((e) => e.script));
const ERRORS = new Map(ENTRIES.map((e) => [e.script.id, validateScript(e.script)]));

const useWindowWidth = () => {
  const [w, setW] = React.useState(window.innerWidth);
  React.useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
};

const btn = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px',
  borderRadius: 8,
  border: `1px solid ${active ? colors.info : colors.border}`,
  background: active ? 'rgba(56,189,248,0.15)' : colors.panel2,
  color: active ? colors.info : colors.fg,
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: font,
});

const box: React.CSSProperties = {
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  padding: 12,
  boxSizing: 'border-box',
};

/** 深链：?flow=<script.id>&view=<ViewKind>&t=<number>&cls=<class id>&story=<序号>；加 still 关闭动画循环（截图用） */
const PARAMS = new URLSearchParams(window.location.search);
const STILL = PARAMS.has('still');
const initEntry = Math.max(0, ENTRIES.findIndex((e) => e.script.id === PARAMS.get('flow')));
const initView = (e: ExplorerEntry): ViewKind => {
  const v = PARAMS.get('view') as ViewKind | null;
  return v && viewsOf(e).includes(v) ? v : viewsOf(e)[0];
};

const App: React.FC = () => {
  const [entryIdx, setEntryIdx] = React.useState(initEntry);
  const entry: ExplorerEntry = ENTRIES[entryIdx];
  const script = entry.script;
  const views = viewsOf(entry);
  const [viewKind, setViewKind] = React.useState<ViewKind>(() => initView(entry));
  const [t, setT] = React.useState(PARAMS.has('t') ? Number(PARAMS.get('t')) : script.window[0]);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  const [frame, setFrame] = React.useState(0);
  const [storyIdx, setStoryIdx] = React.useState(Number(PARAMS.get('story') ?? 0));
  const [follow, setFollow] = React.useState(true);
  const [cls, setCls] = React.useState<string | undefined>(PARAMS.get('cls') ?? undefined);
  // 协作图过滤：'' = 全部；进程 id；或 options.graphSets 里的名字
  const [graphFilter, setGraphFilter] = React.useState(PARAMS.get('only') ?? '');
  const [query, setQuery] = React.useState('');
  const width = useWindowWidth();

  const story = entry.stories[storyIdx]?.story;
  const cur = story ? stepAt(story.steps, t) : undefined;
  const win: [number, number] = entry.compare
    ? [Math.min(script.window[0], entry.compare.window[0]), Math.max(script.window[1], entry.compare.window[1])]
    : script.window;
  const span = win[1] - win[0];

  // 播放：整条流程约 40 秒走完（×speed）；同时推进 frame 给呼吸灯等装饰动画
  const tRef = React.useRef(t);
  tRef.current = t;
  React.useEffect(() => {
    if (STILL) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setFrame((f) => f + dt * 30);
      if (playing) {
        const next = tRef.current + (span / 40) * speed * dt;
        if (next >= win[1]) {
          setT(win[1]);
          setPlaying(false);
        } else setT(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, span, win]);

  const selectEntry = (i: number, at?: number) => {
    setEntryIdx(i);
    setStoryIdx(0);
    setPlaying(false);
    const s = ENTRIES[i].script;
    // 切换流程时用它的模板主视图
    setViewKind(viewsOf(ENTRIES[i])[0]);
    setGraphFilter('');
    setT(at ?? s.window[0]);
  };

  const focus = cls ? [cls] : cur?.s.focus ?? [];
  // 镜头：与视频一致，Step 不写 view 就沿用前面最近一次写的
  const stepView = story && cur ? story.steps.slice(0, cur.i + 1).reduce<[number, number] | undefined>((v, st) => st.view ?? v, undefined) : undefined;
  const view: [number, number] = follow && stepView ? stepView : win;
  const vspan = view[1] - view[0];

  const sideW = 430;
  const leftW = 280;
  const stageAvail = Math.max(600, width - leftW - sideW - 48);
  const scale = stageAvail / STAGE_W;

  const renderMain = () => {
    switch (viewKind) {
      case 'graph': {
        const only = graphFilter
          ? entry.options?.graphSets?.[graphFilter] ?? (script.instances ?? []).filter((i) => i.process === graphFilter).map((i) => i.id)
          : undefined;
        return (
          <InstanceGraphView script={script} t={t} width={STAGE_W} height={STAGE_H} frame={frame} focus={focus} view={follow ? view : undefined} onSelect={setCls} only={only} />
        );
      }
      case 'proc-seq':
        return <ProcessSequenceView script={script} t={t} width={STAGE_W} height={STAGE_H} frame={frame} />;
      case 'lifecycle':
        return <LifecycleView script={script} t={t} width={STAGE_W} height={STAGE_H} frame={frame} config={entry.options?.lifecycle} />;
      case 'dispatch-rules':
        return <DispatchRuleView script={script} t={t} width={STAGE_W} height={STAGE_H} config={entry.options?.dispatchRules} />;
      case 'view-tree':
        return <ViewTreeView script={script} t={t} width={STAGE_W} height={STAGE_H} frame={frame} config={entry.options?.viewTree} />;
      case 'dumpsys': {
        const prev = story && cur && cur.i > 0 ? story.steps[cur.i - 1].to : win[0];
        return <DumpsysView script={script} t={t} width={STAGE_W} height={STAGE_H} since={prev} />;
      }
      case 'swimlane':
        return (
          <SwimlaneView
            script={script}
            t={t}
            width={STAGE_W}
            height={STAGE_H}
            frame={frame}
            focus={focus}
            view={view}
            labelRecent={vspan * 0.3}
            animMs={script.timeUnit === 'step' ? vspan * 0.006 : undefined}
          />
        );
      case 'task-stack':
        return <TaskStackView script={script} t={t} width={STAGE_W} height={STAGE_H} frame={frame} {...entry.options?.taskStack} />;
      case 'tree':
        return <DualTreeView script={script} t={t} width={STAGE_W} height={STAGE_H} frame={frame} />;
      case 'services':
        return <ServiceGrid script={script} t={t} width={STAGE_W} height={STAGE_H} frame={frame} />;
      case 'state-stage':
        return <StateStageView script={script} t={t} width={STAGE_W} height={STAGE_H} frame={frame} view={view} />;
      case 'pipeline':
        return entry.options?.pipeline ? (
          <PipelineView script={script} t={t} config={entry.options.pipeline} width={STAGE_W} height={STAGE_H} frame={frame} focus={focus} />
        ) : null;
      case 'compare': {
        const b = entry.compare!;
        const d = firstDivergence(script, b);
        const lines = d !== undefined && t >= d ? [{at: d, label: '首次分歧'}] : [];
        const half = STAGE_H / 2 - 6;
        return (
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            {[script, b].map((s, i) => (
              <div key={i} style={{position: 'relative'}}>
                <div style={{position: 'absolute', left: 12, top: 6, zIndex: 2, fontSize: 14, fontWeight: 700, color: i ? colors.bad : colors.ok}}>
                  {i ? 'B' : 'A'} · {s.title}
                </div>
                <SwimlaneView script={s} t={t} width={STAGE_W} height={half} frame={frame} focus={focus} view={view} compact markLines={lines} labelRecent={vspan * 0.3} />
              </div>
            ))}
          </div>
        );
      }
    }
  };

  const classes = CLASSES.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()));
  const errs = ERRORS.get(script.id) ?? [];
  const hasScreen = eventsOf(script, 'screen').length > 0;

  return (
    <div style={{display: 'flex', gap: 12, padding: 12, height: '100vh', boxSizing: 'border-box', fontFamily: font, color: colors.fg, background: colors.bg}}>
      {/* —— 左：流程 + 类索引 —— */}
      <div style={{width: leftW, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0}}>
        <div style={{...box, display: 'flex', flexDirection: 'column', gap: 4}}>
          <div style={{fontWeight: 700, marginBottom: 4}}>流程</div>
          {ENTRIES.map((e, i) => (
            <div
              key={e.script.id}
              onClick={() => selectEntry(i)}
              style={{
                cursor: 'pointer',
                fontSize: 13,
                padding: '4px 8px',
                borderRadius: 6,
                background: i === entryIdx ? 'rgba(56,189,248,0.15)' : undefined,
                color: i === entryIdx ? colors.info : colors.fg,
              }}
            >
              <span style={{color: colors.muted, fontSize: 11, marginRight: 6}}>{e.group}</span>
              {e.script.title}
              {(ERRORS.get(e.script.id) ?? []).length > 0 && <span style={{color: colors.bad}}> ⚠</span>}
            </div>
          ))}
        </div>
        <div style={{...box, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6}}>
          <div style={{fontWeight: 700}}>关键类（{CLASSES.length}）</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索类名…"
            style={{background: colors.panel2, border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.fg, padding: '5px 8px', fontFamily: mono}}
          />
          <div style={{overflowY: 'auto', flex: 1}}>
            {classes.map((c) => {
              const n = USAGE.get(c.id)?.length ?? 0;
              return (
                <div
                  key={c.id}
                  onClick={() => setCls(cls === c.id ? undefined : c.id)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 6px',
                    borderRadius: 5,
                    borderLeft: `3px solid ${OWNER_COLORS[c.owner]}`,
                    marginBottom: 2,
                    background: cls === c.id ? 'rgba(56,189,248,0.15)' : undefined,
                    fontFamily: mono,
                    fontSize: 12,
                    color: n ? colors.fg : colors.muted,
                  }}
                >
                  <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{c.name}</span>
                  {n > 0 && <span style={{fontSize: 10, color: colors.info}}>{n}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* —— 中：视图 + 时间轴 —— */}
      <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
          <div style={{fontSize: 22, fontWeight: 800}}>{script.title}</div>
          <div style={{fontSize: 13, color: colors.muted}}>{script.subtitle}</div>
          <div style={{marginLeft: 'auto', fontSize: 12, padding: '2px 10px', borderRadius: 10, border: `1px solid ${colors.info}`, color: colors.info}}>
            模板：{templateFor(script, entry.kind).def.name}
          </div>
        </div>
        <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center'}}>
          {views.map((v) => (
            <button key={v} style={btn(v === viewKind)} onClick={() => setViewKind(v)}>
              {VIEW_NAMES[v]}
            </button>
          ))}
          {viewKind === 'graph' && (
            <select value={graphFilter} onChange={(e) => setGraphFilter(e.target.value)} style={{...btn(false), padding: '4px 6px'}}>
              <option value="">全部对象</option>
              {(script.processes ?? [])
                .filter((p) => (script.instances ?? []).some((i) => i.process === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    只看 {p.label}
                  </option>
                ))}
              {Object.keys(entry.options?.graphSets ?? {}).map((k) => (
                <option key={k} value={k}>
                  集合：{k}
                </option>
              ))}
            </select>
          )}
          <span style={{width: 16}} />
          <label style={{fontSize: 13, color: colors.muted, display: 'flex', gap: 4, alignItems: 'center'}}>
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            跟随分镜镜头
          </label>
          {errs.length > 0 && <span style={{color: colors.bad, fontSize: 12}}>校验 {errs.length} 条错误（见控制台）</span>}
        </div>
        <div style={{...box, padding: 0, width: stageAvail, height: STAGE_H * scale, overflow: 'hidden', position: 'relative'}}>
          <div style={{width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: '0 0'}}>{renderMain()}</div>
        </div>
        {viewKind === 'graph' && (
          <div style={{position: 'relative', height: 22, transform: `scale(${Math.min(1, scale * 1.2)})`, transformOrigin: '0 0'}}>
            <GraphLegend x={0} y={0} />
          </div>
        )}

        {/* 时间轴 */}
        <div style={{...box, display: 'flex', flexDirection: 'column', gap: 8}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <button style={btn(playing)} onClick={() => (t >= win[1] ? (setT(win[0]), setPlaying(true)) : setPlaying(!playing))}>
              {playing ? '❚❚ 暂停' : '▶ 播放'}
            </button>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{...btn(false), padding: '4px 6px'}}>
              {[0.25, 0.5, 1, 2, 4].map((s) => (
                <option key={s} value={s}>
                  ×{s}
                </option>
              ))}
            </select>
            <input
              type="range"
              min={win[0]}
              max={win[1]}
              step={span / 2000}
              value={t}
              onChange={(e) => {
                setPlaying(false);
                setT(Number(e.target.value));
              }}
              style={{flex: 1}}
            />
            <span style={{fontFamily: mono, fontSize: 13, width: 110, textAlign: 'right'}}>{fmt(script, t)}</span>
          </div>
          {story && (
            <div style={{display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
              <select value={storyIdx} onChange={(e) => setStoryIdx(Number(e.target.value))} style={{...btn(false), padding: '4px 6px'}}>
                {entry.stories.map((s, i) => (
                  <option key={s.name} value={i}>
                    分镜：{s.name}
                  </option>
                ))}
              </select>
              {story.steps.map((st, i) => (
                <button
                  key={i}
                  style={{...btn(cur?.i === i), padding: '3px 9px'}}
                  title={st.caption}
                  onClick={() => {
                    setPlaying(false);
                    setT(st.to);
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
          {cur && <div style={{fontSize: 15, lineHeight: 1.6, borderLeft: `4px solid ${colors.info}`, paddingLeft: 10}}>{cur.s.caption}</div>}
        </div>
      </div>

      {/* —— 右：类详情 / 反查 / 状态 —— */}
      <div style={{width: sideW, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto'}}>
        <div style={{...box, minHeight: 200}}>
          <ClassInfoView id={cls ?? focus[0]} />
        </div>
        {(cls ?? focus[0]) && (
          <div style={box}>
            <div style={{fontWeight: 700, marginBottom: 6}}>出现在这些流程里</div>
            {(USAGE.get((cls ?? focus[0]) as string) ?? []).map((u, i) => (
              <div
                key={i}
                onClick={() => selectEntry(ENTRIES.findIndex((e) => e.script.id === u.scriptId), u.firstAt)}
                style={{cursor: 'pointer', fontSize: 13, padding: '4px 6px', borderRadius: 6, background: u.scriptId === script.id ? 'rgba(56,189,248,0.1)' : undefined}}
              >
                <span style={{color: colors.info}}>{u.title}</span>
                <span style={{color: colors.muted}}>
                  {' '}
                  · {u.as === 'instance' ? '实例' : '泳道'} {u.label} · 首次 {fmt(ENTRIES.find((e) => e.script.id === u.scriptId)!.script, u.firstAt)}
                </span>
              </div>
            ))}
            {!(USAGE.get((cls ?? focus[0]) as string) ?? []).length && <div style={{fontSize: 13, color: colors.muted}}>目前还没有流程用到这个类</div>}
          </div>
        )}
        {entry.compare && (
          <div style={{...box, height: 420}}>
            <DiffView a={script} b={entry.compare} t={t} max={10} />
          </div>
        )}
        {eventsOf(script, 'timeout').length > 0 && (
          <div style={box}>
            <TimerView script={entry.compare && viewKind === 'compare' ? entry.compare : script} t={t} />
          </div>
        )}
        {instancesOf(script).length > 0 && (
          <div style={{...box, height: 260}}>
            <CallStackView
              script={script}
              t={t}
              unit={script.timeUnit === 'step' ? '步' : 'ms'}
              only={
                viewKind === 'graph' && graphFilter
                  ? entry.options?.graphSets?.[graphFilter] ?? (script.instances ?? []).filter((i) => i.process === graphFilter).map((i) => i.id)
                  : undefined
              }
            />
          </div>
        )}
        <div style={box}>
          <ObjectBoard script={script} t={t} within={span * 0.03} />
        </div>
        {hasScreen && (
          <div style={{...box, padding: 0, height: 300, display: 'flex', justifyContent: 'center'}}>
            <ScreenView script={script} t={t} width={200} height={300} frame={frame} />
          </div>
        )}
        {cur?.s.code && (
          <div style={{height: 220}}>
            <CodeView code={cur.s.code} localSec={10} />
          </div>
        )}
      </div>
    </div>
  );
};

ERRORS.forEach((e, id) => e.forEach((x) => console.warn(`[flow:${id}] ${x}`)));
createRoot(document.getElementById('root')!).render(<App />);

// 方便在控制台里查：getClass('window-state')
(window as unknown as {getClass: typeof getClass}).getClass = getClass;
