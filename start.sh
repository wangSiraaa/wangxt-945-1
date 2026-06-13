#!/bin/bash

set -e

echo "=============================================="
echo "  团餐订餐结算系统 - 启动脚本"
echo "=============================================="

echo ""
echo "[1/4] 检查依赖..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

echo "✓ Node.js 版本: $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✓ npm 版本: $(npm --version)"

echo ""
echo "[2/4] 安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi
echo "✓ 后端依赖已就绪"

echo ""
echo "[3/4] 安装前端依赖..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
echo "✓ 前端依赖已就绪"

echo ""
echo "[4/4] 启动服务..."
cd ..

echo ""
echo "启动后端服务 (端口 3001)..."
cd backend
npm start &
BACKEND_PID=$!
echo "✓ 后端服务 PID: $BACKEND_PID"

sleep 3

echo ""
echo "启动前端服务 (端口 5173)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "✓ 前端服务 PID: $FRONTEND_PID"

echo ""
echo "=============================================="
echo "  服务启动完成！"
echo "=============================================="
echo ""
echo "  前端地址: http://localhost:5173"
echo "  后端地址: http://localhost:3001"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "=============================================="

trap "echo ''; echo '正在停止服务...'; kill $FRONTEND_PID $BACKEND_PID 2>/dev/null; echo '服务已停止'; exit" INT TERM

wait
