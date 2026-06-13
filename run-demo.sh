#!/bin/bash

echo "=============================================="
echo "  团餐订餐结算系统 - 业务场景演示"
echo "=============================================="

cd "$(dirname "$0")/backend"

if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi

echo ""
node demo.js
