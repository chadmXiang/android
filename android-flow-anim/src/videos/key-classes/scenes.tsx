import React from 'react';
import {getClass} from '../../catalog/classes';
import {SERVICES_MAP, WM_CONTAINER_MAP} from '../../catalog/classmaps';
import type {ClassMapDef, ClassRelation} from '../../catalog/types';
import type {FlowScript, FlowStory, Step} from '../../dsl/types';
import {addWindowClassScript, addWindowClassStory, addWindowGraphStory} from '../../flows/classes/addWindow';
import {startActivityClassScript, startActivityClassStory, startActivityGraphStory} from '../../flows/classes/startActivity';
import {StoryScene} from '../../layouts/StoryScene';
import {makeTemplateScene} from '../../layouts/TemplateScene';
import {SummaryCard, TitleCard} from '../../views/Cards';
import {ArrowLegend, Caption, Header, Panel} from '../../views/Chrome';
import {ClassInfoView} from '../../views/ClassInfoView';
import {ClassMapView, mapRelations, relationKey, RELATION_STYLES, RelationLegend} from '../../views/ClassMapView';
import {CodeView} from '../../views/CodeView';
import {ObjectBoard} from '../../views/ObjectBoard';
import {SwimlaneView} from '../../views/SwimlaneView';

export const KeyClassesTitleScene: React.FC = () => (
  <TitleCard
    kicker="AOSP · framework 关键类（对照 Android 17 / SDK 37 源码）"
    title="AMS / ATMS / WMS / PMS 里的关键类"
    subtitle="从组件到类：谁持有谁、谁继承谁、谁跨进程调谁"
  />
);

type ClassMapStep = Step & {
  activeRelationKey?: string;
  conceptualIndex: number;
  visibleClasses: Set<string>;
  focusedClasses: Set<string>;
  freshClasses: Set<string>;
  visibleRelationKeys: Set<string>;
};

type ClassMapStory = Omit<FlowStory, 'steps'> & {steps: ClassMapStep[]};

const relationCaption = (relation: ClassRelation, number: number, conceptualCaption: string): string => {
  const source = getClass(relation.from).name;
  const target = getClass(relation.to).name;
  const meaning = relation.label ? `${RELATION_STYLES[relation.kind].name} / ${relation.label}` : RELATION_STYLES[relation.kind].name;
  return `${number}. ${source} → ${target}：${meaning}｜${conceptualCaption}`;
};

/**
 * Assign each edge to the first conceptual step where both endpoints are visible,
 * then expand that step into paced relation slots. Exporting the expanded story
 * also makes composition duration follow the relation-reading pace.
 */
const paceClassMapStory = (map: ClassMapDef, conceptualStory: FlowStory): ClassMapStory => {
  const relations = mapRelations(map);
  const introduced = new Set<number>();
  const visibleRelationKeys = new Set<string>();
  let accumulated = new Set<string>();
  const steps: ClassMapStep[] = [];

  conceptualStory.steps.forEach((step, conceptualIndex) => {
    const focus = step.focus ?? [];
    const focusedClasses = new Set(focus);
    const visible =
      conceptualIndex === conceptualStory.steps.length - 1
        ? new Set(map.classes.map((c) => c.id))
        : new Set([...accumulated, ...focus]);
    const freshClasses = new Set([...visible].filter((id) => !accumulated.has(id)));
    const introducedHere = relations
      .map((relation, index) => ({relation, index}))
      .filter(({relation, index}) => !introduced.has(index) && visible.has(relation.from) && visible.has(relation.to));

    if (introducedHere.length === 0) {
      steps.push({...step, conceptualIndex, visibleClasses: visible, focusedClasses, freshClasses, visibleRelationKeys: new Set(visibleRelationKeys)});
    } else {
      const relationHold = Math.max(4, step.hold / introducedHere.length);
      introducedHere.forEach(({relation, index}, slotIndex) => {
        introduced.add(index);
        const activeRelationKey = relationKey(relation, index);
        visibleRelationKeys.add(activeRelationKey);
        steps.push({
          ...step,
          move: slotIndex === 0 ? step.move : 0.01,
          hold: relationHold,
          caption: relationCaption(relation, index + 1, step.caption),
          activeRelationKey,
          conceptualIndex,
          visibleClasses: visible,
          focusedClasses,
          freshClasses: slotIndex === 0 ? freshClasses : new Set<string>(),
          visibleRelationKeys: new Set(visibleRelationKeys),
        });
      });
    }
    accumulated = visible;
  });

  return {steps};
};

/** Class map story: classes accumulate; each newly available relation gets its own slot. */
const makeClassMapScene = (map: ClassMapDef, story: ClassMapStory, subtitle: string): React.FC => {
  const conceptualTotal = Math.max(...story.steps.map((step) => step.conceptualIndex)) + 1;
  const Scene: React.FC = () => (
    <StoryScene
      story={story}
      startT={0}
      render={({frame, seg, local}) => {
        const step = seg.step as ClassMapStep;
        return (
          <>
            <Header title={map.title} subtitle={subtitle} right={`${step.conceptualIndex + 1} / ${conceptualTotal}`} />
            <Panel x={40} y={92} w={1840} h={740}>
              <ClassMapView
                map={map}
                visible={step.visibleClasses}
                visibleRelationKeys={step.visibleRelationKeys}
                focus={step.focusedClasses}
                fresh={step.freshClasses}
                activeRelationKey={step.activeRelationKey}
                dimInactiveRelations
                local={local}
                frame={frame}
                width={1840}
                height={740}
              />
            </Panel>
            <RelationLegend x={44} y={842} />
            <Caption key={step.activeRelationKey ?? `concept-${step.conceptualIndex}`} text={step.caption} localSec={local} />
          </>
        );
      }}
    />
  );
  return Scene;
};

const servicesMapConceptStory: FlowStory = {
  steps: [
    {
      to: 0, move: 1.2, hold: 7,
      focus: ['activity-thread', 'application-thread', 'at-h', 'transaction-executor', 'activity'],
      caption: '应用进程：ActivityThread 是主线程总管。ApplicationThread 是 system_server 调进来的 binder 入口，H 把调用转到主线程，TransactionExecutor 执行生命周期事务。',
    },
    {
      to: 1, move: 1.2, hold: 6.5,
      focus: ['wm-global', 'view-root-impl', 'vri-w'],
      caption: '窗口在应用侧：WindowManagerGlobal 管本进程所有 ViewRootImpl；ViewRootImpl 的内部类 W 是 WMS 回调窗口用的 binder（A17 里经 WindowClientTransactionHandler 间接继承 IWindow.Stub）。',
    },
    {
      to: 2, move: 1.2, hold: 7.5,
      focus: ['atms', 'start-controller', 'activity-starter', 'task-supervisor', 'lifecycle-manager', 'wpc'],
      caption: 'ATMS：ActivityStarter 执行一次启动，ActivityTaskSupervisor 负责解析和真正启动，ClientLifecycleManager 把事务发给应用；WindowProcessController 是 ATMS 眼中的进程。',
    },
    {
      to: 3, move: 1.2, hold: 7,
      focus: ['wms', 'session', 'surface-placer', 'transition-controller', 'sync-engine'],
      caption: 'WMS：每个应用进程一个 Session（IWindowSession）；WindowSurfacePlacer 集中做布局与摆放；TransitionController + BLASTSyncEngine 负责过渡与同帧。',
    },
    {
      to: 4, move: 1.2, hold: 7.5,
      focus: ['root-wc', 'display-content', 'task', 'activity-record', 'window-state', 'ws-animator'],
      caption: '容器树（ATMS / WMS 共用）：RootWindowContainer → DisplayContent →（TaskDisplayArea）→ Task → ActivityRecord → WindowState；WindowStateAnimator 管窗口的绘制状态和 surface。',
    },
    {
      to: 5, move: 1.2, hold: 7.5,
      focus: ['ams', 'process-list', 'process-record', 'active-services', 'broadcast-queue', 'oom-adjuster'],
      caption: 'AMS：ProcessList 创建进程和 ProcessRecord；ActiveServices / BroadcastQueue（A17 实现类 BroadcastQueueImpl）管 Service 与广播；OomAdjuster（已拆到 am/psc）决定进程优先级。ProcessRecord 与 WindowProcessController 一一对应。',
    },
    {
      to: 6, move: 1.2, hold: 7.5,
      focus: ['pms', 'computer', 'component-resolver', 'pm-settings', 'package-setting', 'install-helper', 'permission-ms'],
      caption: 'PMS：查询都在 Computer 快照上执行，避免长时间持锁；ComponentResolver 按 IntentFilter 匹配组件；Settings / PackageSetting 是包状态的持久化。',
    },
    {
      to: 7, move: 1.2, hold: 7,
      caption: '跨进程的线只有几条：IActivityTaskManager / IApplicationThread（Activity 调度），IWindowSession / IWindow（窗口）；AMS 与 ATMS 之间是进程内的 Internal 接口。',
    },
  ],
};

const wmMapConceptStory: FlowStory = {
  steps: [
    {
      to: 0, move: 1.2, hold: 7,
      focus: ['config-container', 'window-container', 'surface-animator', 'surface-control'],
      caption: 'WindowContainer 是一切窗口容器的基类：管理子节点，持有自己的 SurfaceControl（容器层），用 SurfaceAnimator 创建动画 leash。',
    },
    {
      to: 1, move: 1.2, hold: 7,
      focus: ['root-wc', 'display-area', 'root-display-area', 'display-content', 'task-display-area'],
      caption: '显示层级：RootWindowContainer（没有 surface）→ DisplayContent（继承 RootDisplayArea）→ TaskDisplayArea。橙色虚线是运行时的父子关系。',
    },
    {
      to: 2, move: 1.2, hold: 6,
      focus: ['task-fragment', 'task'],
      caption: 'Task 继承 TaskFragment：resumeTopActivity、startPausing 等调度逻辑在 TaskFragment 里。',
    },
    {
      to: 3, move: 1.2, hold: 6,
      focus: ['window-token', 'activity-record'],
      caption: 'ActivityRecord 继承 WindowToken：一个 Activity 就是它所有窗口的令牌。',
    },
    {
      to: 4, move: 1.2, hold: 7,
      focus: ['window-state', 'ws-animator'],
      caption: 'WindowState 是 system_server 里的一个窗口；绘制状态和 surface 管理交给 WindowStateAnimator——Android 17 中 WindowSurfaceController 已删除，建 surface 的逻辑并入它。',
    },
    {
      to: 5, move: 1.2, hold: 7.5,
      focus: ['activity', 'phone-window', 'wm-global', 'view-root-impl', 'vri-w', 'bbq', 'choreographer'],
      caption: '应用侧：Activity 持有 PhoneWindow；WindowManagerGlobal 为每个窗口建一个 ViewRootImpl，后者持有 W、Choreographer 和 BLASTBufferQueue。',
    },
    {
      to: 6, move: 1.2, hold: 8,
      focus: ['wms', 'session', 'view-root-impl', 'window-state', 'vri-w'],
      caption: '两侧的连接：ViewRootImpl 经 Session（IWindowSession）调 WMS；WindowState 持有 W（IWindow）回调应用。像素层归应用（BLASTBufferQueue），容器层归 WMS（WindowContainer.mSurfaceControl）。',
    },
    {
      to: 7, move: 1.2, hold: 6,
      caption: '全图：继承决定"它是什么"，持有决定"它管着谁"，运行时父子决定"它挂在哪"。',
    },
  ],
};

export const servicesMapStory = paceClassMapStory(SERVICES_MAP, servicesMapConceptStory);
export const wmMapStory = paceClassMapStory(WM_CONTAINER_MAP, wmMapConceptStory);

export const ServicesMapScene = makeClassMapScene(SERVICES_MAP, servicesMapStory, '应用进程 + system_server（ATMS / WMS / AMS / PMS）');
export const WmMapScene = makeClassMapScene(WM_CONTAINER_MAP, wmMapStory, '继承 · 持有 · 运行时父子 · binder');

/** 类级时序场景：泳道高亮聚焦类，右侧显示类详情 */
const makeClassFlowScene = (script: FlowScript, story: FlowStory): React.FC => {
  const Scene: React.FC = () => (
    <StoryScene
      story={story}
      startT={script.window[0]}
      defaultView={script.window}
      render={({frame, t, seg, local, focus, total, view}) => {
        const v = view ?? script.window;
        const span = v[1] - v[0];
        return (
          <>
            <Header title={script.title} subtitle={script.subtitle} right={`${seg.index + 1} / ${total}`} />
            <Panel x={40} y={92} w={1300} h={744}>
              <SwimlaneView
                script={script}
                t={t}
                width={1300}
                height={744}
                frame={frame}
                focus={focus}
                view={v}
                labelRecent={span * 0.35}
                animMs={span * 0.006}
              />
            </Panel>
            <Panel x={1370} y={92} w={510} h={420} pad={16}>
              <ClassInfoView id={focus[0]} />
            </Panel>
            <Panel x={1370} y={526} w={510} h={160} pad={12}>
              <ObjectBoard script={script} t={t} within={3} />
            </Panel>
            <div style={{position: 'absolute', left: 1370, top: 700, width: 510, height: 136}}>
              <CodeView key={seg.index} code={seg.step.code} localSec={local} />
            </div>
            <ArrowLegend x={44} y={844} kinds={['invoke', 'iret', 'call', 'return', 'oneway', 'post']} />
            <Caption key={`c${seg.index}`} text={seg.step.caption} localSec={local} />
          </>
        );
      }}
    />
  );
  return Scene;
};

export const StartActivityClassScene = makeClassFlowScene(startActivityClassScript, startActivityClassStory);
export const AddWindowClassScene = makeClassFlowScene(addWindowClassScript, addWindowClassStory);

/** 调用链模板：脚本 kind = 'call-chain'，默认就是 协作图 + 调用栈 + 源码 */
export const StartActivityGraphScene = makeTemplateScene({
  script: startActivityClassScript,
  story: startActivityGraphStory,
  title: '对象协作图：startActivity',
  subtitle: '同一份脚本 · 实例 / 字段 / 调用',
});
export const AddWindowGraphScene = makeTemplateScene({
  script: addWindowClassScript,
  story: addWindowGraphStory,
  title: '对象协作图：addWindow / relayout / finishDrawing',
  subtitle: '同一份脚本 · 实例 / 字段 / 调用',
});

export const KeyClassesEndingScene: React.FC = () => (
  <SummaryCard
    heading="关键类的四个要点"
    lines={[
      ['一棵共用的树', 'Task / ActivityRecord / WindowState 都挂在 RootWindowContainer 下，ATMS 与 WMS 共用'],
      ['两对 binder', 'IActivityTaskManager ↔ IApplicationThread；IWindowSession ↔ IWindow'],
      ['两份进程视图', 'AMS 的 ProcessRecord 与 ATMS 的 WindowProcessController 一一对应'],
      ['窗口的两半', 'ViewRootImpl 管应用侧，WindowState 管系统侧；像素层归应用，容器层归 WMS'],
    ]}
  />
);
