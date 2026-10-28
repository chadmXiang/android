import React from 'react';
import {serviceAnrScript, serviceAnrStateStory, serviceCompareStory, serviceStartScript} from '../../flows/am/serviceStart';
import {makeTemplateScene} from '../../layouts/TemplateScene';
import {SummaryCard, TitleCard} from '../../views/Cards';

export const ServiceTitleScene: React.FC = () => (
  <TitleCard
    kicker="AOSP · ActiveServices（示意时序，方法名对照源码）"
    title="Service 启动与 Service ANR"
    subtitle="bumpServiceExecutingLocked 计数 + 计时 → serviceDoneExecuting 归零取消 → 超时 appNotResponding"
  />
);

/** 状态驱动模板：kind 写在脚本里，场景只需要脚本 + 分镜 */
export const ServiceStateScene = makeTemplateScene({script: serviceAnrScript, story: serviceAnrStateStory});

/** 对比模板：A 正常、B ANR，共用时间轴 */
export const ServiceCompareScene = makeTemplateScene({
  script: serviceStartScript,
  compare: serviceAnrScript,
  kind: 'compare',
  story: serviceCompareStory,
  title: '正常 vs ANR',
  subtitle: '同一个 startService · 差异从主线程处理 CREATE_SERVICE 开始',
});

export const ServiceEndingScene: React.FC = () => (
  <SummaryCard
    heading="Service ANR 的四个要点"
    lines={[
      ['计数决定计时', 'bumpServiceExecutingLocked 让 executeNesting++，从 0 起时启动 mActiveServiceAnrTimer'],
      ['回报才能取消', '每个回调做完 serviceDoneExecuting，nesting 减到 0 才 cancel 计时器'],
      ['期限看前后台', '前台 SERVICE_TIMEOUT = 20s × HW_TIMEOUT_MULTIPLIER，后台 ×10'],
      ['卡在主线程', 'onCreate / onStartCommand 都跑在主线程，阻塞它就等于让计时器自然到期'],
    ]}
  />
);
