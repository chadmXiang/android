import {attr, node, remove, reparent, screen, state} from '../../dsl/builders';
import type {FlowScript, FlowStory} from '../../dsl/types';

/**
 * 时间单位只是逻辑刻度（不是真实 ms）。
 * 树动画时长 1.5，所以分镜停点都放在最后一个树事件之后 ≥ 2。
 */
export const surfaceTreeScript: FlowScript = {
  id: 'surface-tree',
  kind: 'mapping',
  title: '窗口层级：WMS 容器树 ↔ SF Layer 树',
 subtitle: '窗口容器层级、SurfaceControl 与 Shell leash',
  window: [-5, 70],
  lanes: [],
  resources: [],
  objects: [{id: 'transition', label: 'Transition #1', stateMachine: 'transition'}],
  trees: [
    {id: 'wm', title: 'WMS 容器树（system_server）', root: 'wm:root'},
    {id: 'sf', title: 'SF Layer 树（surfaceflinger）', root: 'sf:display'},
  ],
  events: [
    // 初始：只有 Launcher
    node(-10, 'wm', 'wm:root', 'RootWindowContainer（无 surface）', null, 'root'),
    node(-10, 'wm', 'wm:dc', 'DisplayContent', 'wm:root', 'container', 'sf:display'),
    node(-10, 'wm', 'wm:tda', 'TaskDisplayArea', 'wm:dc', 'container', 'sf:tda'),
    node(-10, 'wm', 'wm:task-l', 'Task · Launcher', 'wm:tda', 'container', 'sf:task-l'),
    node(-10, 'wm', 'wm:ar-l', 'ActivityRecord · Launcher', 'wm:task-l', 'container', 'sf:ar-l'),
    node(-10, 'wm', 'wm:ws-l', 'WindowState · Launcher', 'wm:ar-l', 'container', 'sf:ws-l'),

    node(-10, 'sf', 'sf:display', 'Display（layerStack）', null, 'root'),
    node(-10, 'sf', 'sf:tda', 'TaskDisplayArea', 'sf:display', 'container'),
    node(-10, 'sf', 'sf:task-l', 'Task · Launcher', 'sf:tda', 'container'),
    node(-10, 'sf', 'sf:ar-l', 'ActivityRecord · Launcher', 'sf:task-l', 'container'),
    node(-10, 'sf', 'sf:ws-l', 'WindowState · Launcher', 'sf:ar-l', 'container'),
    node(-10, 'sf', 'sf:buf-l', 'Launcher buffer 层（BBQ）', 'sf:ws-l', 'buffer'),
    screen(-10, 'launcher'),
    state(-10, 'transition', 'PENDING'),

    // 打开 com.foo：收集参与者，WMS 建容器（每个容器带自己的 SF 容器层）
    state(10, 'transition', 'COLLECTING'),
    node(10, 'wm', 'wm:task-f', 'Task · com.foo', 'wm:tda', 'container', 'sf:task-f'),
    node(10, 'sf', 'sf:task-f', 'Task · com.foo', 'sf:tda', 'container'),
    node(12, 'wm', 'wm:ar-f', 'ActivityRecord · com.foo', 'wm:task-f', 'container', 'sf:ar-f'),
    node(12, 'sf', 'sf:ar-f', 'ActivityRecord · com.foo', 'sf:task-f', 'container'),
    node(14, 'wm', 'wm:ws-f', 'WindowState · com.foo', 'wm:ar-f', 'container', 'sf:ws-f'),
    node(14, 'sf', 'sf:ws-f', 'WindowState · com.foo', 'sf:ar-f', 'container'),

    // use_client_surface：应用自建 buffer 层，NOT_ADD_TO_ROOT
    node(20, 'sf', 'sf:buf-f', 'com.foo buffer 层（BBQ）', null, 'buffer'),

    // WMS 在 relayout 里 reparent 到 WindowState 容器下
    reparent(30, 'sf', 'sf:buf-f', 'sf:ws-f'),
    state(31, 'transition', 'STARTED'),

    // 就绪 → PLAYING：Task 放进 leash，Shell 只改 leash
    state(40, 'transition', 'PLAYING'),
    node(40, 'sf', 'sf:leash', 'animation leash', 'sf:tda', 'leash'),
    reparent(41, 'sf', 'sf:task-f', 'sf:leash'),
    screen(41, 'app-opening'),
    attr(44, 'sf', 'sf:leash', 'alpha 0→1 · scale 0.9→1'),

    // 结束：回到原层级，leash 销毁
    reparent(60, 'sf', 'sf:task-f', 'sf:tda'),
    remove(61, 'sf', 'sf:leash'),
    state(61, 'transition', 'FINISHED'),
    screen(61, 'app'),
  ],
};

export const surfaceTreeStory: FlowStory = {
  steps: [
    {
      to: 0,
      move: 1.5,
      hold: 5,
      caption:
        'WMS 的每个 WindowContainer 都有一个容器 SurfaceControl，于是 SF 里有一棵同构的 Layer 树（虚线是一一对应）；RootWindowContainer 没有 surface。',
      code: {
        file: 'wm/WindowContainer.java:2565-2579',
        note: 'makeSurface 向上问父，父的 makeChildSurface\n.setParent(mSurfaceControl)；挂树时机是\nonParentChanged → createSurfaceControl（:686 / :700-704）。',
      },
    },
    {
      to: 16,
      move: 3,
      hold: 4.5,
      caption: '打开 com.foo：Transition 开始收集，WMS 依次建出 Task / ActivityRecord / WindowState，每个容器都带着自己的 SF 容器层。',
      code: {
        file: 'wm/TransitionController.java:408-420 · wm/Transition.java:861-872',
        note: 'createTransition → startCollecting；\n参与者由 BLASTSyncEngine 收集（Transition.java:903）。',
      },
    },
    {
      to: 22,
      move: 2,
      hold: 5,
      caption: 'use_client_surface：应用在 relayout 时自建 buffer 层，带 NOT_ADD_TO_ROOT——先不挂到任何父节点上。',
      code: {
        file: 'view/ViewRootImpl.java:10083 · :10108-10133',
        note: 'cp2a 渠道 ENABLED / READ_ONLY。\n服务端老路径 createSurfaceLocked 直接返回 null\n（wm/WindowStateAnimator.java:287-291）。',
      },
    },
    {
      to: 32,
      move: 2,
      hold: 5.5,
      caption: 'WMS 在 relayout 里把它 reparent 到 WindowState 容器下：像素层归应用，容器层归 WMS。',
      code: {
        file: 'wm/WindowState.java:3431-3433',
        snippet: 'mWinAnimator.mSurfaceControl = ...;\ngetPendingTransaction().reparent(surface, mSurfaceControl);',
        note: '应用只能往自己的层塞 buffer；\n位置 / 层级 / 可见性永远由 WMS 说话。',
      },
    },
    {
      to: 46,
      move: 3,
      hold: 6,
      caption:
        '所有参与者画完，Transition 进入 PLAYING。Task 被放进 leash，Shell 每帧只改 leash 的 alpha / scale，直接向 SF 提事务，不经过 WMS。',
      code: {
        file: 'shell/transition/Transitions.java:1068-1069 · DefaultTransitionHandler.java:676',
        note: '过渡期间 WMS 不许改层（canAssignLayers，\nwm/WindowContainer.java:2616），避免和 Shell 抢同一层的 Z 序。',
      },
    },
    {
      to: 63,
      move: 3,
      hold: 5,
      caption: '动画结束：finishTransition，Task 回到原层级，leash 销毁。整个过程中 Shell 拿不到层级结构，只能动 leash。',
      code: {
        file: 'shell/transition/Transitions.java:1303-1306 · wm/Transition.java:1317-1331',
        note: 'fullFinish.apply → finishTransition；\nWMS 把参与者 reparent 回原层级。',
      },
    },
  ],
};
