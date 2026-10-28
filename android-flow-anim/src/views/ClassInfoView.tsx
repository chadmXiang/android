import React from 'react';
import {getClass, hasClass, relationsOf} from '../catalog/classes';
import type {ClassRelation} from '../catalog/types';
import {colors, mono} from '../theme';
import {KIND_LABELS, OWNER_COLORS, OWNER_LABELS} from './ClassMapView';

const phrase = (r: ClassRelation, self: string) => {
  const otherId = r.from === self ? r.to : r.from;
  const other = hasClass(otherId) ? getClass(otherId).name : otherId;
  const out = r.from === self;
  const tail = r.label ? `（${r.label}）` : '';
  switch (r.kind) {
    case 'extends':
      return (out ? `继承 ${other}` : `被 ${other} 继承`) + tail;
    case 'owns':
      return (out ? `持有 ${other}` : `属于 ${other}`) + tail;
    case 'holds':
      return (out ? `引用 ${other}` : `被 ${other} 引用`) + tail;
    case 'creates':
      return (out ? `创建 ${other}` : `由 ${other} 创建`) + tail;
    case 'binder':
      return (out ? `经 binder 调 ${other}` : `被 ${other} 经 binder 调用`) + tail;
    case 'mirror':
      return `与 ${other} 一一对应`;
    case 'children':
      return (out ? `子节点：${other}` : `父节点：${other}`) + tail;
    default:
      return other;
  }
};

/** 当前聚焦类的详情卡 */
export const ClassInfoView: React.FC<{id?: string}> = ({id}) => {
  if (!id || !hasClass(id)) {
    return <div style={{color: colors.muted, fontSize: 16}}>关键类详情（随镜头聚焦切换）</div>;
  }
  const c = getClass(id);
  const col = OWNER_COLORS[c.owner];
  const rels = relationsOf(id);
  const relLines = [...rels.out, ...rels.in].slice(0, 6).map((r) => phrase(r, id));
  const chip = (text: string, color: string) => (
    <span style={{fontSize: 12, padding: '1px 8px', borderRadius: 6, border: `1px solid ${color}`, color}}>{text}</span>
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 9, height: '100%', overflow: 'hidden'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
        <span style={{fontFamily: mono, fontSize: 21, fontWeight: 800}}>{c.name}</span>
        {chip(OWNER_LABELS[c.owner], col)}
        {chip(KIND_LABELS[c.kind], colors.muted)}
      </div>
      <div style={{fontFamily: mono, fontSize: 13, color: colors.info}}>{c.file}</div>
      <div style={{fontSize: 15, lineHeight: 1.5}}>{c.role}</div>
      {!!c.methods?.length && (
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
          {c.methods.map((m) => (
            <span key={m} style={{fontFamily: mono, fontSize: 12, padding: '2px 6px', borderRadius: 5, background: 'rgba(56,189,248,0.12)', color: colors.info}}>
              {m}()
            </span>
          ))}
        </div>
      )}
      {!!c.fields?.length && (
        <div style={{fontFamily: mono, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6}}>
          {c.fields.slice(0, 5).map((f) => (
            <div key={f}>· {f}</div>
          ))}
        </div>
      )}
      {relLines.length > 0 && (
        <div style={{fontSize: 13, color: colors.muted, lineHeight: 1.6}}>
          {relLines.map((l) => (
            <div key={l}>↳ {l}</div>
          ))}
        </div>
      )}
      {c.note && <div style={{fontSize: 13, color: colors.warn, lineHeight: 1.5}}>⚑ {c.note}</div>}
    </div>
  );
};
