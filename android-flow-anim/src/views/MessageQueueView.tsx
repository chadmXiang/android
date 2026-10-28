import React from 'react';
import type {FlowScript} from '../dsl/types';
import {activeSpan, eventsOf} from '../engine/state';
import {colors, mono} from '../theme';

/** 某个线程的 Looper：正在处理什么 + 队列里排着哪些 post 进来的消息 */
export const MessageQueueView: React.FC<{script: FlowScript; lane: string; t: number}> = ({script, lane, t}) => {
  const laneDef = script.lanes.find((l) => l.id === lane);
  const pending = eventsOf(script, 'post')
    .filter((p) => p.to === lane && p.at <= t && p.handledAt > t)
    .sort((a, b) => a.at - b.at);
  const cur = activeSpan(script, [lane], t);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 8, height: '100%'}}>
      <div style={{fontSize: 16, fontWeight: 700}}>{laneDef?.label ?? lane} · Looper / MessageQueue</div>
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <div
          style={{
            width: 190,
            flexShrink: 0,
            padding: '6px 10px',
            borderRadius: 8,
            border: `2px solid ${cur ? colors.cpu : colors.border}`,
            fontSize: 13,
          }}
        >
          <div style={{color: colors.muted, fontSize: 11}}>正在处理</div>
          <div style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
            {cur ? cur.label : '空闲（epoll 等待）'}
          </div>
        </div>
        <div style={{color: colors.muted}}>◀</div>
        {pending.length === 0 && <div style={{fontSize: 13, color: colors.muted}}>队列为空</div>}
        {pending.map((p, i) => (
          <div
            key={i}
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(192,132,252,0.18)',
              border: '1px solid #c084fc',
              fontFamily: mono,
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            <div>{p.msg}</div>
            <div style={{color: colors.muted, fontSize: 10}}>已等 {(t - p.at).toFixed(0)}ms</div>
          </div>
        ))}
      </div>
    </div>
  );
};
