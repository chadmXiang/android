# Android Study

Android 系统流程可视化与 Jetpack Compose 应用学习仓库。

## 项目与文档

| 路径 | 内容 | 说明 |
|---|---|---|
| `android-flow-anim/` | React + Remotion 的 Android 系统流程动画：渲染、应用启动、开机、输入、ANR、VGUI 等 | [动画项目文档](android-flow-anim/readme.md) |
| `Ledu/` | Jetpack Compose 应用「乐读」：本地音乐、RSS 新闻、发现、运动记录与轨迹回放 | 本页的构建、运行与配置说明 |

`agent.md` 是仅本地使用的私有开发资料，已加入忽略规则，不随仓库对外分发。

## 运行 android-flow-anim

需要 Node.js 和 npm；本机已使用 Node.js 22 验证。以下命令从仓库根目录开始执行：

```bash
cd android-flow-anim
npm ci
npm run dev -- --port=3100 --no-open
```

打开 [Remotion Studio](http://localhost:3100)。可先选择 `FrameLifecycle`、`Frame-Map` 或 `VguiFlow`，播放动画或拖动时间轴查看分镜。

- `npm ci` 的 `prepare` 脚本会补齐缺失的生成文件。
- 默认不启用旁白；生成旁白需执行 `npm run narrate`，之后用 `npm run dev:tts` 预览。
- 渲染示例：`npm run render:vgui`，视频输出至 `android-flow-anim/out/`。
- 更多动画、校验、渲染与 TTS 配置见 [项目文档](android-flow-anim/readme.md)。

## 运行 Ledu

### 环境

- JDK 17、Android SDK Platform 36，以及 Android SDK Platform-Tools（`adb`）。
- Gradle 8.13，由 wrapper 从 Gradle 官方地址下载，无需本机专用 ZIP 路径。
- 设置 `ANDROID_HOME` 指向本机 SDK，或在 `Ledu/local.properties` 中设置 `sdk.dir`；本机配置不提交。
- Android 11 / API 30 及以上设备。界面适配基准为 `Ledu_Phone`：1200×2670、460 DPI。

### 本地配置（不提交）

在 `Ledu/local.properties` 中配置本机 `sdk.dir`，以及可选的 `amap.api.key`。未提供地图 key 时保留原有 Canvas 自绘轨迹；需要在线地图时使用自己的 AMap Android key，并限制包名与签名证书。

release 签名还需要 `release.store.file`、`release.store.password`、`release.key.alias`、`release.key.password`。keystore 路径以 `Ledu/` 为基准；缺少签名配置或私钥时，release 签名校验失败，不影响 debug 构建。

真实 key、密码与本机配置不写入公开源码或文档。Android 地图 key 仍会进入 APK，不能把源码隔离当作客户端密钥保密措施。

### 构建、安装与启动

以下命令从仓库根目录开始执行。macOS 示例：

```bash
cd Ledu
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
./gradlew :app:assembleDebug

adb devices -l
adb -s emulator-5556 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5556 shell am start -W -n com.chadm.ledu/.MainActivity
```

将 `emulator-5556` 替换为 `adb devices -l` 中的实际设备序列号；安装与启动前确保设备已完成开机。

- 应用包名：`com.chadm.ledu`；debug APK：`Ledu/app/build/outputs/apk/debug/app-debug.apk`。
- debug 构建使用默认 debug 签名，不需要 release keystore；release 构建按上方本地配置提供签名私钥。
- 音乐页需先选择扫描目录；RSS 内容与地图瓦片需要联网。导入的歌单、订阅及运动数据保存在设备上，不随源码分发。
- 当前 AGP 8.7.3 对 `compileSdk 36` 有兼容性提示；本机 debug 构建已通过。

### 手机模拟器与已知网络问题

本机已有 `Ledu_Phone` AVD。Android Emulator 36.5.11 曾出现 `netsimd` 在 `libslirp::tcp_input` 崩溃，随后导致 qemu abort。该环境已验证以下启动规避方案：

```bash
"$ANDROID_HOME/emulator/emulator" -avd Ledu_Phone -port 5556 \
  -gpu swiftshader_indirect -feature -WiFiPacketStream -no-snapshot
```

此命令保留设备数据并冷启动，关闭 netsim 的 Wi-Fi 数据包通道；未关闭整个网络。本机已验证新闻同步、地图加载与轨迹回放。其他版本先检查支持的 feature，不保证所有模拟器问题都由此解决。

高德地图在该模拟器环境下需启用 AVD GPU，并使用 `-gpu swiftshader_indirect`。

## 提交范围

根目录 `.gitignore` 排除私有 `agent.md`、依赖目录、Gradle/Kotlin/Python 缓存、构建与渲染产物、生成旁白、本机配置、日志和签名私钥；两个项目的原有忽略规则仍保留。

源码、项目配置、`package-lock.json`、Gradle wrapper 和必要资源应保留。`.env.example` 可作为配置示例提交，真实 `.env`、`local.properties`、token 和 keystore 不提交。

`.gitignore` 不会自动取消已跟踪文件；不要把本机路径、签名私钥或运行生成的数据加入提交。

