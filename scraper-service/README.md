# 机会信息抓取服务

这个Python服务用于从 https://beacon.shinetechchina.com.cn/Opportunity# 自动抓取未分配的机会信息。

## 功能特点

- 自动登录系统
- 抓取最近更新的机会信息
- 过滤掉已分配给其他人的机会（Account Owner不为空）
- 定时执行抓取任务
- 将抓取到的机会保存到SQLite数据库
- 支持测试和调试模式

## 安装和配置

### 1. 安装依赖

```bash
cd scraper-service
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置以下变量：

```env
# 抓取服务配置
SCRAPING_ENABLED=true
SCRAPING_INTERVAL_HOURS=1

# 网站登录凭据
SCRAPER_USERNAME=your_actual_username
SCRAPER_PASSWORD=your_actual_password

# 数据库路径
DATABASE_PATH=../server/database.sqlite
```

### 3. 运行服务

#### 定时运行模式（默认）
```bash
python run.py --mode schedule
```

#### 运行一次
```bash
python run.py --mode once
```

#### 测试模式
```bash
python run.py --mode test
```

## 日志

服务运行时会产生日志文件 `scraper.log`，包含以下信息：
- 抓取任务执行情况
- 抓取到的机会数量
- 跳过的已分配机会数量
- 错误信息

## 数据库结构

抓取到的机会信息保存在SQLite数据库的 `opportunities` 表中，包含以下字段：

- `id`: 主键
- `opportunityId`: 网站上的机会ID
- `title`: 机会标题
- `clientName`: 客户名称
- `country`: 国家
- `description`: 描述
- `status`: 状态
- `priority`: 优先级
- `postedDate`: 发布日期
- `lastUpdated`: 最后更新时间
- `sourceUrl`: 源URL
- `isProcessed`: 是否已处理（0=未处理，1=已处理）
- `analysisId`: 关联的分析记录ID
- `createdAt`: 记录创建时间
- `processedAt`: 处理时间

## 注意事项

1. 确保Chrome浏览器已安装
2. 首次运行时会自动下载ChromeDriver
3. 登录凭据需要正确设置，否则无法抓取数据
4. 如果网站结构发生变化，可能需要调整抓取器代码中的选择器

## 故障排除

1. **登录失败**
   - 检查用户名和密码是否正确
   - 确认网站登录页面结构是否发生变化

2. **抓取不到数据**
   - 运行测试模式检查抓取逻辑
   - 查看日志文件中的错误信息
   - 可能需要调整页面元素选择器

3. **ChromeDriver错误**
   - 确保Chrome浏览器已安装
   - 删除 `~/.wdm` 目录重新下载ChromeDriver

## 集成到主应用

抓取服务与主应用通过共享的SQLite数据库进行集成。主应用可以通过以下API访问抓取到的机会：

- `GET /api/opportunities` - 获取机会列表
- `GET /api/opportunities/unprocessed` - 获取未处理的机会
- `POST /api/opportunities/:id/process` - 处理机会