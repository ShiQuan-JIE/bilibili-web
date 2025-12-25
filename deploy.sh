#!/bin/bash

# 部署脚本 - 腾讯云 CloudBase 云托管
# 使用方法: ./deploy.sh

set -e

echo "🚀 开始部署到腾讯云 CloudBase 云托管..."

# 检查是否安装了 CloudBase CLI
if ! command -v cloudbase &> /dev/null; then
    echo "❌ 未检测到 CloudBase CLI，请先安装："
    echo "   npm install -g @cloudbase/cli"
    exit 1
fi

# 检查是否已登录
echo "📝 检查登录状态..."
if ! cloudbase whoami &> /dev/null; then
    echo "❌ 未登录，请先执行: cloudbase login"
    exit 1
fi

# 确认部署
read -p "确认要部署到生产环境吗？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消部署"
    exit 1
fi

# 构建项目
echo "📦 构建项目..."
npm run build

# 部署到云托管
echo "🚢 部署到云托管..."
# 确保在包含 Dockerfile 的目录下执行
echo "当前工作目录: $(pwd)"
# 显示目录内容，确认 Dockerfile 存在
ls -la
# 添加-e参数确保环境ID被正确识别
cloudbase run deploy --serviceName bilibili-web --containerPort 3000 --image latest --path . --envId cloud1-3gy44slx114f4c73

echo "✅ 部署完成！"
echo "📱 请在 CloudBase 控制台查看部署状态"
