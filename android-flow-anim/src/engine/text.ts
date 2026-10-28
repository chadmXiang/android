export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const ease = (p: number) => p * p * (3 - 2 * p);

/** 令牌在泳道 / 阶段之间移动的时长（模拟 ms）；分镜 hold 点应在事件后 ≥ 此值 */
export const TOKEN_ANIM_MS = 0.6;
export const MSG_ANIM_MS = 0.5;

const charW = (ch: string, fs: number) => (ch.charCodeAt(0) > 0x2e7f ? fs : fs * 0.58);

export const textWidth = (s: string, fs: number) => [...s].reduce((w, ch) => w + charW(ch, fs), 0);

export const fitText = (s: string, max: number, fs: number) => {
  if (max <= 0) return '';
  if (textWidth(s, fs) <= max) return s;
  let out = '';
  let w = fs;
  for (const ch of s) {
    const cw = charW(ch, fs);
    if (w + cw > max) break;
    w += cw;
    out += ch;
  }
  return out ? out + '…' : '';
};

/** 模拟时间的显示：'step' 显示步数；ms / s 流程超过 1 秒显示秒 */
export const fmtSim = (v: number, unit?: 'ms' | 's' | 'step') => {
  if (unit === 'step') return `${Math.round(v * 10) / 10} 步`;
  if (unit === 's' || Math.abs(v) >= 1000) return `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 1 : 2)} s`;
  return `${Math.round(v)} ms`;
};
