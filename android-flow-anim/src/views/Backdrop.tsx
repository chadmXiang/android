import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {colors} from '../theme';

/**
 * 画面底衬：主题色低幅径向渐变 + 呼吸网格 + 暗角。
 * 纯装饰、无信息，放在所有视图之下（zIndex 0），不拦事件。
 * 借鉴 OpenMontage remotion-composer 的 AnimatedBackground / Vignette。
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  // 20 秒一个周期的极缓呼吸：只改网格透明度与渐变中心，避免抢注意力
  const breath = 0.5 + 0.5 * Math.sin((frame / 600) * Math.PI * 2);
  const cx = 30 + breath * 8;
  return (
    <AbsoluteFill style={{background: colors.bg}}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(60% 55% at ${cx}% 18%, rgba(59,130,246,0.10), transparent 70%)`,
            `radial-gradient(55% 50% at ${100 - cx}% 92%, rgba(168,85,247,0.08), transparent 72%)`,
          ].join(','),
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.1 + breath * 0.04,
          backgroundImage: `linear-gradient(${colors.border} 1px, transparent 1px), linear-gradient(90deg, ${colors.border} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      <AbsoluteFill
        style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)'}}
      />
    </AbsoluteFill>
  );
};
