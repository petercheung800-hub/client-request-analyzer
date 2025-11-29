#!/bin/zsh
source ~/.nvm/nvm.sh

echo "正在启动后端服务..."
node server/index.js &
BACKEND_PID=$!

echo "正在启动前端服务..."
npx vite &
FRONTEND_PID=$!

echo ""
echo "✅ 服务启动成功！"
echo "后端: http://localhost:3001 (PID: $BACKEND_PID)"
echo "前端: http://localhost:5173 (PID: $FRONTEND_PID)"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待任一进程结束
wait
