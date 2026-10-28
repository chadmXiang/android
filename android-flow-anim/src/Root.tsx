import React from 'react';
import {AbsoluteFill, Composition, interpolate, Series, useCurrentFrame} from 'remotion';
import {validateScript} from './dsl/validate';
import {TEMPLATE_SCENES} from './layouts/TemplateScene';
import {validateStory} from './layouts/validateStory';
import {ALL_SCRIPTS} from './flows';
import {colors, FPS, HEIGHT, WIDTH} from './theme';
import {APP_LAUNCH_LEGACY_SCENES, APP_LAUNCH_SCENES} from './videos/app-launch';
import {BOOT_LEGACY_SCENES, BOOT_SCENES} from './videos/boot';
import {FRAME_LIFECYCLE_SCENES, type SceneEntry} from './videos/frame-lifecycle';
import {HOME_KEY_LEGACY_SCENES, HOME_KEY_SCENES} from './videos/home-key';
import {KEY_CLASSES_SCENES} from './videos/key-classes';
import {INPUT_FLOW_SCENES} from './videos/input-flow';
import {SERVICE_ANR_SCENES} from './videos/service-anr';
import {VGUI_FLOW_SCENES} from './videos/vgui-flow';

for (const s of ALL_SCRIPTS) {
  const errs = validateScript(s);
  if (errs.length) errs.forEach((e) => console.warn(`[flow:${s.id}] ${e}`));
  else console.info(`[flow:${s.id}] 校验通过`);
}

// 停点校验：模板场景在各自 videos/*/scenes.tsx 里创建时自动登记
for (const c of TEMPLATE_SCENES) {
  const name = c.title ?? c.script.title;
  const warns = validateStory({name, ...c, container: c.options?.taskStack?.container});
  if (warns.length) warns.forEach((w) => console.warn(`[story:${name}] ${w}`));
  else console.info(`[story:${name}] 停点检查通过`);
}

const SceneFade: React.FC<{frames: number; children: React.ReactNode}> = ({frames, children}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8, frames - 8, frames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{opacity: o, background: colors.bg}}>{children}</AbsoluteFill>;
};

const makeVideo = (scenes: SceneEntry[]): React.FC => {
  const Video: React.FC = () => (
    <AbsoluteFill style={{background: '#000'}}>
      <Series>
        {scenes.map((s) => (
          <Series.Sequence key={s.id} durationInFrames={s.frames}>
            <SceneFade frames={s.frames}>
              <s.Component />
            </SceneFade>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
  return Video;
};

const VIDEOS: {id: string; prefix: string; scenes: SceneEntry[]}[] = [
  {id: 'FrameLifecycle', prefix: 'Frame', scenes: FRAME_LIFECYCLE_SCENES},
  {id: 'AppLaunch', prefix: 'Launch', scenes: APP_LAUNCH_SCENES},
  {id: 'AppLaunchLegacy', prefix: 'LaunchOld', scenes: APP_LAUNCH_LEGACY_SCENES},
  {id: 'HomeKey', prefix: 'Home', scenes: HOME_KEY_SCENES},
  {id: 'HomeKeyLegacy', prefix: 'HomeOld', scenes: HOME_KEY_LEGACY_SCENES},
  {id: 'Boot', prefix: 'Boot', scenes: BOOT_SCENES},
  {id: 'BootLegacy', prefix: 'BootOld', scenes: BOOT_LEGACY_SCENES},
  {id: 'KeyClasses', prefix: 'Classes', scenes: KEY_CLASSES_SCENES},
  {id: 'ServiceAnr', prefix: 'Service', scenes: SERVICE_ANR_SCENES},
  {id: 'InputFlow', prefix: 'Input', scenes: INPUT_FLOW_SCENES},
  {id: 'VguiFlow', prefix: 'Vgui', scenes: VGUI_FLOW_SCENES},
];

const COMPONENTS = VIDEOS.map((v) => ({...v, Component: makeVideo(v.scenes)}));

export const RemotionRoot: React.FC = () => (
  <>
    {COMPONENTS.map((v) => (
      <React.Fragment key={v.id}>
        <Composition
          id={v.id}
          component={v.Component}
          durationInFrames={v.scenes.reduce((s, x) => s + x.frames, 0)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        {v.scenes.map((s) => (
          <Composition
            key={`${v.prefix}-${s.id}`}
            id={`${v.prefix}-${s.id}`}
            component={s.Component}
            durationInFrames={s.frames}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
          />
        ))}
      </React.Fragment>
    ))}
  </>
);
