import type {FlowStory} from '../../dsl/types';

export interface HeatingStep {
  title: string;
  time: string;
  actor: string;
  lines: string[];
  meaning: string;
}

const DEMO_QUERY_ID = 'demo-heating-query';

// Synthetic teaching data, not vehicle logs. Actors, IDs, and fields are illustrative.
// One demo query; vehicle control and TTS branches are logically parallel.
export const heatingSteps: HeatingStep[] = [
  {
    title: '先注册：制热是可点击词条',
    time: '示意 · 注册阶段',
    actor: '演示应用 → 注册桥 → 词条引擎',
    lines: [
      'demo.register item=制热 viewType=Touchable',
      'demo.registry app=演示应用 widget=制热',
      'demo.engine received item=制热 viewType=Touchable',
    ],
    meaning: '合成示例：应用将制热注册为 Touchable，词条引擎收到相同字面量。核对注册两端只能确认词条送达，不能据此认定当前 query 已被本地 NLU 命中。',
  },
  {
    title: '文本注入：建立演示 queryId',
    time: '示意 · 文本入口',
    actor: '演示文本入口 → 查询引擎',
    lines: [
      'demo.input source=text-injection',
      'demo.sendText text=制热',
      `demo.query queryId=${DEMO_QUERY_ID}`,
    ],
    meaning: '合成示例使用文本注入而非麦克风录音。演示 queryId 关联后续本地与云端结果、点击及反馈；它不是实测查询标识。',
  },
  {
    title: '本地 NLU：词表为空，未命中',
    time: '示意 · 本地处理',
    actor: '演示词表转换 → 本地 NLU',
    lines: [
      'demo.vocab original=[] rewritten=[]',
      'demo.local match=null',
      'demo.local tools=[] ishit=false',
    ],
    meaning: '合成示例设定原始与重写输入都没有 VGUI 词条，因此本地匹配为空、tools 为空且未命中。注册成功或 ASR 白名单不等于当前 NLU 输入已加载词条。',
  },
  {
    title: '云端命中：tool 映射回框架动作',
    time: '示意 · 云端返回',
    actor: '演示云端 → 结果解析器',
    lines: [
      `demo.cloud queryId=${DEMO_QUERY_ID} intent=hit`,
      'demo.tool kind=widget action=hit item=制热',
      'demo.tool viewType=Touchable',
      'demo.framework action=auto_widget item=制热',
    ],
    meaning: '合成示例中同一演示 query 收到云端控件命中，解析器将 tool 的 item、viewType 与 action 映射为框架动作。这是本地未命中后的云端结果，不是另一查询的成功记录。',
  },
  {
    title: '服务仲裁：选择能服务制热的页面',
    time: '示意 · 页面仲裁',
    actor: '演示仲裁器 → 制热页面',
    lines: [
      'demo.route target=由仲裁器选择',
      'demo.candidate 制热页面=可服务',
      'demo.candidate 其他页面=跳过',
      'demo.dispatch auto_widget → 制热页面',
    ],
    meaning: '合成示例由仲裁器选择具备制热控件的页面，其他候选页面跳过。框架动作交给胜出的应用页面，不代表所有屏幕各点击一次；页面名不是实际显示队列。',
  },
  {
    title: 'Compose：执行虚拟节点 CLICK',
    time: '示意 · 控件执行',
    actor: '演示控件分发 → Compose 节点',
    lines: [
      'demo.host type=AndroidComposeView',
      'demo.node target=演示制热按钮 action=CLICK result=true',
      'demo.animation target=演示制热按钮',
    ],
    meaning: '合成示例先找到 Compose 宿主，再对演示按钮执行 CLICK 并展示命中动效。真实排查时宿主可见不等于节点点击成功；点击成功后仍需继续核对车控回调。',
  },
  {
    title: '点击回调：下发制热控制请求',
    time: '示意 · 控制下发',
    actor: '演示页面 → 车控适配层 → 控制接收端',
    lines: [
      'demo.callback request.mode=HEATING',
      'demo.control operation=setMode target=演示制热设备',
      'demo.transport request=已下发',
    ],
    meaning: '合成示例中点击回调发出制热模式请求，车控适配层将请求传给接收端。下发仅说明请求已发出，是否接受与状态是否变化应由响应和回读分别确认。',
  },
  {
    title: '车控回读：模式与目标状态更新',
    time: '示意 · 控制回读',
    actor: '演示接收端 → 状态通道 → 演示页面',
    lines: [
      'demo.response operation=setMode status=SUCCESS',
      'demo.readback mode=IDLE → HEATING',
      'demo.readback targetTemperature=原目标 → 制热目标',
      'demo.app result={status:SUCCESS, mode:HEATING, refreshed:true}',
    ],
    meaning: '合成示例展示接收响应、模式与目标温度回读以及页面刷新，不给出实测温度。真实日志中的控制状态更新也不能单独证明实际温升或发热功率。',
  },
  {
    title: '并行反馈：hitBack 与 TTS 完成',
    time: '示意 · 与车控分支并行',
    actor: '演示反馈桥 → NLG / TTS',
    lines: [
      `demo.hitBack queryId=${DEMO_QUERY_ID} success=true speak=true`,
      `demo.reportVGUIFeedback queryId=${DEMO_QUERY_ID} synthetic=true`,
      'demo.tts text=制热指令已处理（演示）',
      `demo.tts onStart utteranceId=${DEMO_QUERY_ID}`,
      `demo.tts onDone utteranceId=${DEMO_QUERY_ID}`,
    ],
    meaning: '合成示例的 hitBack、反馈上报与 TTS 起止关联同一演示 query。反馈分支与车控分支逻辑并行，九步只是教学展示顺序，不表示播放完成依赖车控回读，也不提供实车播放证据。',
  },
];

export const heatingStory: FlowStory = {
  steps: heatingSteps.map((step, index) => ({
    to: index + 1,
    move: 2,
    hold: 12,
    caption: step.meaning,
    code: {
      file: 'src/flows/vgui/heatingCase.ts（合成教学数据）',
      note: `教学示意，非实车日志\n阶段：${step.title}\n演示 queryId=${DEMO_QUERY_ID}`,
    },
  })),
};
