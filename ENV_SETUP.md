# 环境变量配置说明

## 必需配置

**必须配置DeepSeek API Key才能使用！**

在项目根目录创建 `.env` 文件：

```
# DeepSeek API Key（必需）
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

## 完整配置示例

```
# DeepSeek API Key（必需）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# DeepSeek API地址（可选，默认：https://api.deepseek.com/v1/chat/completions）
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# 使用的模型（可选，默认：deepseek-chat）
# 可选：deepseek-chat, deepseek-chat-32k
DEEPSEEK_MODEL=deepseek-chat

# 后端服务端口（可选，默认：3001）
PORT=3001
```

## 获取DeepSeek API Key

1. 访问 [DeepSeek开放平台](https://platform.deepseek.com/)
2. 注册或登录账号
3. 进入"API密钥管理"页面
4. 点击"创建新的API密钥"
5. 复制生成的API Key（只显示一次，请妥善保存）
6. 将API Key粘贴到`.env`文件的`DEEPSEEK_API_KEY`字段

## 模型说明

- **deepseek-chat** - 默认模型，适合大多数场景
- **deepseek-chat-32k** - 支持更长的上下文（32K tokens），适合分析长文本

## 注意事项

- `.env` 文件已添加到 `.gitignore`，不会被提交到版本控制
- **请妥善保管您的API Key**，不要泄露给他人
- DeepSeek API按使用量计费，请查看[定价页面](https://platform.deepseek.com/pricing)了解详情
- 建议设置API使用限额以避免意外费用

