# 客户留言分析系统

一个用于分析客户留言的Web应用，可以帮助您快速分析客户需求，包括项目需求、可行性分析、技术栈建议、开发周期、风险分析和报价分析。

## 功能特性

- 📝 客户留言输入和管理
- 🤖 AI智能分析（基于DeepSeek API）
- 📊 详细的分析报告，包括：
  - 项目需求分析
  - 可行性分析
  - 技术栈建议
  - 开发周期和步骤
  - 风险分析
  - 报价分析
- 💾 历史记录保存和查看
- 🎨 现代化UI界面

## 安装和运行

### 1. 获取DeepSeek API Key

1. 访问 [DeepSeek开放平台](https://platform.deepseek.com/)
2. 注册或登录账号
3. 进入"API密钥管理"页面
4. 创建新的API密钥并保存

### 2. 安装项目依赖

```bash
yarn install
```

### 3. 配置环境变量

创建 `.env` 文件：

```bash
# DeepSeek API Key（必需）
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# DeepSeek API地址（可选，默认：https://api.deepseek.com/v1/chat/completions）
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# 使用的模型（可选，默认：deepseek-chat）
DEEPSEEK_MODEL=deepseek-chat

# 后端服务端口（可选，默认：3001）
PORT=3001
```

### 4. 启动开发服务器

```bash
yarn dev:full
```

这将同时启动前端（Vite）和后端（Express）服务器。

## 使用说明

1. 在输入框中输入客户的留言内容
2. 点击"分析"按钮
3. 系统将自动生成详细的分析报告
4. 可以保存分析结果到历史记录
5. 随时查看历史分析记录

## 技术栈

- 前端：React + Vite
- 后端：Express + Node.js
- AI：DeepSeek API
- 数据库：SQLite

## DeepSeek模型说明

- **deepseek-chat** - 默认模型，支持长文本和代码生成
- **deepseek-chat-32k** - 支持更长的上下文（32K tokens）

## 故障排除

1. **API Key错误**
   - 确保在`.env`文件中正确配置了`DEEPSEEK_API_KEY`
   - 检查API Key是否有效且未过期

2. **API调用失败**
   - 检查网络连接
   - 确认API余额充足
   - 查看DeepSeek平台的使用限制

3. **响应格式错误**
   - 如果遇到JSON解析错误，可能是模型返回格式异常
   - 可以尝试调整prompt或使用不同的模型

