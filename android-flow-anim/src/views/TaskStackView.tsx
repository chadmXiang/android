import React from 'react';
import {getStateMachine} from '../catalog';
import type {FlowScript} from '../dsl/types';
import {eventsOf, objectStateAt, treeAt, type TreeNode} from '../engine/state';
import {clamp01, ease} from '../engine/text';
import {colors, layerColors, mono, stateColors} from '../theme';

/**
 * Task 栈视图（结构变化型模板的主视图）：
 * 把 WMS 树里某个容器（通常是 TaskDisplayArea）的子节点画成一叠卡片，越靠上 Z 序越高；
 * 每张 Task 卡片展开 ActivityRecord / WindowState 两级，并显示绑定对象的状态与窗口焦点。
 * 子节点顺序来自树事件：reparent 到同一父节点 = 挪到列表最后 = 置顶。
 */

/** 换位动画时长（模拟时间单位）；停点应在 reparent 之后 ≥ 此值 */
const MOVE_MS = 3;

export interface TaskStackProps {
  script: FlowScript;
  t: number;
  width: number;
  height: number;
  frame: number;
  /** 树 id 与作为"栈"的容器节点 */
  tree?: string;
  container?: string;
  /** 树节点 → 状态机对象（ActivityRecord 状态、mDrawState …） */
  bind?: Record<string, string>;
  title?: string;
}

const childrenOf = (nodes: Map<string, TreeNode>, pid: string) =>
  [...nodes.values()].filter((n) => n.parent === pid).sort((a, b) => a.order - b.order);

/** 栈顶在前 */
const stackOrder = (s: FlowScript, tree: string, container: string, t: number) =>
  childrenOf(treeAt(s, tree, t), container)
    .map((n) => n.id)
    .reverse();

const StateChip: React.FC<{script: FlowScript; obj?: string; t: number}> = ({script, obj, t}) => {
  if (!obj) return null;
  const st = objectStateAt(script, obj, t);
  if (!st.state) return null;
  const fresh = t - st.since < 4;
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: mono, fontSize: 12}}>
      {fresh && st.prev && <span style={{color: colors.muted}}>{st.prev} →</span>}
      <span
        style={{
          fontWeight: 800,
          padding: '1px 7px',
          borderRadius: 5,
          background: stateColors[st.state] ?? '#0e7490',
          boxShadow: fresh ? `0 0 10px ${colors.info}` : undefined,
        }}
      >
        {st.state}
      </span>
    </span>
  );
};

export const TaskStackView: React.FC<TaskStackProps> = ({
  script,
  t,
  width,
  height,
  frame,
  tree = 'wm',
  container = 'wm:tda',
  bind = {},
  title = 'TaskDisplayArea 的子节点（越靠上 Z 序越高）',
}) => {
  const nodes = treeAt(script, tree, t);
  const order = stackOrder(script, tree, container, t);

  // 最近一次影响栈顺序的事件：用于"抽出 → 放到最上面"的动画
  const lastMove = eventsOf(script, 'tree')
    .filter((e) => e.tree === tree && e.at <= t && (e.parent === container || nodes.get(e.node)?.parent === container))
    .reduce((m, e) => Math.max(m, e.at), -Infinity);
  const p = ease(clamp01((t - lastMove) / MOVE_MS));
  const prevOrder = p < 1 ? stackOrder(script, tree, container, lastMove - 1e-6) : order;
  const moved = new Set(order.filter((id, i) => prevOrder.indexOf(id) !== i && prevOrder.includes(id)));

  const top = 54;
  const gap = 18;
  const n = Math.max(order.length, 1);
  const cardH = Math.min(220, (height - top - 20 - gap * (n - 1)) / n);
  const cardW = width - 150;
  const yOf = (i: number) => top + i * (cardH + gap);
  const breathe = 0.5 + 0.5 * Math.sin(frame / 6);

  // 焦点窗口：树节点 note 里写着"焦点窗口"
  const focusWin = [...nodes.values()].find((x) => x.note === '焦点窗口')?.id;

  return (
    <div style={{position: 'relative', width, height}}>
      <div style={{position: 'absolute', left: 20, top: 14, fontSize: 18, fontWeight: 700, color: layerColors.system_server}}>{title}</div>
      {/* Z 轴 */}
      <div style={{position: 'absolute', left: 22, top: top, height: yOf(n - 1) + cardH - top, width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{fontSize: 13, color: colors.muted}}>Z 高</div>
        <div style={{flex: 1, width: 2, background: `linear-gradient(${colors.info}, transparent)`, margin: '4px 0'}} />
        <div style={{fontSize: 13, color: colors.muted}}>Z 低</div>
      </div>
      {order.map((id, i) => {
        const task = nodes.get(id)!;
        const pi = prevOrder.indexOf(id);
        const fromY = pi >= 0 ? yOf(pi) : yOf(i);
        const y = fromY + (yOf(i) - fromY) * p;
        const lift = moved.has(id) ? Math.sin(Math.PI * p) * 70 : 0;
        const isTop = i === 0;
        const ars = childrenOf(nodes, id);
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: 100 + lift,
              top: y,
              width: cardW,
              height: cardH,
              boxSizing: 'border-box',
              padding: '12px 18px',
              borderRadius: 14,
              background: isTop ? '#1b2436' : colors.panel2,
              border: `2px solid ${moved.has(id) && p < 1 ? colors.info : isTop ? layerColors.system_server : colors.border}`,
              boxShadow: isTop ? `0 10px 30px rgba(0,0,0,0.5)` : undefined,
              opacity: isTop ? 1 : 0.82,
              zIndex: moved.has(id) ? 10 : n - i,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'hidden',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <span style={{fontSize: 20, fontWeight: 800}}>{task.label}</span>
              <span style={{fontFamily: mono, fontSize: 12, color: colors.muted}}>子节点 #{order.length - 1 - i}</span>
              {isTop && (
                <span style={{marginLeft: 'auto', fontSize: 13, padding: '2px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.18)', color: layerColors.system_server}}>
                  栈顶 · 前台 Task
                </span>
              )}
              {task.note && <span style={{fontSize: 13, color: colors.muted}}>{task.note}</span>}
            </div>
            {ars.map((ar) => (
              <div key={ar.id} style={{marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 6}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 15}}>
                  <span style={{color: '#cbd5e1'}}>└ {ar.label}</span>
                  <StateChip script={script} obj={bind[ar.id]} t={t} />
                </div>
                {childrenOf(nodes, ar.id).map((ws) => {
                  const focused = ws.id === focusWin;
                  return (
                    <div key={ws.id} style={{marginLeft: 22, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14}}>
                      <span style={{color: colors.muted}}>└ {ws.label}</span>
                      {bind[ws.id] && (
                        <span style={{fontSize: 11, color: colors.muted}}>
                          {getStateMachine(script.objects?.find((o) => o.id === bind[ws.id])?.stateMachine ?? 'draw-state').title.split('.').pop()}
                        </span>
                      )}
                      <StateChip script={script} obj={bind[ws.id]} t={t} />
                      {focused ? (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            padding: '2px 10px',
                            borderRadius: 10,
                            background: colors.pink,
                            color: '#111',
                            boxShadow: `0 0 ${8 + 10 * breathe}px ${colors.pink}`,
                          }}
                        >
                          ◎ 输入焦点
                        </span>
                      ) : (
                        ws.note && <span style={{fontSize: 12, color: colors.muted}}>{ws.note}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
