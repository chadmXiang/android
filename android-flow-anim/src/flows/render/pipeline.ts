import {layerColors} from '../../theme';
import type {PipelineConfig} from '../../views/PipelineView';

/** 一帧渲染的流水线视图配置（视频与浏览页共用） */
export const FRAME_PIPELINE: PipelineConfig = {
  groups: [
    {id: 'app', label: 'App 进程', color: layerColors.app},
    {id: 'sf', label: 'surfaceflinger 进程', color: layerColors.native},
    {id: 'hw', label: '显示硬件', color: layerColors.hw},
  ],
  stages: [
    {id: 'ui', label: 'UI 线程', sub: 'CPU · measure / layout / draw', lanes: ['ui'], group: 'app'},
    {id: 'rt', label: 'RenderThread', sub: 'CPU · GL/VK 指令', lanes: ['rt'], group: 'app'},
    {id: 'gpu', label: 'GPU', sub: '异步写像素（不听 VSYNC）', lanes: ['gpu'], group: 'app'},
    {id: 'bbq', label: 'BLASTBufferQueue', sub: '仍在 App 进程', lanes: ['bbq'], group: 'app'},
    {id: 'sf', label: 'SF 主线程', sub: '就绪判定 · latch · 合成', lanes: ['sf'], group: 'sf'},
    {id: 'disp', label: 'HWC / 屏幕', sub: '扫出', lanes: ['disp'], group: 'hw'},
  ],
  handoffs: [
    {after: 'gpu', label: '①', desc: '出帧：buffer + fence 进 BufferQueue'},
    {after: 'bbq', label: '②', desc: 'acquire 后包成 setBuffer 事务 → binder'},
    {after: 'sf', label: '③', desc: 'present：HWC / 显示控制器扫出'},
  ],
  returns: [
    {from: 'sf', to: 'bbq', label: 'release fence → slot 变 FREE', match: 'release'},
    {from: 'disp', to: 'sf', label: 'present fence → 校准 VSYNC 模型', match: 'present fence'},
  ],
  displayStage: 'disp',
};
