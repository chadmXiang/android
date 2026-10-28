import type {PoolDef} from './types';

export const POOLS: PoolDef[] = [
  {
    id: 'bufferqueue',
    title: 'BufferQueue（BLAST，应用进程内）',
    stateMachine: 'buffer-slot',
    freeState: 'FREE',
    quotas: [
      {state: 'DEQUEUED', param: 'maxDequeued', code: 'hwui/renderthread/CanvasContext.cpp:213-214'},
      {
        state: 'ACQUIRED',
        param: 'maxAcquired',
        allowExtra: 1,
        code: 'sf/SurfaceFlinger.cpp:9312-9320 · 豁免 gui/BufferQueueConsumer.cpp:104-115',
      },
    ],
    onExhausted: {wait: 'dequeueBuffer', code: 'gui/BufferQueueProducer.cpp:438'},
  },
  {
    id: 'input-events',
    title: 'KeyEvent（硬件按键）',
    stateMachine: 'key-event',
    freeState: 'NONE',
    quotas: [],
    onExhausted: {wait: '-'},
  },
];
