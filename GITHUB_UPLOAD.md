# GitHub 上传指南

## 步骤1：在GitHub上创建新仓库

1. 访问 [GitHub](https://github.com)
2. 登录您的账号
3. 点击右上角的 "+" 按钮，选择 "New repository"
4. 填写仓库信息：
   - **Repository name**: `client-request-analyzer` (或您喜欢的名称)
   - **Description**: `客户问询分析系统 - 基于AI的项目需求分析工具`
   - **Visibility**: 选择 Public（公开）或 Private（私有）
   - **不要**勾选 "Initialize this repository with a README"（我们已经有了）
5. 点击 "Create repository"

## 步骤2：配置Git用户信息（如果还没有配置）

```bash
git config --global user.name "您的姓名"
git config --global user.email "您的邮箱"
```

## 步骤3：添加远程仓库并推送代码

在项目目录下执行以下命令（将 `YOUR_USERNAME` 替换为您的GitHub用户名）：

```bash
cd /Users/peter/Desktop/workspace/client-request-analyzer

# 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/client-request-analyzer.git

# 或者使用SSH（如果您配置了SSH密钥）
# git remote add origin git@github.com:YOUR_USERNAME/client-request-analyzer.git

# 将分支重命名为main（GitHub推荐）
git branch -M main

# 推送代码到GitHub
git push -u origin main
```

## 步骤4：验证上传

访问您的GitHub仓库页面，应该能看到所有代码文件已经上传成功。

## 注意事项

⚠️ **重要**：`.env` 文件已被添加到 `.gitignore`，不会被上传到GitHub。这是正确的，因为API密钥不应该公开。

如果您的仓库是公开的，请确保：
- ✅ `.env` 文件不会被提交
- ✅ 数据库文件（`.sqlite`）不会被提交
- ✅ `node_modules` 不会被提交

## 后续更新代码

当您修改代码后，可以使用以下命令更新GitHub：

```bash
# 查看修改的文件
git status

# 添加修改的文件
git add .

# 提交修改
git commit -m "描述您的修改"

# 推送到GitHub
git push
```

## 故障排除

### 如果遇到认证问题

1. **使用Personal Access Token**：
   - 访问 GitHub Settings > Developer settings > Personal access tokens
   - 生成新的token
   - 使用token作为密码进行推送

2. **使用SSH密钥**：
   - 配置SSH密钥后，使用SSH URL而不是HTTPS URL

### 如果遇到分支名称问题

```bash
# 查看当前分支
git branch

# 重命名分支
git branch -M main
```

