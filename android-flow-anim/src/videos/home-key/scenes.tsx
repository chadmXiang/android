import React from 'react';
import {objectStateAt} from '../../engine/state';
import {homeInputStory, homeKeyScript, homeStory, homeTemplateStory, homeTreeStory} from '../../flows/system/homeKey';
import {makeMapScene} from '../../layouts/MapStory';
import {StoryScene} from '../../layouts/StoryScene';
import {makeTemplateScene} from '../../layouts/TemplateScene';
import {colors, layerColors} from '../../theme';
import {SummaryCard, TitleCard} from '../../views/Cards';
import {ArrowLegend, Caption, Header, Panel} from '../../views/Chrome';
import {CodeView} from '../../views/CodeView';
import {DualTreeView} from '../../views/DualTreeView';
import {MessageQueueView} from '../../views/MessageQueueView';
import {ObjectBoard} from '../../views/ObjectBoard';
import {PipelineView, type PipelineConfig} from '../../views/PipelineView';
import {ResourcePoolView} from '../../views/ResourcePoolView';
import {ScreenView} from '../../views/ScreenView';
import {StateView} from '../../views/StateView';
import {SwimlaneView} from '../../views/SwimlaneView';

const BLUE = '#60a5fa';

export const HomeTitleScene: React.FC = () => (
  <TitleCard
    kicker="AOSP · 硬件 HOME 键（示意时序）"
    title="按下 Home 键之后"
    subtitle="InputReader → InputDispatcher → PhoneWindowManager → ATMS → Launcher"
  />
);

// 拐点坐标依赖 layoutMap 的堆叠结果；改组件顺序或进程坑位时需同步
export const HomeMap = makeMapScene({
  title: 'Home 键经过的进程',
  components: ['ims', 'pwm', 'atms', 'wms', 'launcher', 'activity-thread', 'sf-ce'],
  intro: 'system_server（输入 + 窗口）、两个应用进程、SurfaceFlinger 参与一次 Home 键响应。',
  outro: '一句话：输入管线产生按键，PhoneWindowManager 决定吞掉它，ATMS 换前台，WMS 换焦点。',
  legend: [
    {label: 'binder', color: BLUE},
    {label: '输入管线内部', color: colors.lime},
    {label: '策略拦截', color: colors.pink},
    {label: '内部调用 / 事务', color: colors.orange},
  ],
  edges: [
    {
      from: 'ims', to: 'pwm', label: 'interceptKeyBeforeDispatching → -1', color: colors.pink,
      via: [[660, 214], [660, 128], [1150, 128], [1150, 249]], labelAt: [905, 128],
      desc: '派发前 InputDispatcher 询问策略：PhoneWindowManager.interceptKeyBeforeDispatching 对 HOME 返回 -1，按键被系统吃掉，应用收不到。',
    },
    {
      from: 'pwm', to: 'atms', label: 'startHomeOnDisplay', color: colors.orange,
      via: [[1170, 249], [1170, 100], [1200, 100], [1200, 284]], labelAt: [1185, 100],
      desc: 'PhoneWindowManager 调 ATMS.startHomeOnDisplay，把 Launcher Task 切到前台。',
    },
    {
      from: 'atms', to: 'activity-thread', label: 'Pause / Stop', color: BLUE,
      labelAt: [648, 372],
      desc: 'ATMS 让 com.foo 先 onPause；桌面可见之后再 onStop（都是 oneway）。',
    },
    {
      from: 'atms', to: 'launcher', label: 'NewIntent + Resume', color: BLUE,
      desc: 'com.foo 暂停完成后，ATMS 给 Launcher 下发 NewIntent + Resume。',
    },
    {
      from: 'launcher', to: 'wms', label: 'relayout2 · finishDrawing', color: BLUE,
      via: [[340, 120], [1210, 120], [1210, 300]], labelAt: [800, 120],
      desc: '桌面窗口早就存在，这一帧只是重新可见 + 重绘，不用再 addWindow。',
    },
    {
      from: 'launcher', to: 'sf-ce', label: 'setBuffer 事务（RenderThread）', color: colors.orange,
      via: [[640, 440], [1240, 440], [1240, 300]], labelAt: [940, 440],
      desc: 'Launcher 的 RenderThread 画完，BLASTBufferQueue 把 buffer 打成事务直接提交给 SurfaceFlinger。',
    },
    {
      from: 'wms', to: 'ims', label: 'setInputFocusLw', color: colors.lime,
      via: [[690, 318], [690, 500], [1210, 500], [1210, 214]], labelAt: [950, 500],
      desc: '桌面窗口可见后，WMS 经 InputMonitor 把输入焦点交给 Launcher 的窗口。',
    },
  ],
});

const INPUT_PIPELINE: PipelineConfig = {
  groups: [{id: 'ss', label: 'system_server', color: layerColors.system_server}],
  stages: [
    {id: 'reader', label: 'InputReader', sub: 'EventHub 读取 · KeyboardInputMapper 映射', lanes: ['ss:reader'], group: 'ss'},
    {id: 'dispatch', label: 'InputDispatcher', sub: 'BeforeQueueing · inbound 队列 · 派发前拦截', lanes: ['ss:dispatch'], group: 'ss'},
    {id: 'policy', label: 'PhoneWindowManager', sub: 'Handler · 启动桌面', lanes: ['ss:policy'], group: 'ss'},
  ],
  connectors: false,
  stageHeight: 300,
  returns: [
    {from: 'reader', to: 'dispatch', label: 'notifyKey', match: 'notifyKey'},
    {from: 'dispatch', to: 'policy', label: 'post handleShortPressOnHome', match: 'handleShortPressOnHome'},
  ],
};

export const HomeInputScene: React.FC = () => (
  <StoryScene
    story={homeInputStory}
    startT={homeKeyScript.window[0]}
    render={({frame, t, seg, local, focus, total}) => (
      <>
        <Header title="HOME 键在输入管线里的旅程" subtitle="令牌 ↓ / ↑ = 硬件按键事件" right={`${seg.index + 1} / ${total}`} />
        <Panel x={40} y={96} w={1840} h={420}>
          <PipelineView script={homeKeyScript} t={t} config={INPUT_PIPELINE} width={1840} height={420} frame={frame} focus={focus} />
        </Panel>
        <Panel x={40} y={530} w={620} h={300} pad={12}>
          <ResourcePoolView script={homeKeyScript} t={t} focus={focus} compact />
        </Panel>
        <Panel x={680} y={530} w={240} h={300}>
          <ScreenView script={homeKeyScript} t={t} width={240} height={300} frame={frame} />
        </Panel>
        <div style={{position: 'absolute', left: 940, top: 530, width: 940, height: 300}}>
          <CodeView key={seg.index} code={seg.step.code} localSec={local} />
        </div>
        <Caption key={`c${seg.index}`} text={seg.step.caption} localSec={local} />
      </>
    )}
  />
);

export const HomeOverviewScene: React.FC = () => (
  <StoryScene
    story={homeStory}
    startT={homeKeyScript.window[0]}
    defaultView={homeKeyScript.window}
    render={({frame, t, seg, local, focus, total, view}) => {
      const v = view ?? homeKeyScript.window;
      return (
        <>
          <Header title={homeKeyScript.title} subtitle={homeKeyScript.subtitle} right={`${seg.index + 1} / ${total}`} />
          <Panel x={40} y={96} w={1300} h={736}>
            <SwimlaneView
              script={homeKeyScript}
              t={t}
              width={1300}
              height={736}
              frame={frame}
              focus={focus}
              view={v}
              labelRecent={(v[1] - v[0]) * 0.3}
            />
          </Panel>
          <Panel x={1370} y={96} w={200} h={330}>
            <ScreenView script={homeKeyScript} t={t} width={200} height={330} frame={frame} />
          </Panel>
          <Panel x={1584} y={96} w={296} h={330} pad={12}>
            <ObjectBoard script={homeKeyScript} t={t} />
          </Panel>
          <Panel x={1370} y={440} w={510} h={150} pad={12}>
            <MessageQueueView script={homeKeyScript} lane="ss:policy" t={t} />
          </Panel>
          <div style={{position: 'absolute', left: 1370, top: 604, width: 510, height: 228}}>
            <CodeView key={seg.index} code={seg.step.code} localSec={local} />
          </div>
          <ArrowLegend x={44} y={844} />
          <Caption key={`c${seg.index}`} text={seg.step.caption} localSec={local} />
        </>
      );
    }}
  />
);

export const HomeTreeScene: React.FC = () => (
  <StoryScene
    story={homeTreeStory}
    startT={homeKeyScript.window[0]}
    render={({frame, t, seg, local, total}) => {
      const dw = objectStateAt(homeKeyScript, 'draw', t);
      return (
        <>
          <Header title="Home 键中的窗口层级" subtitle="Task 的 Z 序变化 · 焦点转移" right={`${seg.index + 1} / ${total}`} />
          <Panel x={40} y={96} w={1160} h={750}>
            <DualTreeView script={homeKeyScript} t={t} width={1160} height={750} frame={frame} />
          </Panel>
          <Panel x={1220} y={96} w={660} h={330} pad={8}>
            <StateView machine="draw-state" current={dw.state} prev={dw.prev} width={644} height={314} title="WindowStateAnimator.mDrawState · Launcher" />
          </Panel>
          <Panel x={1220} y={440} w={250} h={406}>
            <ScreenView script={homeKeyScript} t={t} width={250} height={406} frame={frame} />
          </Panel>
          <div style={{position: 'absolute', left: 1484, top: 440, width: 396, height: 406}}>
            <CodeView key={seg.index} code={seg.step.code} localSec={local} />
          </div>
          <Caption key={`c${seg.index}`} text={seg.step.caption} localSec={local} />
        </>
      );
    }}
  />
);

/** 主场景：按阶段在"时序"与"Task 栈"两个模板之间切换 */
export const HomeStoryScene = makeTemplateScene({
  script: homeKeyScript,
  story: homeTemplateStory,
  options: {
    taskStack: {bind: {'wm:ar-f': 'ar-foo', 'wm:ar-l': 'ar-launcher', 'wm:ws-l': 'draw'}},
  },
});

export const HomeEndingScene: React.FC = () => (
  <SummaryCard
    heading="Home 键的四个要点"
    lines={[
      ['两次拦截', 'BeforeQueueing 决定要不要入队，BeforeDispatching 决定要不要给应用'],
      ['系统消费', 'PhoneWindowManager 对 HOME 返回 -1，应用永远收不到这个键'],
      ['熟悉的骨架', 'moveToFront → pause → resume → 重绘一帧，和冷启动同一套机制'],
      ['可见了才给焦点', '桌面窗口 HAS_DRAWN、可见之后，WMS 才把输入焦点切回去'],
    ]}
  />
);
