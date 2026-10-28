import type {Rect} from '../catalog/types';

export interface Pt {
  x: number;
  y: number;
}

export const center = (r: Rect): Pt => ({x: r.x + r.w / 2, y: r.y + r.h / 2});

/** 从矩形中心朝 toward 方向射线与边框的交点 */
export const clipToRect = (r: Rect, toward: Pt): Pt => {
  const c = center(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const sx = dx !== 0 ? r.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? r.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return {x: c.x + dx * s, y: c.y + dy * s};
};

export const toPath = (pts: Pt[]) => 'M' + pts.map((p) => `${p.x},${p.y}`).join(' L');

export const polylineMid = (pts: Pt[]): Pt => {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let half = segs.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < segs.length; i++) {
    if (half <= segs[i]) {
      const k = segs[i] ? half / segs[i] : 0;
      return {x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k};
    }
    half -= segs[i];
  }
  return pts[pts.length - 1];
};
