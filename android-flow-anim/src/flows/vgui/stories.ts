import type {CodeRef, FlowStory} from '../../dsl/types';

/**
 * Teaching sequences use illustrative timing; the heating case carries real log timestamps.
 * Keep narration, process events and method references separate from physical outcome claims.
 */

const C = (file: string, note?: string): CodeRef => ({file, note});
const YUQUE = '语雀 · 《VGUI 技术分享》';

export const chainRegisterStory: FlowStory = {
  steps: [
    {
      to: 55,
      move: 2,
      hold: 9,
      view: [0, 300],
      focus: ['caf'],
      caption: 'VGUI = 所见即可说：看得见的控件，说出来就能操作。第一步是把词条注册给语音：页面可见性、内容、能力配置一变就触发提取；1.0 应用自报热词，2.0 框架自动扫描。',
      code: C(YUQUE, '§2-2 注册流程与触发时机\n§3-1 vgui 1.0：addVoiceCommand / customCommands\n§3-2 vgui 2.0：框架自动扫描 6 类可说控件'),
    },
    {
      to: 150,
      move: 3,
      hold: 9,
      focus: ['hub', 'nlu'],
      caption: '词条经 updateConfig 进入 magiccubed（端侧语音中枢）：多包词条合并、生成离线 JSGF 语法——前缀词 + 控件 title + subtitle。词典就装在端侧，断网也能命中。',
      code: C(YUQUE, '§3-2：JSGF = <select_prefix> + Selectable.title + subtitle'),
    },
    {
      to: 215,
      move: 2.5,
      hold: 8,
      focus: ['cnlu'],
      caption: '同一份词表还上报云端（xiaoyunD），供云侧 NLU / CDR 生成候选：端侧管"说得准"，云端兜底语义。注册不是一次性的——滚动、弹窗、切页都会重扫重报。',
      code: C(YUQUE, '§2-2：注册链路 触发时机 → CAF 提取 → magiccubed → xiaoyunD 云端词表'),
    },
    {
      to: 300,
      move: 2,
      hold: 7,
      view: [0, 800],
      caption: '注册把页面词条送进词典。下一章以「制热」为例演示反向链路；最后用合成教学示例串起页面点击、控制回读与反馈。',
    },
  ],
};

export const chainHitStory: FlowStory = {
  steps: [
    {
      to: 396,
      move: 2.5,
      hold: 8,
      view: [300, 800],
      focus: ['mic', 'asr'],
      caption: '以「制热」为例：唤醒后音频进入 ASR，识别出 query 文本。本章时序与端云分工是示意；后面的合成案例使用文本注入，并设定本地未命中。',
      code: C(YUQUE, '§2-1 命中流程：唤醒 → ASR'),
    },
    {
      to: 470,
      move: 2.5,
      hold: 9,
      focus: ['nlu', 'cnlu'],
      caption: '理解可以有端云两路：端侧用 JSGF 和已注册词条匹配，云侧模型给出语义候选。无论来自哪路，都必须映射回页面上可操作的控件。',
      code: C(YUQUE, '§2-1：NLU 端侧 JSGF + 云侧模型\n§3-2：JSGF 命中即 vgui_widget 域'),
    },
    {
      to: 575,
      move: 3,
      hold: 9,
      focus: ['cdr', 'dm'],
      caption: 'CDR 仲裁候选优先级：快捷指令 > 热词 > 系统词 > 技能。选中后由 DM 生成 Action://vgui/auto_widget，actionParam 携带 viewType / item / subTitle / intent。',
      code: C(YUQUE, '§3-3：响应顺序仲裁\nAction://vgui/auto_widget + createActionParam'),
    },
    {
      to: 660,
      move: 2.5,
      hold: 8,
      focus: ['hub'],
      caption: '结果经端云协议回到 magiccubed：按响应规则与路由策略（active、pageinfo、多屏多音区）选目标应用，分发出去。',
      code: C(YUQUE, '§2-1：magiccubed 端侧中枢分发'),
    },
    {
      to: 760,
      move: 2.5,
      hold: 9,
      focus: ['caf'],
      caption: '应用按 viewType + item 找控件，再执行点击 / 开关 / 滑动。「制热」是 Touchable，动作是点击；点击成功不等于物理制热已生效，业务结果需另查。',
    },
  ],
};

export const androidRegisterStory: FlowStory = {
  steps: [
    {
      to: 128,
      move: 2.5,
      hold: 9,
      view: [0, 510],
      focus: ['ss:main', 'vb:svc', 'va:main'],
      caption: '先把路铺好：system_server 起好 voice_bridge 服务，绑定适配层 com.ebanma.voicebridge；适配层再拉起 voiceassistant、注册回调。链路就绪后重放缓存的注册——之后谁注册都不丢。',
      code: C('VoiceBridgeManagerService.java', 'publishBinderService("voice_bridge")\nbindToEngine → bindService（显式 Intent）\n→ reRegisterAllClients'),
    },
    {
      to: 205,
      move: 3,
      hold: 9,
      focus: ['foo:main'],
      caption: '应用一打开就触发扫描：窗口新增 / 获焦、a11y 内容变化、滚动停止都会 makeDirty。autoRegisterViewGroup 从 decor 递归往下扫，Compose 界面走 VoiceComposeScanner。',
      code: C('ViewRootImpl.java · VoiceLifecycleObserver', 'onWindowAdded / onResume / handleWindowFocusChanged\nperformTraversals 尾消费 mVoiceViewStateChanged\n→ autoRegisterViewGroup(decor)'),
    },
    {
      to: 250,
      move: 2,
      hold: 9,
      caption: '每个控件过 registerViewIfEligible：viewType 七类判定；title 取控件文本、voiceTitle、兄弟标签兜底；文本规范化（25.5° →「25点5度」），可见面积过半才收。',
      code: C('registerViewIfEligible · VoiceViewFilter · VoiceTextNormalizer', 'title 来源：自身文本 → voiceTitle → findSiblingLabel\nshouldRegister：可见面积 ≥ 50%\nnormalize：符号改写为可读文本'),
    },
    {
      to: 320,
      move: 2.5,
      hold: 9,
      caption: 'makeDirty 防抖 200ms 后 updateRegistration 去重打包：hotWords（1.0 热词）+ systemCmds（系统词）+ autoWidgets（2.0 控件词条），经 AIDL① registerBatch 交给 voice_bridge。',
      code: C('VoiceManager.java', 'updateRegistration → isCommandListEqual 去重\nregisterBatch(hotWords, systemCmds, autoWidgets)\nIVoiceBridgeManagerService · AIDL①'),
    },
    {
      to: 445,
      move: 3,
      hold: 10,
      focus: ['ss:main', 'vb:svc', 'vb:eng'],
      caption: '服务缓存校验后经 AIDL② 转发（systemCmds 故意不转，引擎内置「下一页/返回」）；适配层 100ms 合并、全车并集成一份 slot——先 clear 再 add，不 clear 词典只增不减。',
      code: C('VoiceEngineClient.java', 'pushEngineSlotLocked：全车一份 slot，各包并集\n先 clearVoiceCommands 再 addVoiceCommands/V2\n（否则引擎去重累积，词典无限膨胀）'),
    },
    {
      to: 505,
      move: 2,
      hold: 8,
      focus: ['va:main', 'mc:eng'],
      caption: 'voiceassistant 收到 executeCmd（V1 cmdId=11 / V2 cmdId=83）转交 magiccubed，JSGF 词典就位。热词到此给到了语音引擎。',
      code: C('VGUIManagerProxy / VoiceBusiness.java', 'executeCmd(cmdId=11 V1 / 83 V2) → magiccubed'),
    },
  ],
};

export const androidHitStory: FlowStory = {
  steps: [
    {
      to: 570,
      move: 2,
      hold: 8,
      view: [510, 1020],
      focus: ['mic', 'mc:eng'],
      caption: 'Android 侧以冰箱页面「制热」为例。端侧规则或云模型产生结果；后面的合成案例用演示 queryId 关联各阶段，不能仅凭页面注册就断言 JSGF 命中。',
      code: C('VoiceAssistant · 命中链路', '2.0 外层 action=alichat://hf/vgui\n→ link_param.extend.tools[]'),
    },
    {
      to: 665,
      move: 2.5,
      hold: 9,
      focus: ['va:main', 'vb:svc'],
      caption: '2.0 tool 帧回到适配层：ResultParser 把 vgui_widget 映射为框架 auto_widget；displayId=-1 正常，交由服务仲裁。V2 是回调通道，不是协议判据。',
      code: C('ResultParser.java', 'parseVguiResult → parseToolEnvelope\nvgui_widget + arguments.action/item/viewType\n→ VoiceResultData；displayId=INVALID'),
    },
    {
      to: 745,
      move: 3,
      hold: 9,
      focus: ['ss:main'],
      caption: 'voice_bridge 仲裁目标：候选 = 各屏焦点客户端 ∪ 注册了该词条的非焦点客户端（最多 3 个）；canServe 分档、音区顺位排先后，每步 300ms 超时就级联下一个候选。',
      code: C('VoiceBridgeManagerService.java · arbitrateTargetLocked', '候选截 3 个 · 步超时 300ms\nfail 会被仲裁吞掉并级联 miss'),
    },
    {
      to: 800,
      move: 2,
      hold: 9,
      focus: ['foo:main'],
      caption: 'AIDL① onVoiceResult 投给胜出的应用：VoiceManager 在主线程 selectViewByVoice 文本直查注册表；同名控件 ≥2 个先走消歧会话，问用户「第几个」。',
      code: C('VoiceManager.java', 'onVoiceResult（主 looper）\nmatchesAutoWidget → findVirtualNodeRegistrationByTitle\n同名 ≥2 → VoiceDisambiguationSession.requestDisambiguation'),
    },
    {
      to: 880,
      move: 2.5,
      hold: 9,
      caption: 'View 走 dispatchVoiceEvent，Compose 走虚拟节点。本例制热是 Touchable，执行 CLICK；performAction(CLICK) 的 result=true 才证明点到，不只看宿主 View。',
      code: C('VoiceViewDelegate · VoiceComposeScanner', 'View：OnVoiceListener → 默认动作\nCompose：virtualNode dispatch → performAction(CLICK)\nVoiceAnimationManager：命中动效'),
    },
    {
      to: 1005,
      move: 3,
      hold: 10,
      focus: ['vb:svc'],
      caption: 'hitBack 上报成败，失败可级联；成功反馈回引擎并请求 NLG / TTS。play 仅证明请求发出，onStart / onDone 才证明播放完成。物理制热另查车控状态。',
      code: C('VoiceEngineClient · TtsFeedbackHelper.java', 'hitBack(queryId, success, speak)\n→ reportVGUIFeedback → NLG → playTTS\n→ onStart / onDone（或 onStop / onError）'),
    },
  ],
};
