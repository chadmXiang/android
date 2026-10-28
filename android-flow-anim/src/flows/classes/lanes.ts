import {getClass} from '../../catalog/classes';
import type {LaneDef} from '../../dsl/types';

/** 以类为泳道：标签取类名，副标题取源文件 */
export const clsLane = (id: string, cls: string, process: string, label?: string): LaneDef => {
  const c = getClass(cls);
  return {id, label: label ?? c.name, sub: c.file.split('/').pop() ?? c.file, process, cls};
};
