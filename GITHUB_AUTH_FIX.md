# GitHub 认证问题解决方案

## 问题
GitHub 不再支持密码认证，需要使用 Personal Access Token (PAT) 或 SSH 密钥。

## 解决方案1：使用 Personal Access Token（推荐）

### 步骤1：创建 Personal Access Token

1. 访问 GitHub：https://github.com/settings/tokens
2. 点击 "Generate new token" > "Generate new token (classic)"
3. 填写信息：
   - **Note**: `client-request-analyzer` (描述用途)
   - **Expiration**: 选择过期时间（建议90天或更长）
   - **Select scopes**: 勾选 `repo` (完整仓库访问权限)
4. 点击 "Generate token"
5. **重要**：复制生成的token（只显示一次，请立即保存）

### 步骤2：使用Token推送代码

执行以下命令，当提示输入密码时，**粘贴您的token**（不是GitHub密码）：

```bash
cd /Users/peter/Desktop/workspace/client-request-analyzer
git push -u origin main
```

当提示输入用户名时，输入：`petercheung800-hub`
当提示输入密码时，**粘贴您的Personal Access Token**

### 步骤3：保存凭据（可选，避免每次输入）

macOS用户可以使用Keychain保存凭据：

```bash
# 清除旧的凭据
git credential-osxkeychain erase
host=github.com
protocol=https
[按回车两次]

# 下次推送时会提示输入token，输入后会自动保存
```

## 解决方案2：使用SSH密钥（更安全，推荐长期使用）

### 步骤1：检查是否已有SSH密钥

```bash
ls -al ~/.ssh
```

如果看到 `id_rsa` 或 `id_ed25519` 文件，说明已有密钥。

### 步骤2：生成SSH密钥（如果没有）

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

按提示操作（可以直接按回车使用默认设置）。

### 步骤3：添加SSH密钥到GitHub

1. 复制公钥内容：
```bash
cat ~/.ssh/id_ed25519.pub
# 或
cat ~/.ssh/id_rsa.pub
```

2. 访问 GitHub：https://github.com/settings/keys
3. 点击 "New SSH key"
4. 填写：
   - **Title**: `MacBook` (或您的设备名称)
   - **Key**: 粘贴刚才复制的公钥内容
5. 点击 "Add SSH key"

### 步骤4：更改远程仓库URL为SSH

```bash
cd /Users/peter/Desktop/workspace/client-request-analyzer
git remote set-url origin git@github.com:petercheung800-hub/client-request-analyzer.git
git push -u origin main
```

## 解决方案3：使用GitHub CLI（最简单）

### 安装GitHub CLI

```bash
brew install gh
```

### 登录GitHub

```bash
gh auth login
```

按照提示操作，选择：
- GitHub.com
- HTTPS
- 登录方式（浏览器或token）

### 推送代码

```bash
cd /Users/peter/Desktop/workspace/client-request-analyzer
git push -u origin main
```

## 推荐方案

- **快速解决**：使用方案1（Personal Access Token）
- **长期使用**：使用方案2（SSH密钥）
- **最简单**：使用方案3（GitHub CLI）

