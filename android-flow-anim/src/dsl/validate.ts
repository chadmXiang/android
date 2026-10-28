import {getPool, getStateMachine} from '../catalog';
import {hasClass} from '../catalog/classes';
import {getInstance, instanceBornAt, instancesOf, objectsOf} from '../engine/instances';
import {eventsOf, resourceAt} from '../engine/state';
import type {FlowScript} from './types';

/** 渲染前校验：返回错误列表（Root 里打印到控制台） */
export const validateScript = (s: FlowScript): string[] => {
  const errs: string[] = [];
  const lanes = new Set(s.lanes.map((l) => l.id));
  const procs = new Set((s.processes ?? []).map((p) => p.id));
  const needLane = (id: string, where: string) => {
    if (s.lanes.length && !lanes.has(id)) errs.push(`${where}: 未知泳道 ${id}`);
  };

  // 泳道 ↔ 进程
  s.lanes.forEach((l) => {
    if (l.process && !procs.has(l.process)) errs.push(`lane ${l.id}: 未知进程 ${l.process}`);
  });

  eventsOf(s, 'span').forEach((e) => {
    needLane(e.lane, `span "${e.label}"`);
    if (e.end < e.start) errs.push(`span "${e.label}": end < start`);
  });
  eventsOf(s, 'message').forEach((e) => {
    needLane(e.from, `message "${e.label}"`);
    needLane(e.to, `message "${e.label}"`);
  });
  eventsOf(s, 'batch').forEach((e) => {
    needLane(e.from, `batch "${e.label}"`);
    needLane(e.to, `batch "${e.label}"`);
  });
  eventsOf(s, 'marker').forEach((e) => needLane(e.lane, `marker "${e.label}"`));
  eventsOf(s, 'jank').forEach((e) => needLane(e.lane, `jank "${e.label}"`));
  eventsOf(s, 'input').forEach((e) => needLane(e.lane, `input "${e.label}"`));
  eventsOf(s, 'resource').forEach((e) => needLane(e.owner, `resource ${e.id}@${e.at}`));

  // 系统流程原语
  eventsOf(s, 'call').forEach((e) => {
    needLane(e.from, `call ${e.method}`);
    needLane(e.to, `call ${e.method}`);
    if (e.returnAt !== undefined && e.returnAt < e.at) errs.push(`call ${e.method}@${e.at}: returnAt 早于 at`);
  });
  eventsOf(s, 'oneway').forEach((e) => {
    needLane(e.from, `oneway ${e.method}`);
    needLane(e.to, `oneway ${e.method}`);
  });
  eventsOf(s, 'socket').forEach((e) => {
    needLane(e.from, `socket ${e.label}`);
    needLane(e.to, `socket ${e.label}`);
  });
  eventsOf(s, 'fork').forEach((e) => {
    needLane(e.from, `fork@${e.at}`);
    needLane(e.to, `fork@${e.at}`);
    if (!procs.has(e.process)) errs.push(`fork@${e.at}: 未知子进程 ${e.process}`);
  });
  eventsOf(s, 'post').forEach((e) => {
    needLane(e.from, `post ${e.msg}`);
    needLane(e.to, `post ${e.msg}`);
    if (e.handledAt < e.at) errs.push(`post ${e.msg}@${e.at}: handledAt 早于投递时间`);
  });
  eventsOf(s, 'include').forEach((e) => errs.push(`include ${e.fragment}@${e.at}: 未展开（需要 resolveIncludes）`));

  // 进程诞生前不应有活动
  (s.processes ?? []).forEach((p) => {
    const born = p.bornAt ?? eventsOf(s, 'fork').find((f) => f.process === p.id)?.at;
    if (born === undefined) return;
    const laneIds = s.lanes.filter((l) => l.process === p.id).map((l) => l.id);
    eventsOf(s, 'span')
      .filter((e) => laneIds.includes(e.lane) && e.start < born)
      .forEach((e) => errs.push(`span "${e.label}"@${e.start}: 进程 ${p.id} 在 ${born} 才 fork`));
  });

  const signals = eventsOf(s, 'signal');
  eventsOf(s, 'check').forEach((c) => {
    needLane(c.lane, `check@${c.at}`);
    if (!signals.some((g) => g.id === c.signal)) errs.push(`check@${c.at}: 未知 signal ${c.signal}`);
  });

  // 资源：状态迁移合法 + fence 先于 latch + 配额
  const poolCfg = s.pool;
  if (poolCfg) {
    const pool = getPool(poolCfg.def);
    const sm = getStateMachine(pool.stateMachine);
    const resEvents = eventsOf(s, 'resource');

    s.resources.forEach((r) => {
      const evs = resEvents.filter((e) => e.id === r.id).sort((a, b) => a.at - b.at);
      for (let i = 1; i < evs.length; i++) {
        const a = evs[i - 1];
        const b = evs[i];
        if (a.state !== b.state && !sm.edges.some((e) => e.from === a.state && e.to === b.state)) {
          errs.push(`${r.id}@${b.at}: 非法状态迁移 ${a.state} → ${b.state}`);
        }
        if (b.state === 'ACQUIRED' && a.state !== 'ACQUIRED') {
          const f = signals
            .filter((g) => g.resource === r.id && g.kind === 'acquire-fence' && g.createdAt <= b.at)
            .sort((x, y) => x.createdAt - y.createdAt)
            .pop();
          if (f && (f.signaledAt === undefined || f.signaledAt > b.at)) {
            errs.push(`${r.id}@${b.at}: latch 时 acquire fence ${f.id} 尚未 signal`);
          }
        }
      }
    });

    const times = [...new Set(resEvents.map((e) => e.at))].sort((a, b) => a - b);
    for (const t of times) {
      for (const q of pool.quotas) {
        const n = s.resources.filter((r) => resourceAt(s, r.id, t).state === q.state).length;
        const max = (poolCfg.params[q.param] ?? Infinity) + (q.allowExtra ?? 0);
        if (n > max) errs.push(`t=${t}: ${q.state} 数量 ${n} 超过上限 ${max}（${q.param}）`);
      }
    }
  }

  // 树操作
  const known = new Set<string>();
  eventsOf(s, 'tree')
    .sort((a, b) => a.at - b.at)
    .forEach((e) => {
      if (e.op === 'add') known.add(e.node);
      else if (!known.has(e.node)) errs.push(`tree@${e.at}: ${e.op} 未知节点 ${e.node}`);
      if (e.op === 'reparent' && e.parent && !known.has(e.parent)) {
        errs.push(`tree@${e.at}: reparent 到未知父节点 ${e.parent}`);
      }
      if (e.op === 'remove') known.delete(e.node);
    });

  // 对象状态机
  objectsOf(s).forEach((o) => {
    const sm = getStateMachine(o.stateMachine);
    const evs = eventsOf(s, 'state')
      .filter((e) => e.object === o.id)
      .sort((a, b) => a.at - b.at);
    evs.forEach((b, i) => {
      if (!sm.states.includes(b.to)) errs.push(`${o.id}@${b.at}: 状态机 ${sm.id} 没有状态 ${b.to}`);
      const a = evs[i - 1];
      if (a && a.to !== b.to && !sm.edges.some((e) => e.from === a.to && e.to === b.to)) {
        errs.push(`${o.id}@${b.at}: 非法迁移 ${a.to} → ${b.to}`);
      }
    });
  });

  // 服务 / 阶段 / 属性
  const groups = new Set((s.serviceGroups ?? []).map((g) => g.id));
  eventsOf(s, 'service').forEach((e) => {
    if (!groups.has(e.group)) errs.push(`service ${e.name}: 未知分组 ${e.group}`);
    if (e.end !== undefined && e.end < e.at) errs.push(`service ${e.name}: end 早于 at`);
  });
  eventsOf(s, 'prop').forEach((e) => needLane(e.lane, `prop ${e.key}`));
  const phases = eventsOf(s, 'phase').sort((a, b) => a.at - b.at);
  phases.forEach((p, i) => {
    if (p.lane) needLane(p.lane, `phase ${p.value}`);
    if (i > 0 && p.value < phases[i - 1].value) {
      errs.push(`phase ${p.value}@${p.at}: 比前一个阶段 ${phases[i - 1].value} 小（阶段只能递增）`);
    }
  });

  // 类级时序图
  s.lanes.forEach((l) => {
    if (l.cls && !hasClass(l.cls)) errs.push(`lane ${l.id}: 未知类 ${l.cls}`);
  });
  eventsOf(s, 'invoke').forEach((e) => {
    needLane(e.from, `invoke ${e.method}`);
    needLane(e.to, `invoke ${e.method}`);
    if (e.returnAt !== undefined && e.returnAt < e.at) errs.push(`invoke ${e.method}@${e.at}: returnAt 早于 at`);
  });

  // 超时计时器 / 状态来源
  const objIds = new Set(objectsOf(s).map((o) => o.id));
  const timerIds = new Set<string>();
  eventsOf(s, 'timeout').forEach((e) => {
    if (timerIds.has(e.id)) errs.push(`timeout ${e.id}: id 重复`);
    timerIds.add(e.id);
    needLane(e.lane, `timeout ${e.id}`);
    if (e.duration <= 0) errs.push(`timeout ${e.id}: duration 必须 > 0`);
    if (e.object && !objIds.has(e.object)) errs.push(`timeout ${e.id}: 未知对象 ${e.object}`);
    if (e.cancelAt !== undefined && e.cancelAt < e.at) errs.push(`timeout ${e.id}: cancelAt 早于启动`);
  });
  eventsOf(s, 'state').forEach((e) => e.by && needLane(e.by, `state ${e.object}@${e.at} 的来源`));

  // 实例
  const insts = new Set(instancesOf(s).map((i) => i.id));
  instancesOf(s).forEach((i) => {
    if (!hasClass(i.cls)) errs.push(`instance ${i.id}: 未知类 ${i.cls}`);
    if (!procs.has(i.process)) errs.push(`instance ${i.id}: 未知进程 ${i.process}`);
    Object.values(i.fields ?? {}).forEach((v) => {
      if (insts.has(v) && instanceBornAt(s, v) > instanceBornAt(s, i.id)) errs.push(`instance ${i.id}: 初始字段引用了更晚诞生的 ${v}`);
    });
  });
  s.lanes.forEach((l) => {
    if (!l.inst) return;
    const i = getInstance(s, l.inst);
    if (!i) errs.push(`lane ${l.id}: 未知实例 ${l.inst}`);
    else if (l.cls && l.cls !== i.cls) errs.push(`lane ${l.id}: cls ${l.cls} 与实例类 ${i.cls} 不一致`);
  });
  const needInst = (id: string, at: number, where: string) => {
    if (!insts.has(id)) errs.push(`${where}: 未知实例 ${id}`);
    else if (at < instanceBornAt(s, id)) errs.push(`${where}@${at}: 实例 ${id} 在 ${instanceBornAt(s, id)} 才创建`);
  };
  const newed = new Set<string>();
  eventsOf(s, 'new').forEach((e) => {
    if (newed.has(e.inst)) errs.push(`new ${e.inst}@${e.at}: 重复创建`);
    newed.add(e.inst);
    needInst(e.by, e.at, `new ${e.inst} 的创建者`);
    if (!insts.has(e.inst)) errs.push(`new@${e.at}: 未知实例 ${e.inst}`);
  });
  eventsOf(s, 'set').forEach((e) => {
    needInst(e.inst, e.at, `set ${e.inst}.${e.field}`);
    if (e.value && insts.has(e.value)) needInst(e.value, e.at, `set ${e.inst}.${e.field} 的值`);
  });
  eventsOf(s, 'state').forEach((e) => {
    if (insts.has(e.object) && e.at < instanceBornAt(s, e.object)) errs.push(`state ${e.object}@${e.at}: 实例尚未创建`);
  });
  eventsOf(s, 'span').forEach((e) => {
    const inst = s.lanes.find((l) => l.id === e.lane)?.inst;
    if (inst && e.start < instanceBornAt(s, inst)) errs.push(`span "${e.label}"@${e.start}: 实例 ${inst} 尚未创建`);
  });

  return errs;
};
