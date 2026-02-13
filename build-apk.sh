#!/bin/bash
# Android APK 构建脚本

echo "🔨 开始构建 Android APK..."

# 确保环境变量已设置
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# 构建 Web 应用
echo "📦 构建 React 应用..."
npm run build

# 同步到 Android 项目
echo "🔄 同步到 Android 项目..."
npx cap sync android

# 构建 APK
echo "🤖 构建 APK..."
cd android
./gradlew assembleDebug
cd ..

# 显示结果
if [ -f "android/app/build/outputs/apk/debug/app-debug.apk" ]; then
    echo ""
    echo "✅ 构建成功！"
    echo "📦 APK 文件位置："
    ls -lh android/app/build/outputs/apk/debug/app-debug.apk
    echo ""
    echo "📲 安装到手机："
    echo "  方法1: adb install android/app/build/outputs/apk/debug/app-debug.apk"
    echo "  方法2: 将 APK 文件发送到手机，点击安装"
else
    echo "❌ 构建失败"
    exit 1
fi
