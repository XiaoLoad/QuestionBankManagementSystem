# 题库管理系统

一个基于 Web 的可视化题库管理工具，专为 [yatori-go-quesbank](https://github.com/yatori-dev/yatori-go-quesbank) 及[yatori-go-console](https://github.com/yatori-dev/yatori-go-console)自动考试答题系统设计，同时兼容 [OCS 网课助手](https://github.com/ocsjs/ocsjs)。

## 项目背景

本项目起源于 [yatori-go-console](https://github.com/yatori-dev/yatori-go-console) 自动刷网课的需求。yatori-go-console 依赖 [yatori-go-quesbank](https://github.com/yatori-dev/yatori-go-quesbank) 提供题库查询服务，但 quesbank 本身没有可视化管理界面，使用起来很不方便。

为了解决这个问题，我借助 AI 辅助开发了本项目，最初目的是为 quesbank 的 SQLite 题库提供一个可视化的管理界面。随着使用需求的不断扩展，项目逐步集成了更多功能：

- **AI 答案校验**：接入 OpenAI 兼容的 AI 服务，对题目答案进行智能分析与校验
- **题库对接**：直接对接 yatori-go-console 和 OCS 网课助手，提供查询接口
- **多数据库管理**：支持切换、上传、管理多个 SQLite 数据库
- **题库部署**：一键将题库部署到 yatori-go-console 的数据库目录

现在本项目已经可以**替代 quesbank**，作为一个独立的题库服务运行，同时为 yatori-go-console 和 OCS 网课助手提供题库查询服务。

## 功能特性

### 核心功能

- 题目的增删改查，支持 5 种题型（单选题、多选题、判断题、填空题、简答题）
- 按题型、分类、关键词、时间范围筛选题目
- 批量删除、批量修改分类
- 回收站管理，支持软删除与恢复
- 数据库备份与 JSON 导入导出
- 题目去重检测

### AI 功能

- 接入 OpenAI 兼容的 AI 服务（DeepSeek、硅基流动、Kimi、豆包等预设）
- 题目详情页 AI 分析，返回解析和答案
- 导入数据答案冲突时，AI 辅助判断正确答案
- 可配置超时时间和并发数

### 题库对接

- **Yatori 接口**：兼容 yatori-go-console 的 API 配置
- **OCS 接口**：兼容 OCS 网课助手的自定义题库配置
- 本地优先查询 + AI 兜底 + 自动入库，逐步扩充题库

### 数据管理

- 多数据库切换与管理
- 一键部署到 yatori-go-quesbank 数据库目录
- 导入 JSON 时自动去重（含回收站检测）
- 导入冲突处理，支持覆盖或跳过

## 技术栈

| 层级     | 技术                                                       |
| -------- | ---------------------------------------------------------- |
| 后端     | Node.js + Express + better-sqlite3 + multer                |
| 前端     | Vue 3 + Vite + Vue Router 4 + Pinia + TailwindCSS + Chart.js |
| 数据库   | SQLite 3.x（WAL 模式）                                     |
| 设计风格 | Notion Design                                              |

## 快速开始

### 环境要求

- Node.js >= 18
- npm 或 yarn

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/your-username/question-bank-manager.git
cd question-bank-manager

# 安装后端依赖
npm install

# 安装前端依赖并构建
cd frontend
npm install
npm run build
cd ..

# 启动服务
node server.js
# 访问 http://localhost:3000
```

### 开发模式

```bash
# 终端 1：启动后端
node server.js

# 终端 2：启动前端开发服务器（支持热更新）
cd frontend
npm run dev
# 访问 http://localhost:5173
```

### 自定义端口

```bash
PORT=8080 node server.js
```

## 页面说明

| 路径 | 页面 | 功能 |
|------|------|------|
| `/` | 仪表盘 | 统计卡片、新增趋势图、分类分布 |
| `/questions` | 题目管理 | 搜索、筛选、增删改查、批量操作 |
| `/questions/:id` | 题目详情 | 查看完整题目信息、AI 校验答案 |
| `/categories` | 分类管理 | 分类的增删改查、分值设置 |
| `/data` | 数据管理 | 数据库切换/上传/备份、导入导出、题目去重 |
| `/trash` | 回收站 | 查看已删除题目、恢复或永久删除 |
| `/ai-settings` | AI 设置 | 管理 AI 服务商配置、模型选择 |
| `/external` | 题库对接 | 管理 Yatori/OCS 接口配置、查看统计和日志 |
| `/about` | 关于 | 项目介绍、技术栈展示 |

## 与 yatori-go-quesbank 的兼容性

本项目数据库与 [yatori-go-quesbank](https://github.com/yatori-dev/yatori-go-quesbank) 完全兼容：

- 直接读写 yatori-go-quesbank 的 `default.db` 数据库
- yatori 的 `AutoMigrate` 只处理 `data_questions` 表，不会影响本项目新增的表
- MD5 算法已对齐，确保题目去重逻辑一致
- 本项目新增的 `category` 列和索引对 yatori 透明，不影响其正常运行

## 题库对接配置

### Yatori 配置

在 yatori-go-console 的 `config.yml` 中配置：

```yaml
apiQueSetting:
  url: "http://localhost:3000/api/external/yatori"
```

### OCS 配置

在 OCS 网课助手中添加自定义题库配置：

```json
[{
  "name": "题库管理系统",
  "url": "http://localhost:3000/api/external/ocs",
  "method": "get",
  "contentType": "json",
  "data": { "title": "${title}", "type": "${type}", "options": "${options}" },
  "handler": "return (res) => res.code === 1 ? [res.question, res.answer] : undefined"
}]
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |

## License

MIT
