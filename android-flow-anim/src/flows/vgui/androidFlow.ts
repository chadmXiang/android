import {call, mark, oneway, span} from '../../dsl/builders';
import type {FlowScript} from '../../dsl/types';

/**
 * Android(AOSP, frameworks-base) 上 VGUI 的注册与命中（示意时序 ms，非实测）。
 * 类名 / 方法名对照 aosp/vgui 源码分析文档，行号未核对，只到方法级。
 *
 * 进程链：com.foo(应用) → system_server(voice_bridge 服务) → com.ebanma.voicebridge(适配层)
 *         → com.ebanma.voiceassistant(语音助手) → magiccubed(语音引擎) → 云端。
 * 两次 AIDL：① IVoiceBridgeManagerService（应用 ↔ 服务，ServiceManager.getService("voice_bridge")）
 *           ② IVoiceBridgeService（服务 ↔ 适配层，显式 Intent bind）。
 *
 * 两个阶段：
 *   ① 注册：开机铺路（服务起、adapter 绑定）→ 应用打开触发扫描 → 200ms 防抖 →
 *            registerBatch(AIDL①) → forwardRegisterBatch(AIDL②) → 全车并集 slot → 引擎 JSGF 词典
 *   ② 命中：说话 → 引擎 JSGF/云 NLU 命中 → 逐级回调到 voice_bridge → 多屏多音区仲裁 →
 *            应用 selectViewByVoice → 默认动作 + 命中动效 → hitBack 闭环 → TTS 播报
 */

export const vguiAndroidScript: FlowScript = {
  id: 'vgui-android',
  kind: 'process',
  title: 'VGUI 在 Android 上的注册与命中',
  subtitle: '应用 ↔ voice_bridge ↔ adapter ↔ voiceassistant ↔ magiccubed（示意时序，方法名对照 frameworks-base 分析）',
  window: [0, 1020],
  timeUnit: 'ms',
  processes: [
    {id: 'dev', label: '麦克风（多音区）', layer: 'hw'},
    {id: 'foo', label: 'com.banma.smartcar（应用）', layer: 'app'},
    {id: 'ss', label: 'system_server · voice_bridge', layer: 'system_server'},
    {id: 'vb', label: 'com.ebanma.voicebridge（适配层）', layer: 'native'},
    {id: 'va', label: 'com.ebanma.voiceassistant', layer: 'native'},
    {id: 'mc', label: 'magiccubed（语音引擎）', layer: 'native'},
  ],
  lanes: [
    {id: 'foo:main', label: 'com.banma.smartcar · main', sub: 'VoiceManager / ViewRootImpl / Compose', process: 'foo'},
    {id: 'ss:main', label: 'VoiceBridgeManagerService', sub: 'system_server', process: 'ss'},
    {id: 'vb:svc', label: 'VoiceBridgeAdapterService', sub: '适配层 · binder', process: 'vb'},
    {id: 'vb:eng', label: 'VoiceEngineClient', sub: '适配层 · 推送线程', process: 'vb'},
    {id: 'va:main', label: 'VGUIManagerProxy', sub: 'VoiceBusiness · voiceassistant', process: 'va'},
    {id: 'mc:eng', label: '引擎 · ASR/NLU/JSGF', sub: 'magiccubed', process: 'mc'},
    {id: 'mic', label: '麦克风 · 用户', process: 'dev'},
  ],
  resources: [],
  chapters: [
    {id: 'boot', title: '开机', start: 0, end: 135},
    {id: 'reg', title: '注册 · 扫描进引擎', start: 135, end: 510},
    {id: 'hit', title: '命中 · 仲裁与响应', start: 510, end: 1020},
  ],
  events: [
    // —— ① 开机铺路 ——
    span('ss:main', 0, 40, 'SystemServer 启动 voice_bridge 服务（publishBinderService）', 'cpu'),
    call(40, 'ss:main', 'vb:svc', 'bindToEngine → bindService（显式 Intent）', 70),
    span('vb:svc', 70, 90, 'adapter onCreate → VoiceEngineClient', 'cpu'),
    call(90, 'vb:svc', 'va:main', 'bindServiceAsUser → voiceassistant SDK', 120),
    oneway(125, 'va:main', 'vb:svc', 'SDK onReady → registerCallback'),
    oneway(128, 'vb:svc', 'ss:main', 'reRegisterAllClients（重放缓存）'),

    // —— ② 注册：扫描 → 防抖 → registerBatch → 引擎 ——
    span('foo:main', 140, 203, '应用打开 → autoRegisterViewGroup(decor) 递归扫描', 'cpu'),
    mark(162, 'foo:main', '触发：窗口获焦 / 内容变化 / 滚动停止', 'info'),
    span('foo:main', 205, 250, 'registerViewIfEligible：viewType 7 类判定', 'cpu'),
    mark(212, 'foo:main', 'title：控件文本 → voiceTitle → 兄弟标签', 'info'),
    mark(238, 'foo:main', 'VoiceViewFilter：可见面积 ≥ 50% 才收', 'info'),
    mark(244, 'foo:main', 'VoiceTextNormalizer：25.5° →「25点5度」', 'info'),
    span('foo:main', 255, 295, 'makeDirty → 200ms 防抖 → updateRegistration', 'cpu'),
    call(300, 'foo:main', 'ss:main', 'AIDL① registerBatch(hotWords, systemCmds, autoWidgets)', 320),
    span('ss:main', 322, 350, 'ClientState 缓存 · isPackageOwnedByUid 校验', 'cpu'),
    call(355, 'ss:main', 'vb:svc', 'AIDL② forwardRegisterBatch', 375),
    mark(360, 'ss:main', 'systemCmds 不转发：引擎内置「下一页/返回」', 'warn'),
    span('vb:svc', 380, 410, 'VoiceEngineClient.replaceRegistration（100ms 合并）', 'cpu'),
    span('vb:eng', 415, 445, 'pushEngineSlotLocked：全车一份 slot · 各包并集', 'cpu'),
    mark(428, 'vb:eng', '先 clear 再 add：不 clear 词典只增不减', 'warn'),
    call(450, 'vb:eng', 'va:main', 'executeCmd(cmdId=11 V1 / 83 V2)', 470),
    call(475, 'va:main', 'mc:eng', 'VGUIManagerProxy → 引擎词典', 495),
    mark(505, 'mc:eng', 'JSGF 就位：前缀词 + title/subtitle', 'ok'),

    // —— ③ 命中：说话 → 返回 → 仲裁 → 响应 → hitBack ——
    mark(510, 'mic', '示例话术：「制热」', 'ok'),
    oneway(515, 'mic', 'mc:eng', '音频流（多音区拾音）'),
    span('mc:eng', 520, 570, 'KWS / ASR → query', 'cpu'),
    mark(570, 'mc:eng', '端侧规则 / 云侧模型：匹配已注册的词条', 'ok'),
    span('mc:eng', 575, 615, '2.0 tool 帧：action=alichat://hf/vgui', 'cpu'),
    mark(600, 'mc:eng', 'tools[].name=vgui_widget · arguments.item=制热', 'info'),
    oneway(620, 'mc:eng', 'va:main', 'VGUIManagerProxy.handleDialogResult'),
    oneway(625, 'va:main', 'vb:svc', 'notifyVGUICallbackV2'),
    span('vb:svc', 630, 665, 'deliverMatch → ResultParser：映射为 Action://vgui/auto_widget', 'cpu'),
    mark(655, 'vb:svc', 'displayId=INVALID · 音区顺位', 'info'),
    call(670, 'vb:svc', 'ss:main', 'AIDL② onVoiceResult', 690),
    span('ss:main', 695, 745, 'dispatchVoiceResult → arbitrateTargetLocked', 'cpu'),
    mark(710, 'ss:main', '候选：各屏焦点 ∪ 含该词条的非焦点客户端（≤3）', 'info'),
    mark(725, 'ss:main', 'canServe 分档 → 音区顺位 → 300ms 超时级联', 'info'),
    oneway(750, 'ss:main', 'foo:main', 'AIDL① IVoiceBridgeCallback.onVoiceResult'),
    span('foo:main', 755, 800, 'VoiceManager.onVoiceResult → selectViewByVoice', 'cpu'),
    mark(770, 'foo:main', '同名 ≥2：VoiceDisambiguationSession 问「第几个」', 'info'),
    span('foo:main', 805, 845, 'View：dispatchVoiceEvent；Compose：virtualNode dispatch', 'cpu'),
    mark(825, 'foo:main', 'Touchable → CLICK；开关 / 滑动按 viewType 分派', 'ok'),
    span('foo:main', 850, 880, 'VoiceAnimationManager：命中位置高亮', 'gpu'),
    call(885, 'foo:main', 'ss:main', 'hitBack(queryId, success, speak)', 905),
    span('ss:main', 910, 930, 'fail 候选被仲裁吞掉 → 级联下一个', 'cpu'),
    call(935, 'ss:main', 'vb:svc', 'hitBack → reportFeedback', 955),
    span('vb:svc', 960, 995, 'reportVGUIFeedback → NLG → TTS 请求与播放回调', 'cpu'),
    mark(1005, 'foo:main', '框架响应闭环；业务生效另看应用 / 车控反馈', 'ok'),
  ],
};
