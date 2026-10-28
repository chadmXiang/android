import React, {useMemo} from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CodeRef, FlowEvent, FlowScript, FlowStory} from '../../dsl/types';
import {clamp01, ease} from '../../engine/text';
import {vguiAndroidScript} from '../../flows/vgui/androidFlow';
import {vguiChainScript} from '../../flows/vgui/chainFlow';
import {heatingSteps, heatingStory} from '../../flows/vgui/heatingCase';
import {androidHitStory, androidRegisterStory, chainHitStory, chainRegisterStory} from '../../flows/vgui/stories';
import {StoryScene} from '../../layouts/StoryScene';
import {colors, font, mono, spanColors, toneColors} from '../../theme';
import {Backdrop} from '../../views/Backdrop';
import {Caption, Header, Panel} from '../../views/Chrome';

const SUB = '示意时序 · 非实测';
const CHAPTERS = ['① 注册链路', '② 命中链路', '③ Android 注册', '④ Android 命中', '合成制热示例'];

type SupportedEvent = Extract<FlowEvent, {type: 'span' | 'marker' | 'call' | 'oneway' | 'message'}>;

interface TimelineRow {
  at: number;
  actor: string;
  action: string;
  kind: string;
  color: string;
}

const eventAt = (event: SupportedEvent) => (event.type === 'span' ? event.start : event.at);

const ChapterNav: React.FC<{active: number}> = ({active}) => (
  <div
    style={{
      position: 'absolute',
      left: 40,
      right: 40,
      top: 90,
      height: 50,
      display: 'grid',
      gridTemplateColumns: `repeat(${CHAPTERS.length}, 1fr)`,
      gap: 10,
    }}
  >
    {CHAPTERS.map((chapter, index) => (
      <div
        key={chapter}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 12px',
          borderRadius: 10,
          border: `1px solid ${index === active ? colors.info : colors.border}`,
          background: index === active ? 'rgba(56,189,248,0.16)' : 'rgba(22,27,38,0.78)',
          color: index === active ? colors.fg : colors.muted,
          fontSize: 20,
          fontWeight: index === active ? 750 : 550,
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {chapter}
      </div>
    ))}
  </div>
);

const SourceCard: React.FC<{
  code?: CodeRef;
  heading?: string;
  includeSnippet?: boolean;
  footer?: React.ReactNode;
}> = ({code, heading = '当前镜头依据', includeSnippet = true, footer}) => {
  const basename = code?.file.split(/[\\/]/).pop();
  return (
    <Panel x={1280} y={155} w={600} h={700} pad={24}>
      <div style={{fontSize: 22, fontWeight: 800, color: colors.info}}>{heading}</div>
      <div
        style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 10,
          background: colors.panel2,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{fontSize: 17, color: colors.muted}}>来源</div>
        <div style={{marginTop: 6, fontSize: 23, fontWeight: 750, overflowWrap: 'anywhere'}}>
          {basename ?? '本镜头为章节收束'}
        </div>
        {code?.file && code.file !== basename && (
          <div
            style={{
              marginTop: 10,
              color: colors.muted,
              fontFamily: mono,
              fontSize: 17,
              lineHeight: 1.35,
              overflowWrap: 'anywhere',
              whiteSpace: 'pre-wrap',
            }}
          >
            {code.file.split('\n').map((file) => {
              const directoryEnd = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')) + 1;
              return (
                <div key={file}>
                  {file.slice(0, directoryEnd)}
                  <wbr />
                  <span style={{whiteSpace: 'nowrap'}}>{file.slice(directoryEnd)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {includeSnippet && code?.snippet && (
        <div
          style={{
            marginTop: 18,
            color: colors.fg,
            fontFamily: mono,
            fontSize: 18,
            lineHeight: 1.42,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {code.snippet}
        </div>
      )}
      {code?.note && (
        <div
          style={{
            marginTop: 18,
            padding: '14px 16px',
            borderLeft: `4px solid ${colors.info}`,
            background: 'rgba(56,189,248,0.08)',
            color: colors.fg,
            fontSize: 20,
            lineHeight: 1.48,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {code.note}
        </div>
      )}
      {footer}
    </Panel>
  );
};

const VguiStoryChapter: React.FC<{
  script: FlowScript;
  story: FlowStory;
  chapter: number;
  title: string;
}> = ({script, story, chapter, title}) => {
  const startT = story.steps[0]?.view?.[0] ?? script.window[0];
  const rowsByStep = useMemo(() => {
    const lanes = new Map(script.lanes.map((lane) => [lane.id, lane.label]));
    const supported = script.events.filter(
      (event): event is SupportedEvent =>
        event.type === 'span' ||
        event.type === 'marker' ||
        event.type === 'call' ||
        event.type === 'oneway' ||
        event.type === 'message',
    );
    return story.steps.map((step, index) => {
      const lower = index === 0 ? startT : story.steps[index - 1].to;
      return supported
        .filter((event) => {
          const at = eventAt(event);
          return (index === 0 ? at >= lower : at > lower) && at <= step.to;
        })
        .sort((a, b) => eventAt(a) - eventAt(b))
        .map((event): TimelineRow => {
          if (event.type === 'span') {
            return {
              at: event.start,
              actor: lanes.get(event.lane) ?? event.lane,
              action: event.label,
              kind: '本地动作',
              color: spanColors[event.style],
            };
          }
          if (event.type === 'marker') {
            return {
              at: event.at,
              actor: lanes.get(event.lane) ?? event.lane,
              action: event.label,
              kind: '关键标记',
              color: toneColors[event.tone],
            };
          }
          return {
            at: event.at,
            actor: `${lanes.get(event.from) ?? event.from} → ${lanes.get(event.to) ?? event.to}`,
            action: event.type === 'call' || event.type === 'oneway' ? event.method : event.label,
            kind: event.type === 'call' ? '同步调用' : event.type === 'oneway' ? '单向投递' : '跨模块消息',
            color: event.type === 'call' ? colors.orange : event.type === 'oneway' ? colors.pink : colors.lime,
          };
        });
    });
  }, [script, startT, story]);

  return (
    <StoryScene
      story={story}
      startT={startT}
      render={(ctx) => {
        const rows = rowsByStep[ctx.seg.index] ?? [];
        let activeRow = -1;
        rows.forEach((row, index) => {
          if (row.at <= ctx.t) activeRow = index;
        });
        return (
          <>
            <Header title={title} subtitle={SUB} right={`${ctx.seg.index + 1} / ${ctx.total}`} />
            <ChapterNav active={chapter} />
            <Panel x={40} y={155} w={1220} h={700} pad={20}>
              <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
                <div style={{fontSize: 23, fontWeight: 800}}>本镜头事件 · 按发生时间排列</div>
                <div style={{fontSize: 17, color: colors.muted, fontFamily: mono}}>
                  {script.timeUnit ?? 'ms'} · {Math.round(ctx.t)}
                </div>
              </div>
              <div style={{marginTop: 14}}>
                {rows.map((row, index) => {
                  const revealed = index <= activeRow;
                  const active = index === activeRow;
                  return (
                    <div
                      key={`${row.at}-${row.kind}-${row.action}`}
                      style={{
                        position: 'relative',
                        height: 96,
                        display: 'grid',
                        gridTemplateColumns: '54px 300px minmax(0, 1fr)',
                        alignItems: 'center',
                        borderRadius: 12,
                        border: `1px solid ${active ? row.color : colors.border}`,
                        background: active ? `${row.color}16` : 'rgba(11,16,32,0.68)',
                        opacity: revealed ? 1 : 0.48,
                        transform: `translateX(${revealed ? 0 : 8}px)`,
                        marginBottom: 5,
                      }}
                    >
                      {index < rows.length - 1 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 26,
                            top: 64,
                            height: 37,
                            width: 2,
                            background: revealed ? row.color : colors.border,
                          }}
                        />
                      )}
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          marginLeft: 9,
                          borderRadius: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: row.color,
                          color: colors.bg,
                          fontSize: 18,
                          fontWeight: 850,
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{paddingRight: 18, minWidth: 0}}>
                        <div style={{fontSize: 17, color: row.color, fontWeight: 750}}>{row.kind}</div>
                        <div style={{marginTop: 5, fontSize: 18, lineHeight: 1.22, overflowWrap: 'anywhere'}}>
                          {row.actor}
                        </div>
                      </div>
                      <div
                        style={{
                          minWidth: 0,
                          padding: '5px 18px 5px 16px',
                          borderLeft: `1px solid ${colors.border}`,
                          fontSize: 25,
                          fontWeight: active ? 720 : 560,
                          lineHeight: 1.2,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {row.action}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <SourceCard code={ctx.seg.step.code} />
            <Caption text={ctx.seg.step.caption} localSec={ctx.local} />
          </>
        );
      }}
    />
  );
};

export const VguiTitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 180}});
  const chapters = [
    '① 注册链路：页面词条 → 端云词典',
    '② 命中链路：一句话 → 一次点击',
    '③ Android 注册：自动扫描 → JSGF',
    '④ Android 命中：仲裁 → 响应闭环',
    '合成示例：「制热」控制与状态回读',
  ];
  return (
    <AbsoluteFill style={{background: colors.bg, color: colors.fg, fontFamily: font}}>
      <Backdrop />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '70px 100px'}}>
        <div
          style={{
            width: '100%',
            maxWidth: 1700,
            textAlign: 'center',
            opacity: enter,
            transform: `translateY(${(1 - enter) * 26}px)`,
          }}
        >
          <div style={{fontSize: 25, lineHeight: 1.4, color: colors.info, fontFamily: mono}}>
            VGUI · 语音链路（语雀《VGUI 技术分享》）+ Android frameworks-base + 合成教学示例
          </div>
          <div style={{fontSize: 76, lineHeight: 1.15, fontWeight: 850, marginTop: 18}}>VGUI：所见即可说，从说到做</div>
          <div style={{fontSize: 31, color: colors.muted, lineHeight: 1.45, marginTop: 20}}>
            前四章是原理示意；案例章使用合成数据，演示文本注入「制热」后的响应
          </div>
          <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 46}}>
            {chapters.map((chapter, index) => {
              const reveal = spring({frame: frame - 12 - index * 7, fps, config: {damping: 16}});
              return (
                <div
                  key={chapter}
                  style={{
                    flex: '0 1 500px',
                    minHeight: 74,
                    boxSizing: 'border-box',
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    border: `1px solid ${index === chapters.length - 1 ? colors.ok : colors.border}`,
                    background: index === chapters.length - 1 ? 'rgba(34,197,94,0.13)' : colors.panel,
                    color: index === chapters.length - 1 ? colors.ok : colors.fg,
                    fontSize: 24,
                    fontWeight: 720,
                    lineHeight: 1.35,
                    opacity: reveal,
                    transform: `scale(${0.94 + reveal * 0.06})`,
                  }}
                >
                  {chapter}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const VguiChainRegisterScene: React.FC = () => (
  <VguiStoryChapter
    script={vguiChainScript}
    story={chainRegisterStory}
    chapter={0}
    title="① 注册链路：页面词条 → 端云词典"
  />
);

export const VguiChainHitScene: React.FC = () => (
  <VguiStoryChapter
    script={vguiChainScript}
    story={chainHitStory}
    chapter={1}
    title="② 命中链路：一句话 → 一次点击"
  />
);

export const VguiAndroidRegisterScene: React.FC = () => (
  <VguiStoryChapter
    script={vguiAndroidScript}
    story={androidRegisterStory}
    chapter={2}
    title="③ Android 注册：应用打开 → 扫描 → 词条进引擎"
  />
);

export const VguiAndroidHitScene: React.FC = () => (
  <VguiStoryChapter
    script={vguiAndroidScript}
    story={androidHitStory}
    chapter={3}
    title="④ Android 命中：说话 → 仲裁 → 响应 → hitBack"
  />
);

export const VguiHeatingScene: React.FC = () => (
  <StoryScene
    story={heatingStory}
    startT={0}
    render={(ctx) => {
      const evidence = heatingSteps[ctx.seg.index] ?? heatingSteps[heatingSteps.length - 1];
      const reveal = clamp01(ctx.local / Math.max(ctx.seg.step.move, 0.01));
      return (
        <>
          <Header
            title="合成教学示例：「制热」九步响应"
            subtitle="非实车日志 · VGUI → 车控 → 状态回读"
            right={`${ctx.seg.index + 1} / ${heatingSteps.length}`}
          />
          <ChapterNav active={4} />
          <Panel x={40} y={155} w={1220} h={700} pad={24}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24}}>
              <div style={{fontSize: 27, fontWeight: 820}}>{evidence.title}</div>
              <div style={{fontFamily: mono, fontSize: 19, color: colors.info, whiteSpace: 'nowrap'}}>
                {evidence.time}
              </div>
            </div>
            <div style={{marginTop: 9, color: colors.muted, fontSize: 19}}>
              演示参与方：{evidence.actor} · 合成事件 · 第 {ctx.seg.index + 1} / {heatingSteps.length} 步
            </div>
            <div
              style={{
                marginTop: 18,
                padding: '14px 16px',
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: colors.panel2,
              }}
            >
              {evidence.lines.map((line, index) => {
                const lineReveal = clamp01(reveal * evidence.lines.length - index);
                return (
                  <div
                    key={`${index}-${line}`}
                    style={{
                      padding: '7px 0',
                      borderBottom: index < evidence.lines.length - 1 ? `1px solid ${colors.border}` : undefined,
                      color: lineReveal > 0 ? colors.fg : colors.muted,
                      opacity: 0.42 + lineReveal * 0.58,
                      fontFamily: mono,
                      fontSize: 25,
                      lineHeight: 1.35,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          </Panel>
          <SourceCard
            code={ctx.seg.step.code}
            heading="示意资料 · 合成教学数据"
            includeSnippet={false}
            footer={
              <div
                style={{
                  marginTop: 20,
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: `1px solid ${colors.warn}`,
                  color: colors.warn,
                  fontSize: 19,
                  lineHeight: 1.45,
                }}
              >
                全部为合成演示：本地 NLU、控制回读与 TTS 起止均非实车证据。真实排查仍需区分控制状态、实际温升与发热功率。
              </div>
            }
          />
          <Caption text={ctx.seg.step.caption} localSec={ctx.local} />
        </>
      );
    }}
  />
);

export const VguiEndingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = frame / fps;
  const cards = [
    {
      title: '注册 · 云端视角',
      text: '页面变化触发提取 → magiccubed 合并生成离线 JSGF + 上报云端词表；2.0 框架自动扫描，应用零接入。',
      boundary: '依据边界：语雀《VGUI 技术分享》· 原理示意时序',
    },
    {
      title: '注册与命中 · Android',
      text: '打开即扫 → 200ms 防抖去重 → AIDL① → AIDL② → 全车并集 slot → 引擎 JSGF；命中后经适配层与 voice_bridge 多屏多音区仲裁回到应用。',
      boundary: '依据边界：frameworks-base 方法级源码链路 · 非实测耗时',
    },
    {
      title: '应用响应与闭环',
      text: 'OnVoiceListener 或默认动作（点击 / 开关 / 滑动）+ 命中动效 → hitBack 成败上报；失败由仲裁级联下一个候选，反馈请求再回语音侧。',
      boundary: '依据边界：Android 注册表、分派与反馈实现',
    },
    {
      title: '合成「制热」教学示例',
      text: '演示查询本地词表为空、未命中；云端控件命中 → 仲裁 → Compose CLICK → 车控下发与回读。hitBack 与 TTS 起止在逻辑上并行展示。',
      boundary: '示例边界：角色、标识与控制字段均为合成数据；不证明任何实车状态、温升或发热功率',
    },
  ];
  const revealAt = [1, 6.5, 12, 17.5];
  return (
    <AbsoluteFill style={{background: colors.bg, color: colors.fg, fontFamily: font}}>
      <Backdrop />
      <div style={{position: 'absolute', left: 70, right: 70, top: 48}}>
        <div style={{fontSize: 25, color: colors.info, fontFamily: mono}}>VGUI 全链路 · 结论与证据边界</div>
        <div style={{fontSize: 47, fontWeight: 850, marginTop: 8}}>从词条注册到合成响应示例，分清原理与证据边界</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 158,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
        }}
      >
        {cards.map((card, index) => {
          const p = ease(clamp01((sec - revealAt[index]) / 0.8));
          return (
            <div
              key={card.title}
              style={{
                minHeight: 320,
                boxSizing: 'border-box',
                padding: '26px 30px',
                borderRadius: 16,
                border: `1px solid ${index === cards.length - 1 ? colors.ok : colors.border}`,
                background: index === cards.length - 1 ? 'rgba(34,197,94,0.1)' : 'rgba(22,27,38,0.94)',
                opacity: p,
                transform: `translateY(${(1 - p) * 18}px)`,
              }}
            >
              <div style={{fontSize: 31, fontWeight: 820, color: index === cards.length - 1 ? colors.ok : colors.info}}>
                {card.title}
              </div>
              <div style={{marginTop: 14, fontSize: 25, lineHeight: 1.48, overflowWrap: 'anywhere'}}>{card.text}</div>
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: `1px solid ${colors.border}`,
                  color: colors.muted,
                  fontSize: 24,
                  lineHeight: 1.4,
                  overflowWrap: 'anywhere',
                }}
              >
                {card.boundary}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          bottom: 38,
          color: colors.muted,
          fontSize: 21,
          textAlign: 'center',
        }}
      >
        默认静音 · TTS 起止仅为合成演示，不伪造音频 · 演示状态不代表实车控制结果
      </div>
    </AbsoluteFill>
  );
};
