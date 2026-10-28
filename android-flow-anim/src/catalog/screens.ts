import type {ScreenDef} from './types';

export const SCREENS: ScreenDef[] = [
  {id: 'launcher', title: 'Launcher', bg: '#1e3a5f', kind: 'grid'},
  {id: 'app-opening', title: 'com.foo 打开中（Shell 动画）', bg: '#14532d', kind: 'opening'},
  {id: 'splash-opening', title: '启动窗口放大（OPEN 动画）', bg: '#0f3d2e', kind: 'opening'},
  {id: 'splash', title: '启动窗口（Splash）', bg: '#0f3d2e', kind: 'splash'},
  {id: 'app', title: 'com.foo', bg: '#14532d', kind: 'list'},
  {id: 'home-returning', title: '应用缩回图标（Launcher 远程动画）', bg: '#14532d', kind: 'closing', animMs: 298},
  // 输入流程：只有一个 Button 的界面（text = 按钮文字）
  {id: 'btn', title: 'com.foo · 一个 Button', bg: '#0f172a', kind: 'button', text: '点我'},
  {id: 'btn-pressed', title: '按下（pressed）', bg: '#0f172a', kind: 'button', text: '点我', pressed: true},
  {id: 'btn-clicked-pressed', title: '新文字（还在按下态）', bg: '#0f172a', kind: 'button', text: '已点击 1 次', pressed: true},
  {id: 'btn-clicked', title: 'onClick → setText', bg: '#0f172a', kind: 'button', text: '已点击 1 次'},
  {id: 'btn-focused', title: '按键：Button 有焦点', bg: '#0f172a', kind: 'button', text: '已点击 1 次', focused: true},
  {id: 'btn-key-pressed', title: 'ENTER 按下', bg: '#0f172a', kind: 'button', text: '已点击 1 次', focused: true, pressed: true},
  {id: 'btn-key-clicked', title: 'ENTER 抬起 → onClick', bg: '#0f172a', kind: 'button', text: '已点击 2 次', focused: true},
  // IME 对照：同一界面多一个 EditText，软键盘显示
  {id: 'form-ime', title: 'EditText 获焦 · 软键盘', bg: '#0f172a', kind: 'button', text: '点我', edit: '', ime: ' '},
  {id: 'form-ime-n', title: 'IME 拼写中：n', bg: '#0f172a', kind: 'button', text: '点我', edit: '', ime: 'n  │ 你  呢  那  能'},
  {id: 'form-ime-commit', title: 'commitText("你")', bg: '#0f172a', kind: 'button', text: '点我', edit: '你', ime: ' '},
  {id: 'black', title: '黑屏', bg: '#000', kind: 'black'},
  {id: 'bootloader-logo', title: '厂商 Logo（Bootloader / Kernel 阶段）', bg: '#000', kind: 'logo', text: 'VENDOR LOGO'},
  {id: 'bootanim', title: '开机动画（bootanimation）', bg: '#000', kind: 'bootanim'},
];
