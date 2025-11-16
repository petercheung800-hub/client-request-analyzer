# 快速启动指南

## 5分钟快速开始

### 步骤1：获取DeepSeek API Key（2分钟）

1. 访问 [DeepSeek开放平台](https://platform.deepseek.com/)
2. 注册或登录账号
3. 进入"API密钥管理"页面
4. 创建新的API密钥并复制保存

### 步骤2：安装项目依赖（1分钟）

```bash
cd client-request-analyzer
yarn install
```

### 步骤3：配置环境变量（1分钟）

在项目根目录创建 `.env` 文件：

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

将 `your_deepseek_api_key_here` 替换为您刚才复制的API Key。

### 步骤4：启动应用（1分钟）

```bash
yarn dev:full
```

### 步骤5：打开浏览器

访问 http://localhost:5173 开始使用！

## 验证配置

启动应用后，尝试分析一条客户留言。如果看到分析结果，说明配置成功！

## 常见问题

**Q: 提示"请配置DeepSeek API Key"？**
A: 确保在项目根目录创建了`.env`文件，并且正确填写了`DEEPSEEK_API_KEY`

**Q: 提示"API Key无效"？**
A: 检查API Key是否正确复制，确保没有多余的空格或换行

**Q: 提示"API调用频率过高"？**
A: DeepSeek API有调用频率限制，请稍后再试

**Q: 提示"余额不足"？**
A: 登录DeepSeek平台检查账户余额，需要充值后才能使用

**Q: 响应格式错误？**
A: 这是正常情况，系统会自动处理。如果频繁出现，可以尝试使用`deepseek-chat-32k`模型

