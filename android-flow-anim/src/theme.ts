import type {Layer} from './catalog/types';
import type {SpanStyle, Tone} from './dsl/types';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const font =
  '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif';
export const mono =
  '"JetBrains Mono", "SF Mono", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace';

export const colors = {
  bg: '#0d1117',
  panel: '#161b26',
  panel2: '#0b1020',
  border: '#2a3448',
  fg: '#e6edf3',
  muted: '#8b97ab',
  cpu: '#3b82f6',
  gpu: '#a855f7',
  sf: '#10b981',
  wait: '#ef4444',
  display: '#64748b',
  ok: '#22c55e',
  warn: '#f59e0b',
  bad: '#ef4444',
  info: '#38bdf8',
  orange: '#fb923c',
  pink: '#e879f9',
  lime: '#a3e635',
};

export const layerColors: Record<Layer, string> = {
  app: '#3b82f6',
  system_server: '#f59e0b',
  systemui: '#ec4899',
  native: '#10b981',
  kernel: '#94a3b8',
  hw: '#a3e635',
};

const RESOURCE_PALETTE: Record<string, string> = {A: '#fb923c', B: '#22d3ee', C: '#facc15', kd: '#f472b6', ku: '#a78bfa'};
export const resourceColor = (id: string) => RESOURCE_PALETTE[id] ?? '#94a3b8';

export const stateColors: Record<string, string> = {
  FREE: '#475569',
  DEQUEUED: '#2563eb',
  QUEUED: '#9333ea',
  ACQUIRED: '#059669',
  NONE: '#1f2937',
  CREATED: '#64748b',
  INJECTED: '#0ea5e9',
  DISPATCHING: '#d97706',
  CONSUMED: '#059669',
  DELIVERED: '#16a34a',
  EXECUTING: '#d97706',
  STARTED: '#16a34a',
  ANR: '#dc2626',
};
export const stateColor = (s: string) => stateColors[s] ?? '#334155';

export const spanColors: Record<SpanStyle, string> = {
  cpu: colors.cpu,
  gpu: colors.gpu,
  sf: colors.sf,
  wait: colors.wait,
  display: colors.display,
};
export const spanNames: Record<SpanStyle, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  sf: 'SF',
  wait: '阻塞',
  display: '屏幕',
};
export const toneColors: Record<Tone, string> = {
  ok: colors.ok,
  warn: colors.warn,
  bad: colors.bad,
  info: colors.info,
};

/** 帧血缘：'N-1' / 'N' / 'N+1' … 映射到固定色相 */
const FRAME_HUES = ['#f472b6', '#38bdf8', '#a3e635', '#fbbf24', '#c084fc'];
export const frameColor = (f?: string) => {
  if (!f) return undefined;
  const m = f.match(/^N([+-]\d+)?$/);
  const k = m && m[1] ? parseInt(m[1], 10) : 0;
  return FRAME_HUES[((k % 5) + 5) % 5];
};
