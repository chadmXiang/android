import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {doubleScript, compareStory, tripleScript} from '../../flows/render/tripleBuffer';
import {frameScript, frameStory, pipelineStory} from '../../flows/render/frame';
import {FRAME_PIPELINE as PIPELINE} from '../../flows/render/pipeline';
import {surfaceTreeScript, surfaceTreeStory} from '../../flows/wm/surfaceTree';
import {StoryScene} from '../../layouts/StoryScene';
import {makeTemplateScene} from '../../layouts/TemplateScene';
import {colors, font} from '../../theme';
import {SummaryCard, TitleCard} from '../../views/Cards';
import {Caption, Header, Legend, Panel} from '../../views/Chrome';
import {CodeView} from '../../views/CodeView';
import {FormulaView, formulaSeconds} from '../../views/FormulaView';
import {MapView, NUM, type MapEdge} from '../../views/MapView';
import {ResourcePoolView} from '../../views/ResourcePoolView';
import {SwimlaneView} from '../../views/SwimlaneView';

// ───────────────────────── 1. 片头 ─────────────────────────
export const TitleScene: React.FC = () => (
  <TitleCard
    kicker="AOSP Android 17 · frameworks/base + frameworks/native"
    title="一帧是怎么渲染出来的"
    subtitle="VSYNC · BufferQueue · SurfaceFlinger · WMS 分工"
    chips={['A', 'B', 'C']}
  />
);

// ───────────────────────── 2. 进程与模块（MapView） ─────────────────────────
const MAP_COMPONENTS = [
  'choreographer', 'hwui', 'bbq',
  'wms',
  'sf-tx', 'sf-fe', 'sf-ce', 'sf-sched',
  'gpu', 'hwc',
];

const MAP_START = 2.2;
const MAP_GAP = 2.8;

// 拐点坐标依赖 layoutMap 的堆叠结果（见 MapView），改组件顺序时需同步
const MAP_EDGE_DEFS: Omit<MapEdge, 'appearAt'>[] = [
  {
    from: 'bbq', to: 'sf-tx', label: 'setBuffer 事务', color: colors.orange,
    via: [[650, 436], [650, 588], [1215, 588], [1215, 258], [1268, 258]], labelAt: [930, 588],
    desc: 'buffer 只通过 Transaction::setBuffer 进入 SF——BufferQueue 两端都在应用进程（BLAST）。',
  },
  {
    from: 'wms', to: 'sf-tx', label: '层级 / 几何事务', color: colors.info, labelAt: [1190, 214],
    desc: 'WMS 维护与窗口层级同构的 SurfaceControl 容器树，只发层级 / 几何 / 可见性命令，不画像素。',
  },
  {
    from: 'sf-ce', to: 'hwc', label: '合成 / present', color: colors.lime,
    via: [[1860, 386], [1860, 684]], labelAt: [1846, 540],
    desc: 'SF：事务就绪判定 → 快照 → latch → 合成，最后交给 HWC present。',
  },
  {
    from: 'hwc', to: 'sf-sched', label: '硬件 VSYNC', color: colors.pink, labelAt: [1640, 575],
    desc: 'HWC 产生硬件 VSYNC 与 present fence，Scheduler 用它们做线性回归预测下一个 VSYNC。',
  },
  {
    from: 'sf-sched', to: 'choreographer', label: 'VSYNC-app（EventThread → Choreographer）', color: colors.pink,
    via: [[1885, 462], [1885, 112], [340, 112]], labelAt: [1000, 112],
    desc: 'EventThread 按 workDuration + readyDuration 提前唤醒应用的 Choreographer#doFrame。',
  },
  {
    from: 'sf-ce', to: 'bbq', label: 'release fence（BufferReleaseChannel）', color: colors.orange,
    via: [[1225, 386], [1225, 770], [330, 770]], labelAt: [780, 770],
    desc: 'release fence 经 BufferReleaseChannel 回到应用，slot 回 FREE，阻塞的 dequeue 被唤醒。',
  },
];

const MAP_EDGES: MapEdge[] = MAP_EDGE_DEFS.map((e, i) => ({...e, appearAt: MAP_START + i * MAP_GAP}));

const MAP_FINAL = MAP_START + MAP_EDGES.length * MAP_GAP + 0.3;
export const MAP_SECONDS = MAP_FINAL + 4.5;

export const MapScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  const cur = Math.floor((sec - MAP_START) / MAP_GAP);
  const final = sec >= MAP_FINAL;
  const caption = final
    ? '一句话分工：应用管像素，WMS 管树和序，SF 管合成与时序，HWC 管上屏和节拍。'
    : cur >= 0
      ? `${NUM[Math.min(cur, MAP_EDGES.length - 1)]} ${MAP_EDGES[Math.min(cur, MAP_EDGES.length - 1)].desc ?? ''}`
      : '四个进程、一条数据流（buffer）和一条控制流（SurfaceControl.Transaction）。';
  const capStart = final ? MAP_FINAL : cur >= 0 ? MAP_START + cur * MAP_GAP : 0;

  return (
    <AbsoluteFill style={{background: colors.bg, color: colors.fg, fontFamily: font}}>
      <MapView components={MAP_COMPONENTS} edges={MAP_EDGES} sec={sec} active={final ? -1 : cur} />
 <Header title="参与渲染的进程与模块" />
      <div style={{position: 'absolute', left: 80, top: 808, display: 'flex', gap: 30, fontSize: 16}}>
        <span style={{color: colors.orange}}>━ buffer 数据流</span>
        <span style={{color: colors.info}}>━ Transaction 控制流</span>
        <span style={{color: colors.lime}}>━ HWC</span>
        <span style={{color: colors.pink}}>━ VSYNC</span>
      </div>
      <Caption key={caption} text={caption} localSec={sec - capStart} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 3. 四个执行者、三次交接（PipelineView） ─────────────────────────

/** 流水线模板：Pipeline + 资源状态机 + VSYNC 条 + 源码（frameScript.kind = 'pipeline'） */
export const PipelineScene = makeTemplateScene({
  script: frameScript,
  story: pipelineStory,
  title: '四个执行者、三次交接',
  subtitle: 'UI 线程 → RenderThread → GPU → SurfaceFlinger → HWC',
  options: {pipeline: PIPELINE},
});

// ───────────────────────── 4. 一帧全链路（SwimlaneView） ─────────────────────────
export const FrameScene: React.FC = () => (
  <StoryScene
    story={frameStory}
    startT={frameScript.window[0]}
    render={({frame, t, seg, local, focus, total}) => (
      <>
        <Header title={frameScript.title} subtitle={frameScript.subtitle} right={`${seg.index + 1} / ${total}`} />
        <Panel x={40} y={96} w={1300} h={736}>
          <SwimlaneView script={frameScript} t={t} width={1300} height={736} frame={frame} focus={focus} />
        </Panel>
        <Panel x={1370} y={96} w={510} h={370} pad={16}>
          <ResourcePoolView script={frameScript} t={t} focus={focus} />
        </Panel>
        <div style={{position: 'absolute', left: 1370, top: 480, width: 510, height: 352}}>
          <CodeView key={seg.index} code={seg.step.code} localSec={local} />
        </div>
        <Legend x={44} y={844} />
        <Caption key={`c${seg.index}`} text={seg.step.caption} localSec={local} />
      </>
    )}
  />
);

// ───────────────────────── 5. 几块 buffer 是算出来的（FormulaView） ─────────────────────────
export const FORMULA_SECONDS = formulaSeconds() + 5;

const FORMULA_SNIPPET = `int SurfaceFlinger::calculateMaxAcquiredBufferCount(Fps refreshRate,
        std::chrono::nanoseconds presentLatency) {
    int64_t pipelineDepth = presentLatency.count() / refreshRate.getPeriodNsecs();
    if (presentLatency.count() % refreshRate.getPeriodNsecs()) {
        pipelineDepth++;
    }
    const int64_t maxAcquiredBuffers =
            std::min(pipelineDepth - 1, maxAcquiredBuffersOpt.value_or(pipelineDepth - 1));
    return std::max(minAcquiredBuffers, maxAcquiredBuffers);
}

// :9354-9358
const auto presentLatency = vsyncConfig.appWorkDuration + vsyncConfig.sfWorkDuration;`;

export const FormulaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  const doneAt = formulaSeconds();
  const done = sec >= doneAt;
  return (
    <AbsoluteFill style={{background: colors.bg, color: colors.fg, fontFamily: font}}>
 <Header title="几块 buffer 是算出来的" subtitle="60 Hz / 90 Hz / 120 Hz 调度预算对照" />
      <div style={{position: 'absolute', left: 40, top: 100, width: 760, height: 760}}>
        <CodeView
          localSec={sec}
          code={{
            file: 'sf/SurfaceFlinger.cpp:9312-9320',
            snippet: FORMULA_SNIPPET,
            note: '三步：算预算 → 除周期取上整 → 减一。\n源码里没有任何常量叫 3。',
          }}
        />
      </div>
      <Panel x={830} y={100} w={1050} h={760} pad={24}>
        <FormulaView profiles={['default-60', 'default-120', 'vendor-abs-120']} maxDequeued={2} sec={sec} />
      </Panel>
      <Caption
        key={done ? 'done' : 'calc'}
        localSec={done ? sec - doneAt : sec}
        text={
          done
            ? 'AOSP 默认（-1）预算随周期缩放，60/120Hz 都是 3 块；厂商把预算写成绝对值，120Hz 直接变 5 块——显存 ×5/3，延迟约 4 个周期。'
            : '同一个 presentLatency，一边决定 app 什么时候被唤醒，一边决定流水线深度和 buffer 数。'
        }
      />
    </AbsoluteFill>
  );
};

// ───────────────────────── 6. 3 块 vs 2 块（分屏） ─────────────────────────
/** 对比模板：三缓冲 vs 双缓冲，共用时间轴；右侧差异面板 */
export const CompareScene = makeTemplateScene({
  script: {...tripleScript, title: '三级缓冲：1 acquired + 2 dequeued = 3'},
  compare: {...doubleScript, title: '双缓冲：1 acquired + 1 dequeued = 2'},
  kind: 'compare',
  story: compareStory,
  title: 'GPU 抖一下：3 块 vs 2 块',
  subtitle: '为什么生产者侧要 maxDequeued = 2',
  slots: {main: 'swimlane', sa: 'pool', b: 'b:swimlane', sb: 'b:pool', s1: 'diff'},
});

// ───────────────────────── 7. WMS 树 ↔ SF 树（映射模板） ─────────────────────────
export const TreeScene = makeTemplateScene({
  script: surfaceTreeScript,
  story: surfaceTreeStory,
  slots: {main: 'tree', s1: 'state:transition:transition', s2: 'screen', s3: 'code'},
});

// ───────────────────────── 8. 结尾 ─────────────────────────
export const EndingScene: React.FC = () => (
  <SummaryCard
    heading="同一个闭环的四个切面"
    lines={[
      ['VSYNC 定预算', 'app 16.67ms + sf 15.67ms = presentLatency'],
      ['预算定 buffer 数', '⌈32.34 / 16.67⌉ − 1 + 2 = 3'],
      ['buffer 数定延迟', '多一块 = 多一帧延迟，换来抗抖动'],
      ['延迟超标被拉回', 'SF backpressure + RenderThread 拿不到 buffer 就跳帧（SkippedFrameReason::NoBuffer）'],
    ]}
  />
);
