# 📱 打包手机 App 指南

本项目已配置 Capacitor，可以将 Web 应用打包成原生 Android/iOS 应用。

## 🚀 快速开始

### 前提条件

#### Android 开发环境
1. **安装 Java JDK 17 或更高版本**
   ```bash
   # 检查是否已安装
   java -version
   ```

2. **安装 Android Studio**
   - 下载地址：https://developer.android.com/studio
   - 安装后，打开 Android Studio > Settings > Android SDK
   - 确保安装了最新的 SDK Platform 和 SDK Build-Tools

3. **配置环境变量**（Linux/Mac）
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   ```

## 📦 构建步骤

### 方法一：使用 Android Studio（推荐）

1. **同步项目代码**
   ```bash
   npm run cap:sync
   ```

2. **打开 Android Studio**
   ```bash
   npm run cap:open:android
   ```
   或手动打开 `/android` 文件夹

3. **生成 APK**
   - 在 Android Studio 中：`Build > Build Bundle(s) / APK(s) > Build APK(s)`
   - 等待构建完成
   - APK 位置：`android/app/build/outputs/apk/debug/app-debug.apk`

4. **传输到手机**
   - 将 APK 文件通过 USB/微信/邮件发送到手机
   - 在手机上点击安装（需要开启"允许安装未知来源应用"）

### 方法二：命令行构建（快速）

1. **构建 Debug APK**
   ```bash
   npm run build
   npx cap sync
   cd android
   ./gradlew assembleDebug
   cd ..
   ```

2. **APK 输出位置**
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

3. **构建 Release APK（正式版）**
   ```bash
   cd android
   ./gradlew assembleRelease
   cd ..
   ```
   输出位置：`android/app/build/outputs/apk/release/app-release-unsigned.apk`

## 📲 安装到手机

### Android 手机

1. **开启开发者选项**
   - 设置 > 关于手机 > 连续点击"版本号" 7次
   - 返回设置 > 系统 > 开发者选项 > 开启"USB调试"

2. **通过 USB 直接安装**
   ```bash
   # 连接手机到电脑
   adb devices  # 确认设备已连接
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

3. **传输 APK 文件安装**
   - 将 APK 文件发送到手机（微信/QQ/邮件）
   - 打开 APK 文件，点击安装
   - 首次安装需要在设置中允许"安装未知应用"

### iOS 手机（需要 Mac 电脑）

1. **添加 iOS 平台**
   ```bash
   npm run cap:add:ios
   ```

2. **打开 Xcode**
   ```bash
   npm run cap:open:ios
   ```

3. **配置签名**
   - 在 Xcode 中选择 Team（需要 Apple 开发者账号）
   - 连接 iPhone，选择设备
   - 点击运行按钮直接安装到手机

4. **通过 TestFlight 分发**
   - Archive 项目
   - 上传到 App Store Connect
   - 添加测试人员

## ⚙️ 自定义配置

### 修改应用信息

编辑 `capacitor.config.ts`：
```typescript
const config: CapacitorConfig = {
  appId: 'com.yourcompany.yourapp',  // 修改应用 ID
  appName: '你的应用名称',            // 修改应用名称
  webDir: 'dist',
  // ...
};
```

### 修改 Android 图标和名称

1. **应用名称**：编辑 `android/app/src/main/res/values/strings.xml`
   ```xml
   <string name="app_name">你的应用</string>
   ```

2. **应用图标**：替换以下文件
   ```
   android/app/src/main/res/mipmap-*/ic_launcher.png
   ```

3. **启动画面**：编辑 `android/app/src/main/res/drawable/splash.png`

## 🔄 更新应用

每次修改代码后：

```bash
# 1. 重新构建
npm run build

# 2. 同步到原生项目
npx cap sync

# 3. 重新生成 APK
cd android && ./gradlew assembleDebug && cd ..
```

或使用快捷命令：
```bash
npm run build:app
cd android && ./gradlew assembleDebug && cd ..
```

## 🐛 常见问题

### 构建失败
- 确保已安装 Java JDK 17+
- 清理构建：`cd android && ./gradlew clean && cd ..`
- 删除 `android` 文件夹，重新运行 `npm run cap:add:android`

### APK 无法安装
- 检查手机是否开启"允许安装未知来源"
- 卸载旧版本后重新安装
- 确保 APK 文件完整下载

### 应用闪退
- 检查 Logcat 日志：`adb logcat`
- 确保 Supabase URL 配置正确
- 检查网络权限配置

## 📦 Package.json 可用命令

```bash
npm run cap:sync          # 构建并同步到原生项目
npm run cap:open:android  # 打开 Android Studio
npm run cap:open:ios      # 打开 Xcode
npm run build:app         # 构建并同步
```

## 🎉 完成！

现在你可以将生成的 APK 文件分发给朋友，直接安装到 Android 手机上使用了！
