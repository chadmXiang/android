import {call, mark, msg, oneway, span} from '../../dsl/builders';
import type {FlowScript} from '../../dsl/types';

/**
 * VGUI 语音链路全景（示意时序 ms，非实测）——术语与链路对照语雀《VGUI 技术分享》。
 * 这是"云端视角"：不画 Android 进程细节，只画模块之间的接力。
 *
 * 两个阶段：
 *   ① 注册：页面变化触发提取词条 → magiccubed 合并生成离线 JSGF 语法 → 词表上报云端（xiaoyunD）
 *   ② 命中：麦克风 → ASR → 端侧 JSGF / 云侧 NLU 并行 → CDR 仲裁 → DM 生成 Action →
 *            magiccubed 分发 → CAF/应用 执行 → 页面更新（所见即可说闭环）
 *
 * 版本口径：1.0 = 应用 addVoiceCommand 自报热词 + magiccubed 兜底匹配（high/middle/low 子集）；
 *           2.0 = 框架自动扫描可说控件，title/subtitle 直接进 JSGF，走 Action://vgui/auto_widget。
 */

export const vguiChainScript: FlowScript = {
  id: 'vgui-voice-chain',
  kind: 'process',
  title: 'VGUI 语音链路全景',
  subtitle: '注册把词条送进词典 · 命中把一句话变回一次操作（示意时序，术语对照语雀《VGUI 技术分享》）',
  window: [0, 800],
  timeUnit: 'ms',
  processes: [
    {id: 'dev', label: '车载语音设备', layer: 'hw'},
    {id: 'engine', label: 'magiccubed · 端侧语音中枢', layer: 'native'},
    {id: 'cloud', label: 'xiaoyun / xiaoyunD · 云端', layer: 'systemui'},
    {id: 'app', label: 'CAF / 应用（页面）', layer: 'app'},
  ],
  lanes: [
    {id: 'mic', label: '麦克风 · KWS', process: 'dev'},
    {id: 'asr', label: 'ASR 流式识别', process: 'engine'},
    {id: 'nlu', label: 'NLU 端侧 JSGF', process: 'engine'},
    {id: 'hub', label: 'magiccubed 中枢（注册/分发）', process: 'engine'},
    {id: 'cnlu', label: '云侧 NLU 模型', process: 'cloud'},
    {id: 'cdr', label: 'CDR 仲裁', process: 'cloud'},
    {id: 'dm', label: 'DM 对话管理', process: 'cloud'},
    {id: 'caf', label: 'CAF / 应用（页面）', process: 'app'},
  ],
  resources: [],
  chapters: [
    {id: 'reg', title: '注册 · 词条进词典', start: 0, end: 300},
    {id: 'hit', title: '命中 · 一句话变点击', start: 300, end: 800},
  ],
  events: [
    // —— ① 注册 ——
    mark(6, 'caf', '触发：页面可见性 / 内容变化 / 能力配置', 'info'),
    span('caf', 10, 55, 'CAF / 框架提取页面词条（2.0：自动扫描 6 类可说控件）', 'cpu'),
    mark(34, 'caf', '1.0 应用自报热词 · 2.0 框架自动扫', 'info'),
    call(60, 'caf', 'hub', 'updateConfig(vocabs / vocabs_v2)', 80),
    span('hub', 80, 125, '合并多包词条 · 生成离线 JSGF 语法', 'cpu'),
    span('nlu', 95, 150, '装载 JSGF：<前缀词> + title + subtitle', 'cpu'),
    oneway(150, 'hub', 'cnlu', '上报词表 → xiaoyunD 云端词表'),
    span('cnlu', 155, 200, '云端词表入库（供云侧 NLU / CDR 候选）', 'cpu'),
    mark(215, 'hub', '滚动 / 弹窗 / 切页 → 重扫重报', 'info'),

    // —— ② 命中 ——
    mark(300, 'mic', '示例话术：「制热」', 'ok'),
    span('mic', 300, 340, 'KWS 唤醒 / 免唤醒检测', 'cpu'),
    oneway(340, 'mic', 'asr', '音频流'),
    span('asr', 342, 395, 'ASR 流式识别', 'cpu'),
    mark(396, 'asr', 'query = 制热', 'ok'),
    oneway(400, 'asr', 'nlu', 'query（端侧）'),
    msg(402, 'asr', 'cnlu', 'query（云侧并行）'),
    span('nlu', 405, 455, '端侧 JSGF 命中：前缀词 + 词条', 'cpu'),
    mark(456, 'nlu', 'domain = vgui_widget（离线命中）', 'ok'),
    span('cnlu', 405, 470, '云侧 NLU 候选（模型 / 云端词表）', 'cpu'),
    span('cdr', 470, 520, 'CDR 仲裁：快捷指令 > 热词 > 系统词 > 技能', 'cpu'),
    mark(521, 'cdr', '热词命中 → vgui_widget 优先', 'ok'),
    span('dm', 525, 575, 'DM：生成 Action://vgui/auto_widget', 'cpu'),
    mark(570, 'dm', 'actionParam = viewType/item/subTitle/intent', 'info'),
    call(580, 'dm', 'hub', '端云协议返回结果', 600),
    span('hub', 600, 660, '响应规则 / 路由策略：active · pageinfo · 多屏多音区', 'cpu'),
    oneway(665, 'hub', 'caf', '分发到目标应用'),
    span('caf', 670, 730, 'viewType + item 定位控件 → 点击 / 切换 / 滑动', 'cpu'),
    mark(745, 'caf', '页面更新 · 所见即可说闭环', 'ok'),
  ],
};
