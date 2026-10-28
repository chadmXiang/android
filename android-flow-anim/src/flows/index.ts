import {addWindowClassScript} from './classes/addWindow';
import {serviceAnrScript, serviceStartScript} from './am/serviceStart';
import {coldLaunchScript} from './launch/coldLaunch';
import {bootFullScript} from './boot/bootFull';
import {imeKeyScript} from './input/imeKey';
import {inputFlowScript} from './input/inputFlow';
import {startActivityClassScript} from './classes/startActivity';
import {frameScript} from './render/frame';
import {doubleScript, tripleScript} from './render/tripleBuffer';
import {appLaunchScript} from './system/appLaunch';
import {bootScript} from './system/boot';
import {homeKeyScript} from './system/homeKey';
import {surfaceTreeScript} from './wm/surfaceTree';

import {vguiAndroidScript} from './vgui/androidFlow';
import {vguiChainScript} from './vgui/chainFlow';
export const ALL_SCRIPTS = [
  frameScript,
  tripleScript,
  doubleScript,
  surfaceTreeScript,
  appLaunchScript,
  homeKeyScript,
  bootScript,
  startActivityClassScript,
  addWindowClassScript,
  serviceStartScript,
  serviceAnrScript,
  coldLaunchScript,
  inputFlowScript,
  imeKeyScript,
  bootFullScript,
  vguiChainScript,
  vguiAndroidScript,
];
