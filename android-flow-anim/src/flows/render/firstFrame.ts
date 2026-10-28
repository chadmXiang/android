import {batch, call, span} from '../../dsl/builders';
import type {Fragment} from '../../engine/resolve';

/**
 * 首帧子流程：时间从 0 开始；泳道占位
 *   $main 应用主线程   $rt RenderThread   $wms WMS 入口（binder 线程）   $sf SurfaceFlinger
 * 上一个视频「一帧是怎么渲染出来的」的压缩版，加上首帧特有的 relayout / finishDrawing。
 */
export const firstFrameFragment: Fragment = {
  id: 'first-frame',
  title: '首帧（render/first-frame）',
  events: [
    span('$main', 0, 2, 'doFrame · TRAVERSAL', 'cpu', {frame: '首帧'}),
    call(2, '$main', '$wms', 'relayout', 10),
    span('$wms', 2, 10, 'relayoutWindow · reparent buffer 层', 'cpu'),
    span('$main', 10, 46, '首次 measure / layout / draw', 'cpu', {frame: '首帧'}),
    span('$rt', 46, 62, '首帧 · dequeue / GPU / queue', 'cpu', {frame: '首帧'}),
    batch(62, '$rt', '$sf', 'setBuffer(首帧)'),
    call(66, '$main', '$wms', 'finishDrawing', 70),
    span('$wms', 66, 70, 'WindowState 已绘制', 'cpu'),
  ],
};
