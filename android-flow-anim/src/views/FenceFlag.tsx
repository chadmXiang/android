import React from 'react';

export const FenceFlag: React.FC<{x: number; y: number; color: string; scale?: number}> = ({x, y, color, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <line x1={0} y1={0} x2={0} y2={-15} stroke="#fff" strokeWidth={1.5} />
    <path d="M0,-15 L12,-11 L0,-7 z" fill={color} />
  </g>
);
