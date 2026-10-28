import {batch, check, jank, mark, msg, res, sig, span} from '../../dsl/builders';
import type {FlowScript, FlowStory, LaneDef} from '../../dsl/types';

const LANES: LaneDef[] = [
  {id: 'ui', label: 'UI 线程', component: 'choreographer'},
  {id: 'rt', label: 'RenderThread', component: 'hwui'},
  {id: 'gpu', label: 'GPU', component: 'gpu'},
  {id: 'bbq', label: 'BufferQueue', component: 'bbq'},
  {id: 'sf', label: 'SF 主线程', component: 'sf-ce'},
  {id: 'disp', label: '屏幕', component: 'hwc'},
];

const base = (id: string, maxDequeued: number) => ({
  id,
  title: '',
  window: [-2, 70] as [number, number],
  clockProfile: 'default-60',
  vsyncLanes: {app: 'ui', sf: 'sf'},
  pool: {def: 'bufferqueue', params: {maxDequeued, maxAcquired: 1}},
  lanes: LANES,
});

export const tripleScript: FlowScript = {
  ...base('triple', 2),
  resources: [
    {id: 'A', label: 'A'},
    {id: 'B', label: 'B'},
    {id: 'C', label: 'C'},
  ],
  events: [
    res('C', -100, 'ACQUIRED', 'sf'),
    res('A', -100, 'FREE', 'bbq'),
    res('B', -100, 'FREE', 'bbq'),
    span('disp', -2, 33.33, 'N-1', 'display', {resource: 'C', frame: 'N-1'}),
    span('disp', 33.33, 66.67, 'N', 'display', {resource: 'A', frame: 'N'}),
    jank(50, 'disp', '重复 N'),
    span('disp', 66.67, 70, 'N+1', 'display', {resource: 'B', frame: 'N+1'}),

    // N
    span('ui', 1, 6, 'doFrame N', 'cpu', {frame: 'N'}),
    res('A', 5.5, 'DEQUEUED', 'rt'),
    span('rt', 5.5, 10, '录 N', 'cpu', {resource: 'A', frame: 'N'}),
    res('A', 10, 'QUEUED', 'bbq'),
    sig('fA', 'acquire-fence', 'A', 10, 15.5),
    span('gpu', 10, 15.5, 'N', 'gpu', {resource: 'A', frame: 'N'}),
    batch(10.8, 'bbq', 'sf', 'setBuffer(A)'),
    span('sf', 17.67, 22.5, 'latch + 合成 N', 'sf', {resource: 'A', frame: 'N'}),
    check(18, 'sf', 'fA', 'fence'),
    res('A', 18.2, 'ACQUIRED', 'sf'),
    res('C', 23, 'FREE', 'bbq'),
    sig('rC', 'release-fence', 'C', 23, 33.33),
    msg(23, 'sf', 'bbq', 'release'),

    // N+1（GPU 慢）
    span('ui', 17.67, 22, 'doFrame N+1', 'cpu', {frame: 'N+1'}),
    res('B', 22, 'DEQUEUED', 'rt'),
    span('rt', 22, 27, '录 N+1', 'cpu', {resource: 'B', frame: 'N+1'}),
    res('B', 27, 'QUEUED', 'bbq'),
    sig('fB', 'acquire-fence', 'B', 27, 40),
    span('gpu', 27, 40, 'N+1（慢 13ms）', 'gpu', {resource: 'B', frame: 'N+1'}),
    batch(27.8, 'bbq', 'sf', 'setBuffer(B)'),
    span('sf', 34.33, 35.6, '查', 'sf'),
    check(34.8, 'sf', 'fB', 'fence'),

    // N+2：第三块 C 让应用照常开工
    span('ui', 34.33, 38.5, 'doFrame N+2', 'cpu', {frame: 'N+2'}),
    res('C', 38.5, 'DEQUEUED', 'rt'),
    span('rt', 38.5, 43.5, '录 N+2', 'cpu', {resource: 'C', frame: 'N+2'}),
    res('C', 43.5, 'QUEUED', 'bbq'),
    sig('fC', 'acquire-fence', 'C', 43.5, 49),
    span('gpu', 43.5, 49, 'N+2', 'gpu', {resource: 'C', frame: 'N+2'}),
    batch(44.3, 'bbq', 'sf', 'setBuffer(C)'),

    // SF 处理 N+1
    span('sf', 51, 55, 'latch + 合成 N+1', 'sf', {resource: 'B', frame: 'N+1'}),
    check(51.2, 'sf', 'fB', 'fence'),
    res('B', 51.5, 'ACQUIRED', 'sf'),
    res('A', 55.3, 'FREE', 'bbq'),
    sig('rA', 'release-fence', 'A', 55.3, 66.67),
    msg(55.3, 'sf', 'bbq', 'release'),

    // N+3：拿到 A，但 GPU 要等 A 下屏（release fence）
    span('ui', 51, 55.3, 'doFrame N+3', 'cpu', {frame: 'N+3'}),
    res('A', 55.6, 'DEQUEUED', 'rt'),
    span('rt', 55.6, 60.5, '录 N+3', 'cpu', {resource: 'A', frame: 'N+3'}),
    res('A', 60.5, 'QUEUED', 'bbq'),
    sig('fA3', 'acquire-fence', 'A', 60.5, 72),
    span('gpu', 60.5, 66.67, '等 release fence', 'wait', {resource: 'A'}),
    span('gpu', 66.67, 70, 'N+3', 'gpu', {resource: 'A', frame: 'N+3'}),
    batch(61.3, 'bbq', 'sf', 'setBuffer(A)'),
    span('sf', 67.67, 70, 'latch + 合成 N+2', 'sf', {resource: 'C', frame: 'N+2'}),
    check(67.9, 'sf', 'fC', 'fence'),
    res('C', 68.2, 'ACQUIRED', 'sf'),
  ],
};

export const doubleScript: FlowScript = {
  ...base('double', 1),
  resources: [
    {id: 'A', label: 'A'},
    {id: 'C', label: 'C'},
  ],
  events: [
    res('C', -100, 'ACQUIRED', 'sf'),
    res('A', -100, 'FREE', 'bbq'),
    span('disp', -2, 33.33, 'N-1', 'display', {resource: 'C', frame: 'N-1'}),
    span('disp', 33.33, 66.67, 'N', 'display', {resource: 'A', frame: 'N'}),
    jank(50, 'disp', '重复 N'),
    span('disp', 66.67, 70, 'N+1', 'display', {resource: 'C', frame: 'N+1'}),

    // N
    span('ui', 1, 6, 'doFrame N', 'cpu', {frame: 'N'}),
    res('A', 5.5, 'DEQUEUED', 'rt'),
    span('rt', 5.5, 10, '录 N', 'cpu', {resource: 'A', frame: 'N'}),
    res('A', 10, 'QUEUED', 'bbq'),
    sig('fA', 'acquire-fence', 'A', 10, 15.5),
    span('gpu', 10, 15.5, 'N', 'gpu', {resource: 'A', frame: 'N'}),
    batch(10.8, 'bbq', 'sf', 'setBuffer(A)'),
    span('sf', 17.67, 22.5, 'latch + 合成 N', 'sf', {resource: 'A', frame: 'N'}),
    check(18, 'sf', 'fA', 'fence'),
    res('A', 18.2, 'ACQUIRED', 'sf'),
    res('C', 23, 'FREE', 'bbq'),
    sig('rC', 'release-fence', 'C', 23, 33.33),
    msg(23, 'sf', 'bbq', 'release'),

    // N+1：刚释放的 C 立即被拿走，但 GPU 要等它下屏
    span('ui', 17.67, 22, 'doFrame N+1', 'cpu', {frame: 'N+1'}),
    span('rt', 22, 23.1, '等', 'wait'),
    res('C', 23.1, 'DEQUEUED', 'rt'),
    span('rt', 23.1, 28, '录 N+1', 'cpu', {resource: 'C', frame: 'N+1'}),
    res('C', 28, 'QUEUED', 'bbq'),
    sig('fC', 'acquire-fence', 'C', 28, 46.3),
    span('gpu', 28, 33.33, '等 release fence', 'wait', {resource: 'C'}),
    span('gpu', 33.33, 46.3, 'N+1（慢 13ms）', 'gpu', {resource: 'C', frame: 'N+1'}),
    batch(28.8, 'bbq', 'sf', 'setBuffer(C)'),
    span('sf', 34.33, 35.6, '查', 'sf'),
    check(34.8, 'sf', 'fC', 'fence'),

    // N+2：没有空闲 buffer，RenderThread 卡死
    span('ui', 34.33, 38.5, 'doFrame N+2', 'cpu', {frame: 'N+2'}),
    span('rt', 38.5, 55.3, 'dequeueBuffer 阻塞 16.8ms', 'wait'),
    mark(40, 'rt', '无空闲 buffer', 'bad'),

    span('sf', 51, 55, 'latch + 合成 N+1', 'sf', {resource: 'C', frame: 'N+1'}),
    check(51.2, 'sf', 'fC', 'fence'),
    res('C', 51.5, 'ACQUIRED', 'sf'),
    res('A', 55.3, 'FREE', 'bbq'),
    sig('rA', 'release-fence', 'A', 55.3, 66.67),
    msg(55.3, 'sf', 'bbq', 'release'),

    res('A', 55.4, 'DEQUEUED', 'rt'),
    span('rt', 55.4, 60.3, '录 N+2（晚一周期）', 'cpu', {resource: 'A', frame: 'N+2'}),
    res('A', 60.3, 'QUEUED', 'bbq'),
    sig('fA2', 'acquire-fence', 'A', 60.3, 72),
    span('gpu', 60.3, 66.67, '等 release fence', 'wait', {resource: 'A'}),
    span('gpu', 66.67, 70, 'N+2', 'gpu', {resource: 'A', frame: 'N+2'}),
    batch(61.1, 'bbq', 'sf', 'setBuffer(A)'),

    // 连锁：N+3 的 UI 线程等 RenderThread，RenderThread 又等 buffer
    span('ui', 51, 54, 'doFrame N+3', 'cpu', {frame: 'N+3'}),
    span('ui', 54, 60.3, '等 RenderThread', 'wait'),
    span('rt', 60.3, 70, 'N+3 再次等 buffer', 'wait'),
    mark(62, 'rt', 'N+3 被挤掉', 'bad'),
    span('sf', 67.67, 69, '查', 'sf'),
    check(68, 'sf', 'fA2', 'fence'),
  ],
};

export const compareStory: FlowStory = {
  steps: [
    {
      to: 0,
      move: 1.5,
      hold: 6,
      caption: '① 同一个场景跑两遍：第 N+1 帧 GPU 慢了 13ms。上：3 块（1 acquired + 2 dequeued）；下：2 块（双缓冲）。',
    },
    {
      to: 29,
      move: 5,
      hold: 6,
      caption: '② N+1 开工：双缓冲下只能拿刚释放的 C，而屏幕还在扫它（黄旗），GPU 只能先等 release fence。',
    },
    {
      to: 36,
      move: 3,
      hold: 6,
      caption: '③ SF 醒来：两边的 fence 都没 signal，屏幕重复第 N 帧——这一帧谁也救不了。',
    },
    {
      to: 41,
      move: 2,
      hold: 7,
      focus: ['C'],
      caption: '④ 关键时刻：上方还有第三块 C 可以 dequeue，N+2 照常开工；下方 A 在 SF、C 在排队，RenderThread 卡死在 dequeueBuffer。',
    },
    {
      to: 57,
      move: 4,
      hold: 6,
      caption: '⑤ 要等 SF 合成完 N+1 才放回 A：下方阻塞 16.8ms，N+2 整整晚了一个周期。',
    },
    {
      to: 70,
      move: 4,
      hold: 7,
      caption:
        '⑥ 连锁反应：下方 N+3 再次拿不到 buffer。第三块 buffer 用一帧延迟和一块显存，换来对 GPU 抖动的吸收；但不管几块，GPU 都要等屏幕停止扫描后才能写。',
    },
  ],
};
