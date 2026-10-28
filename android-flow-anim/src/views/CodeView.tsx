import React from 'react';
import type {CodeRef} from '../dsl/types';
import {clamp01} from '../engine/text';
import {colors, mono} from '../theme';

export const CodeView: React.FC<{code?: CodeRef; localSec: number}> = ({code, localSec}) => {
  const box: React.CSSProperties = {
    height: '100%',
    boxSizing: 'border-box',
    background: colors.panel2,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflow: 'hidden',
  };
  if (!code) return <div style={{...box, color: colors.muted, fontSize: 16}}>源码对照</div>;
  return (
    <div style={{...box, opacity: clamp01(localSec / 0.4)}}>
      <div style={{fontFamily: mono, fontSize: 15, color: colors.info}}>{code.file}</div>
      {code.snippet && (
        <pre style={{margin: 0, fontFamily: mono, fontSize: 14, lineHeight: 1.5, color: '#d1d5db', whiteSpace: 'pre-wrap'}}>
          {code.snippet.split('\n').map((ln, i) => (
            <div key={i} style={{color: ln.trim().startsWith('//') ? '#7d8590' : undefined}}>
              {ln || ' '}
            </div>
          ))}
        </pre>
      )}
      {code.note && (
        <div style={{fontSize: 16, lineHeight: 1.6, color: colors.fg, whiteSpace: 'pre-line'}}>{code.note}</div>
      )}
    </div>
  );
};
