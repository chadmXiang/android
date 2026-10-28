import {BOOT_COMPONENTS} from './boot';
import {CLOCK_PROFILES} from './clocks';
import {POOLS} from './pools';
import {PROCESSES} from './processes';
import {RENDER_COMPONENTS} from './render';
import {SCREENS} from './screens';
import {STATE_MACHINES} from './statemachines';
import {SYSTEM_COMPONENTS} from './system';
import type {ComponentDef} from './types';

const indexer = <T extends {id: string}>(list: T[], kind: string) => {
  const m = new Map<string, T>(list.map((x): [string, T] => [x.id, x]));
  return (id: string): T => {
    const v = m.get(id);
    if (!v) throw new Error(`[catalog] 未知${kind}: ${id}`);
    return v;
  };
};

export const COMPONENTS: ComponentDef[] = [...RENDER_COMPONENTS, ...SYSTEM_COMPONENTS, ...BOOT_COMPONENTS];

export const getComponent = indexer(COMPONENTS, '组件');
export const getProcess = indexer(PROCESSES, '进程');
export const getStateMachine = indexer(STATE_MACHINES, '状态机');
export const getPool = indexer(POOLS, '资源池');
export const getClockProfile = indexer(CLOCK_PROFILES, '时钟配置');
export const getScreen = indexer(SCREENS, '画面');
