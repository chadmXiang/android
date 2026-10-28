import {addWindowClassScript, addWindowClassStory, addWindowGraphStory} from '../flows/classes/addWindow';
import {startActivityClassScript, startActivityClassStory, startActivityGraphStory} from '../flows/classes/startActivity';
import {frameScript, frameStory, pipelineStory} from '../flows/render/frame';
import {compareStory, doubleScript, tripleScript} from '../flows/render/tripleBuffer';
import {appLaunchScript, launchStory, launchTreeStory} from '../flows/system/appLaunch';
import {bootGridStory, bootScript, bootStory} from '../flows/system/boot';
import {homeInputStory, homeKeyScript, homeStory, homeTemplateStory, homeTreeStory} from '../flows/system/homeKey';
import {surfaceTreeScript, surfaceTreeStory} from '../flows/wm/surfaceTree';
import {serviceAnrScript, serviceAnrStateStory, serviceCompareStory, serviceStartScript} from '../flows/am/serviceStart';
import {FRAME_PIPELINE} from '../flows/render/pipeline';
import {imeKeyScript} from '../flows/input/imeKey';
import {BOOT_GRAPH_SETS, bootFullScript} from '../flows/boot/bootFull';
import * as BT from '../flows/boot/stories';
import {inputFlowScript} from '../flows/input/inputFlow';
import * as IN from '../flows/input/stories';
import {COLD_LAUNCH_GRAPH_SETS, COLD_LAUNCH_TASK_BIND, coldLaunchScript} from '../flows/launch/coldLaunch';
import {appStory, dumpsysStory, lifecycleStory, processStory, systemServerStory, zygoteStory} from '../flows/launch/stories';
import type {FlowScript, FlowStory, TemplateKind} from '../dsl/types';
import type {SlotOptions} from '../layouts/slots';

/** 浏览页里的一条流程：脚本 + 可选的分镜（用作"章节书签"）+ 视图配置 */
export interface ExplorerEntry {
  script: FlowScript;
  group: string;
  stories: {name: string; story: FlowStory}[];
  options?: SlotOptions;
  /** 覆盖 script.kind（决定默认视图） */
  kind?: TemplateKind;
  /** 对比条目：B 脚本，与 script 共用时间轴 */
  compare?: FlowScript;
}

export const ENTRIES: ExplorerEntry[] = [
  {
    group: '开机',
    script: bootFullScript,
    stories: [
      {name: '① 进程维度', story: BT.bootProcessStory},
      {name: '② init', story: BT.bootInitStory},
      {name: '② zygote', story: BT.bootZygoteStory},
      {name: '② system_server', story: BT.bootSystemServerStory},
      {name: '③ 阶段', story: bootGridStory},
      {name: '④ adb 可观测', story: BT.bootPropsStory},
    ],
    options: {graphSets: BOOT_GRAPH_SETS},
  },
  {
    group: '输入',
    script: inputFlowScript,
    stories: [
      {name: '整体（进程）', story: IN.inputOverviewStory},
      {name: '① 建立通道', story: IN.inputChannelStory},
      {name: '② InputReader', story: IN.inputReaderStory},
      {name: '③ 分发标准', story: IN.inputDispatchStory},
      {name: '④ 应用 InputStage', story: IN.inputAppStory},
      {name: '⑤ View 树', story: IN.inputViewTreeStory},
    ],
    options: {graphSets: IN.INPUT_GRAPH_SETS, dispatchRules: IN.INPUT_DISPATCH_RULES, viewTree: IN.INPUT_VIEW_TREE},
  },
  {
    group: '输入',
    script: imeKeyScript,
    stories: [
      {name: '整体', story: IN.imeOverviewStory},
      {name: '输入法内部', story: IN.imeGraphStory},
    ],
    options: {graphSets: IN.INPUT_GRAPH_SETS},
  },
  {
    group: '冷启动',
    script: coldLaunchScript,
    stories: [
      {name: '① 进程维度', story: processStory},
      {name: '② system_server 内部', story: systemServerStory},
      {name: '② zygote → 新进程', story: zygoteStory},
      {name: '② com.foo 内部', story: appStory},
      {name: '③ 生命周期', story: lifecycleStory},
      {name: '④ dumpsys', story: dumpsysStory},
    ],
    options: {
      graphSets: COLD_LAUNCH_GRAPH_SETS,
      taskStack: {bind: COLD_LAUNCH_TASK_BIND},
      lifecycle: {
        rows: [
          {title: 'Launcher', sub: 'com.android.launcher3 · 桌面', color: '#60a5fa', client: 'l-life', server: 'ar-l', windowNode: 'wm:ws-l', visibleUntil: 494},
          {title: 'com.foo', sub: 'MainActivity · 新进程', color: '#4ade80', client: 'f-life', server: 'ar', windowNode: 'wm:ws-f', visibleWhenDrawn: 'wsa'},
        ],
        milestones: ['首帧可见', '焦点窗口 → com.foo'],
      },
    },
  },
  {group: 'AMS', script: serviceAnrScript, stories: [{name: '状态驱动', story: serviceAnrStateStory}]},
  {group: 'AMS', script: serviceStartScript, stories: [{name: '状态驱动', story: serviceAnrStateStory}]},
  {
    group: '对比',
    kind: 'compare',
    script: {...serviceStartScript, id: 'cmp-service', title: '对比：Service 正常 vs ANR'},
    compare: serviceAnrScript,
    stories: [{name: '正常 vs ANR', story: serviceCompareStory}],
  },
  {group: '类级', script: startActivityClassScript, stories: [{name: '协作图停点', story: startActivityGraphStory}, {name: '泳道停点', story: startActivityClassStory}]},
  {group: '类级', script: addWindowClassScript, stories: [{name: '协作图停点', story: addWindowGraphStory}, {name: '泳道停点', story: addWindowClassStory}]},
  {
    group: '系统流程',
    script: homeKeyScript,
    stories: [
      {name: '分阶段模板', story: homeTemplateStory},
      {name: '全链路', story: homeStory},
      {name: '输入管线', story: homeInputStory},
      {name: '双树', story: homeTreeStory},
    ],
    options: {taskStack: {bind: {'wm:ar-f': 'ar-foo', 'wm:ar-l': 'ar-launcher', 'wm:ws-l': 'draw'}}},
  },
  {
    group: '系统流程',
    script: appLaunchScript,
    stories: [
      {name: '全链路', story: launchStory},
      {name: '窗口层级', story: launchTreeStory},
    ],
    options: {taskStack: {bind: {'wm:ar-f': 'ar-foo', 'wm:ar-l': 'ar-launcher', 'wm:ws-f': 'draw'}}},
  },
  {
    group: '系统流程',
    script: bootScript,
    stories: [
      {name: '全链路', story: bootStory},
      {name: '服务网格', story: bootGridStory},
    ],
  },
  {
    group: '渲染',
    options: {pipeline: FRAME_PIPELINE},
    script: frameScript,
    stories: [
      {name: '一帧', story: frameStory},
      {name: '管线', story: pipelineStory},
    ],
  },
  // 这两份脚本在视频里由对比场景自带标题，title 为空，这里补上
  {
    group: '对比',
    kind: 'compare',
    script: {...tripleScript, title: '对比：三缓冲 vs 双缓冲'},
    compare: {...doubleScript, title: '双缓冲'},
    stories: [{name: '3 块 vs 2 块', story: compareStory}],
  },
  {group: '窗口', script: surfaceTreeScript, stories: [{name: 'WMS ↔ SF', story: surfaceTreeStory}]},
];
