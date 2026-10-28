import React from 'react';
import {getScreen} from '../catalog';
import type {ScreenDef} from '../catalog/types';
import type {FlowScript} from '../dsl/types';
import {displayedAt, jankAt, lastInput, screenAt} from '../engine/state';
import {clamp01, ease} from '../engine/text';
import {colors, font, frameColor, resourceColor} from '../theme';

const ICONS = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#14b8a6', '#a855f7', '#ef4444'];
/** com.foo 在桌面网格里的位置（closing 动画缩回到这里） */
const FOO_ICON_INDEX = 5;

const gridIcon = (i: number, x: number, y: number, w: number, h: number) => {
  const cs = w / 4;
  const s = cs * 0.55;
  return {x: x + (i % 4) * cs + (cs - s) / 2, y: y + h * 0.16 + Math.floor(i / 4) * cs * 1.15, s};
};

const launcherGrid = (x: number, y: number, w: number, h: number) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill="#1e3a5f" />
    {Array.from({length: 16}).map((_, i) => {
      const g = gridIcon(i, x, y, w, h);
      return <rect key={i} x={g.x} y={g.y} width={g.s} height={g.s} rx={g.s * 0.25} fill={ICONS[i % ICONS.length]} />;
    })}
  </g>
);

const appIcon = (cx: number, cy: number, s: number) => (
  <g>
    <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={s * 0.28} fill="#22c55e" />
    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={s * 0.36} fontWeight={800} fill="#052e16">
      foo
    </text>
  </g>
);

const renderScreen = (def: ScreenDef, since: number, t: number, x: number, y: number, w: number, h: number) => {
  const k = ease(clamp01((t - since) / (def.animMs ?? 4)));
  switch (def.kind) {
    case 'grid':
      return launcherGrid(x, y, w, h);
    case 'splash':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={def.bg} />
          {appIcon(x + w / 2, y + h * 0.45, w * 0.3)}
        </g>
      );
    case 'list':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={def.bg} />
          <rect x={x} y={y} width={w} height={h * 0.1} fill="rgba(0,0,0,0.3)" />
          {Array.from({length: 7}).map((_, i) => (
            <rect key={i} x={x + w * 0.08} y={y + h * 0.15 + i * h * 0.11} width={w * 0.84} height={h * 0.07} rx={6} fill="rgba(255,255,255,0.14)" />
          ))}
        </g>
      );
    case 'opening': {
      const s = 0.3 + 0.7 * k;
      const rw = w * s;
      const rh = h * s;
      return (
        <g>
          {launcherGrid(x, y, w, h)}
          <rect x={x + (w - rw) / 2} y={y + (h - rh) / 2} width={rw} height={rh} rx={14 * (1 - k)} fill={def.bg} opacity={0.4 + 0.6 * k} />
          {appIcon(x + w / 2, y + h * 0.45, w * 0.3 * s)}
        </g>
      );
    }
    case 'closing': {
      // 应用窗口从全屏缩回到桌面图标位置
      const g = gridIcon(FOO_ICON_INDEX, x, y, w, h);
      const rx = x + (g.x - x) * k;
      const ry = y + (g.y - y) * k;
      const rw = w + (g.s - w) * k;
      const rh = h + (g.s - h) * k;
      return (
        <g>
          {launcherGrid(x, y, w, h)}
          <rect x={rx} y={ry} width={rw} height={rh} rx={6 + g.s * 0.25 * k} fill={def.bg} opacity={1 - 0.6 * k} />
        </g>
      );
    }
    case 'button': {
      // 一个 Button 的界面；edit 有值时上方多一个 EditText，ime 有值时底部显示软键盘
      const bw = w * 0.56;
      const bh = h * 0.075;
      const bx = x + (w - bw) / 2;
      const by = def.edit !== undefined ? y + h * 0.36 : y + h * 0.45;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={def.bg} />
          <rect x={x} y={y} width={w} height={h * 0.09} fill="rgba(255,255,255,0.06)" />
          {def.edit !== undefined && (
            <g>
              <rect x={x + w * 0.12} y={y + h * 0.22} width={w * 0.76} height={bh} rx={4} fill="rgba(255,255,255,0.06)" />
              <line x1={x + w * 0.12} x2={x + w * 0.88} y1={y + h * 0.22 + bh} y2={y + h * 0.22 + bh} stroke="#38bdf8" strokeWidth={2} />
              <text x={x + w * 0.15} y={y + h * 0.22 + bh / 2 + 1} dominantBaseline="middle" fontSize={bh * 0.45} fill="#e2e8f0">
                {def.edit || '｜'}
              </text>
            </g>
          )}
          {def.focused && <rect x={bx - 5} y={by - 5} width={bw + 10} height={bh + 10} rx={10} fill="none" stroke="#fbbf24" strokeWidth={3} />}
          <rect x={bx} y={by} width={bw} height={bh} rx={7} fill={def.pressed ? '#1d4ed8' : '#3b82f6'} />
          {def.pressed && <circle cx={bx + bw / 2} cy={by + bh / 2} r={bh * 0.9} fill="rgba(255,255,255,0.18)" />}
          <text x={bx + bw / 2} y={by + bh / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={bh * 0.42} fontWeight={700} fill="#fff">
            {def.text}
          </text>
          {def.ime !== undefined && (
            <g>
              <rect x={x} y={y + h * 0.62} width={w} height={h * 0.38} fill="#1e293b" />
              <rect x={x} y={y + h * 0.62} width={w} height={h * 0.06} fill="#334155" />
              <text x={x + 8} y={y + h * 0.65 + 1} dominantBaseline="middle" fontSize={h * 0.028} fill="#fbbf24">
                {def.ime}
              </text>
              {Array.from({length: 12}).map((_, i) => (
                <rect key={i} x={x + 6 + (i % 4) * ((w - 12) / 4)} y={y + h * 0.7 + Math.floor(i / 4) * h * 0.09} width={(w - 12) / 4 - 5} height={h * 0.075} rx={4} fill="#475569" />
              ))}
            </g>
          )}
        </g>
      );
    }
    case 'black':
      return <rect x={x} y={y} width={w} height={h} fill="#000" />;
    case 'logo':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="#000" />
          <text x={x + w / 2} y={y + h * 0.45} textAnchor="middle" dominantBaseline="middle" fontSize={w * 0.1} fontWeight={800} fill="#e5e7eb" letterSpacing={2}>
            {def.text ?? 'LOGO'}
          </text>
        </g>
      );
    case 'bootanim': {
      // "android" 字样 + 一道扫过的高光（随模拟时间移动）
      const ph = (((t - since) / 1500) % 1 + 1) % 1;
      const hx = x + w * (ph * 1.4 - 0.2);
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="#000" />
          <text x={x + w / 2} y={y + h * 0.45} textAnchor="middle" dominantBaseline="middle" fontSize={w * 0.14} fontWeight={700} fill="#4b5563">
            android
          </text>
          <rect x={hx} y={y + h * 0.39} width={w * 0.16} height={h * 0.12} fill="#a3e635" opacity={0.35} />
        </g>
      );
    }
    default:
      return null;
  }
};

/** 三键导航栏：home 按下时高亮 + 波纹 */
const navBar = (script: FlowScript, t: number, x: number, y: number, w: number, h: number) => {
  const nh = Math.max(16, h * 0.07);
  const ny = y + h - nh;
  const cy = ny + nh / 2;
  const r = nh * 0.28;
  const last = lastInput(script, 'nav-home', t);
  const pressed = last?.kind === 'touch-down';
  const since = last ? t - last.at : Infinity;
  const ripple = pressed ? clamp01(since / 30) : clamp01(1 - since / 20);
  const hx = x + w * 0.5;
  return (
    <g>
      <rect x={x} y={ny} width={w} height={nh} fill="rgba(0,0,0,0.6)" />
      {ripple > 0 && <circle cx={hx} cy={cy} r={r + nh * 0.9 * ripple} fill="#fff" opacity={0.25 * ripple} />}
      <path d={`M${x + w * 0.25 + r},${cy - r} L${x + w * 0.25 - r},${cy} L${x + w * 0.25 + r},${cy + r} z`} fill="none" stroke="#e5e7eb" strokeWidth={1.6} />
      <circle cx={hx} cy={cy} r={r} fill={pressed ? '#fff' : 'none'} stroke="#e5e7eb" strokeWidth={1.6} />
      <rect x={x + w * 0.75 - r} y={cy - r} width={r * 2} height={r * 2} rx={2} fill="none" stroke="#e5e7eb" strokeWidth={1.6} />
    </g>
  );
};

/**
 * 用户此刻看到什么：
 * - 有 screen 事件 → 显示对应画面；否则取 display span 显示"第 N 帧"
 * - jank → 抖动 + 徽标；navBar → 底部三键导航栏（按下 Home 有波纹）
 */
export const ScreenView: React.FC<{
  script: FlowScript;
  t: number;
  width: number;
  height: number;
  frame: number;
  navBar?: boolean;
}> = ({script, t, width, height, frame, navBar: showNav = false}) => {
  const capH = 30;
  let ph = height - capH - 14;
  let pw = (ph * 9) / 16;
  if (pw > width - 24) {
    pw = width - 24;
    ph = (pw * 16) / 9;
  }
  const px = (width - pw) / 2;
  const py = 6;
  const ix = px + 8;
  const iy = py + 22;
  const iw = pw - 16;
  const ih = ph - 34;

  const scr = screenAt(script, t);
  const def = scr ? getScreen(scr.show) : undefined;
  const disp = def ? undefined : displayedAt(script, t);
  const jk = jankAt(script, t, 8);
  const shake = jk ? Math.sin(frame * 1.7) * 5 * clamp01(1 - (t - jk.at) / 8) : 0;
  const clipId = `scr-${script.id}`;

  let content: React.ReactNode = <rect x={ix} y={iy} width={iw} height={ih} fill="#000" />;
  let caption = '';

  if (def && scr) {
    caption = def.title;
    content = renderScreen(def, scr.at, t, ix, iy, iw, ih);
  } else if (disp) {
    const fc = frameColor(disp.frame) ?? colors.display;
    caption = '屏幕正在扫出';
    const chip = iw * 0.22;
    content = (
      <g>
        <rect x={ix} y={iy} width={iw} height={ih} fill="#05070c" />
        <rect x={ix} y={iy} width={iw} height={ih} fill={fc} fillOpacity={0.28} />
        <text x={ix + iw / 2} y={iy + ih * 0.38} textAnchor="middle" dominantBaseline="middle" fontSize={iw * 0.15} fontWeight={800} fill={colors.fg}>
          {`第 ${disp.frame ?? '?'} 帧`}
        </text>
        {disp.resource && (
          <g>
            <rect x={ix + iw / 2 - chip / 2} y={iy + ih * 0.5} width={chip} height={chip} rx={chip * 0.2} fill={resourceColor(disp.resource)} />
            <text x={ix + iw / 2} y={iy + ih * 0.5 + chip / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={chip * 0.55} fontWeight={800} fill="#111">
              {disp.resource}
            </text>
            <text x={ix + iw / 2} y={iy + ih * 0.5 + chip + 18} textAnchor="middle" fontSize={12} fill={colors.muted}>
              {`Buffer ${disp.resource}`}
            </text>
          </g>
        )}
      </g>
    );
  }

  return (
    <svg width={width} height={height} style={{display: 'block', fontFamily: font}}>
      <defs>
        <clipPath id={clipId}>
          <rect x={ix} y={iy} width={iw} height={ih} rx={10} />
        </clipPath>
      </defs>
      <g transform={`translate(${shake},0)`}>
        <rect x={px} y={py} width={pw} height={ph} rx={pw * 0.12} fill="#05070c" stroke="#3b4559" strokeWidth={3} />
        <rect x={px + pw / 2 - 22} y={py + 9} width={44} height={6} rx={3} fill="#1f2937" />
        <g clipPath={`url(#${clipId})`}>
          {content}
          {showNav && navBar(script, t, ix, iy, iw, ih)}
        </g>
      </g>
      {jk && (
        <g>
          <rect x={width / 2 - 44} y={py + 30} width={88} height={24} rx={12} fill={colors.warn} />
          <text x={width / 2} y={py + 43} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={800} fill="#111">
            {jk.label}
          </text>
        </g>
      )}
      <text x={width / 2} y={height - 10} textAnchor="middle" fontSize={14} fill={colors.muted}>
        {caption}
      </text>
    </svg>
  );
};
