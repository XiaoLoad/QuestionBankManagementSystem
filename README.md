<div align="center">

<img src="docs/images/logo.svg" alt="题库管理系统" width="96" />

# 题库管理系统

**给 yatori-go-console 和 OCS 网课助手，一个可视化的题库。**

一个基于 Web 的题库管理工具：直接读写 [yatori-go-quesbank](https://github.com/yatori-dev/yatori-go-quesbank) 的 SQLite 题库，提供题目管理、AI 答案校验、刷题练习，并以标准接口向 [yatori-go-console](https://github.com/yatori-dev/yatori-go-console) 和 [OCS 网课助手](https://github.com/ocsjs/ocsjs) 提供题库查询服务——可直接替代 quesbank 独立运行。

![Version](https://img.shields.io/github/v/tag/XiaoLoad/QuestionBankManagementSystem?sort=semver&label=version) ![License](https://img.shields.io/github/license/XiaoLoad/QuestionBankManagementSystem) ![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white) ![SQLite](https://img.shields.io/badge/SQLite-3.x_WAL-003B57?logo=sqlite&logoColor=white) ![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-latest-646CFF?logo=vite&logoColor=white) ![Pinia](https://img.shields.io/badge/Pinia-latest-FFD859?logo=pinia&logoColor=black) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

[快速开始](#快速开始) · [核心特性](#核心特性) · [题库对接](#题库对接) · [常见问题](#常见问题)

</div>

---

## 核心特性

* **可视化管理** —— 5 种题型（单选 / 多选 / 判断 / 填空 / 简答）的增删改查、筛选、批量操作、回收站、去重检测，题目支持多图展示。
* **AI 答案校验** —— 接入 OpenAI 兼容服务（DeepSeek、硅基流动、Kimi、豆包等预设），导入冲突时 AI 辅助判断正确答案。图片内容识别暂不支持，计划后续开发。
* **刷题练习** —— 选项乱序、自动判题、错题重练、复习模式、进度持久化，移动端适配。
* **多用户与权限** —— JWT 认证，管理员 / 普通用户角色，分类可见性控制，活动日志审计。
* **题库对接** —— 兼容 Yatori 与 OCS 查询接口，本地优先查询 + AI 兜底 + 自动入库，越用题库越全。
* **多数据库管理** —— 多个 SQLite 库的切换、上传、备份，一键部署到 yatori-go-quesbank 的数据库目录。
* **Docker 部署** —— 一条命令容器化上线。

## 快速开始

### 环境要求

* Node.js >= 18
* yarn（推荐）或 npm

### 安装与运行

```bash
git clone https://github.com/your-username/question-bank-manager.git
cd question-bank-manager

# 安装后端依赖
yarn install

# 安装前端依赖并构建
cd frontend
yarn install
yarn build
cd ..

# 启动服务
yarn start
# 访问 http://localhost:3000
```

也可以一步到位：

```bash
yarn build    # 构建前端 + 启动服务
```

> 默认管理员账号：`admin / admin123`，首次登录后请及时修改密码。

### Docker 部署

```bash
docker compose up -d --build    # 一键启动
docker compose logs -f          # 查看日志
docker compose down             # 停止服务
```

启动后访问 `http://localhost:3000`，详细部署文档见 [DEPLOY.md](docs/DEPLOY.md)。

### 开发模式

```bash
# 一键并行启动前后端（推荐）
yarn dev
# 后端 http://localhost:3000，前端 http://localhost:5173（热更新，日志带【后端】【前端】前缀，Ctrl+C 同时退出）
```

也可以分终端启动：

```bash
# 终端 1：启动后端
yarn start

# 终端 2：前端热更新
cd frontend
yarn dev
# 访问 http://localhost:5173
```

## 目录结构

```text
question-bank-manager/
├── package.json             # 依赖与脚本（yarn dev 开发 / yarn start 生产启动）
├── cliff.toml               # git-cliff 更新日志生成配置
├── CHANGELOG.md             # 版本更新日志（发版时自动生成）
├── Dockerfile / docker-compose.yml   # Docker 部署
├── docs/                    # 文档
│   ├── DEPLOY.md            #   Linux / Docker 部署指南
│   ├── ARCHITECTURE.md      #   架构与数据库结构说明
│   ├── IMPORT-FORMAT.md     #   题库导入格式规范
│   └── images/              #   README 图片资源
├── scripts/                 # 辅助脚本
│   ├── release.js           #   发版（CHANGELOG + 版本号 + tag）
│   ├── migrate-data-dir.js  #   v1 → v2 运行时数据迁移（一次性）
│   └── migrate-blob.js      #   历史数据格式迁移
├── backend/                 # 后端源码
│   ├── server.js            #   Express 入口
│   ├── utils.js             #   通用工具（图片提取、多模态消息构造等）
│   ├── validate.js          #   导入数据校验
│   ├── db-init.js           #   数据库表结构初始化
│   ├── middleware/          #   JWT 认证中间件
│   └── routes/              #   API 路由（15 个模块：题目、分类、AI、对接、刷题等）
├── data/                    # 运行时数据（自动生成，不入库 Git）
│   ├── default.db           #   默认 SQLite 数据库
│   ├── db-config.json       #   多数据库切换配置
│   ├── databases/           #   上传的数据库文件
│   └── tmp-uploads/         #   上传临时文件
└── frontend/                # Vue 3 前端
    └── src/
        ├── views/           #   页面（仪表盘、题目、刷题、数据管理等）
        ├── components/      #   公共组件
        ├── composables/     #   组合式函数
        ├── router/          #   路由
        ├── stores/          #   Pinia 状态管理
        ├── themes/          #   多主题配置
        ├── utils/           #   工具函数
        └── assets/          #   静态资源
```

运行时数据统一存放在 `data/` 目录，可通过 `DATA_DIR` 环境变量自定义位置（Docker 中默认为 `/app/data`），备份时复制该目录即可。

## 功能页面

| 路径 | 页面 | 功能 |
|------|------|------|
| `/` | 仪表盘 | 统计卡片、新增趋势图、分类分布 |
| `/login` | 登录 | 用户登录页面 |
| `/questions` | 题目管理 | 搜索、筛选、增删改查、批量操作 |
| `/questions/:id` | 题目详情 | 完整题目信息、图片展示、AI 校验答案 |
| `/categories` | 分类管理 | 分类的增删改查、分值和备注设置、移动题目 |
| `/quiz` | 刷题 | 选项乱序、自动判题、错题重练 |
| `/data` | 数据管理 | 数据库切换 / 上传 / 备份、导入导出、分类映射、题目去重 |
| `/trash` | 回收站 | 已删除题目、恢复或永久删除 |
| `/ai-settings` | AI 设置 | AI 服务商配置、模型选择 |
| `/external` | 题库对接 | Yatori / OCS 接口配置、统计和日志 |
| `/site-settings` | 网站设置 | 公告管理、系统配置（管理员） |
| `/users` | 用户管理 | 用户列表、创建、删除、权限控制（管理员） |
| `/activity-logs` | 活动日志 | 用户操作记录查看（管理员） |
| `/about` | 关于 | 项目介绍、技术栈展示、更新日志 |

## 题库对接

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

对接后的查询流程：本地题库优先，未命中时由 AI 兜底作答并自动入库，逐步扩充题库。

## 与 yatori-go-quesbank 的兼容性

* 直接读写 yatori-go-quesbank 的 `default.db` 数据库
* yatori 的 `AutoMigrate` 只处理 `data_questions` 表，不会影响本项目新增的表
* MD5 算法已对齐，题目去重逻辑一致
* 本项目新增的 `category`、`images` 列和索引对 yatori 透明，不影响其正常运行

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + better-sqlite3 + multer + JWT + bcryptjs |
| 前端 | Vue 3 + Vite + Vue Router 4 + Pinia + TailwindCSS + Chart.js |
| 数据库 | SQLite 3.x（WAL 模式） |
| 设计风格 | Notion Design |
| 部署 | Docker + Docker Compose（可选） |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |
| `JWT_SECRET` | `change-me-in-production` | JWT 签名密钥，**生产环境务必修改** |
| `DATA_DIR` | 项目根目录 | 数据存储目录（Docker 环境默认 `/app/data`） |

## 常见问题

**默认账号是什么？**`admin / admin123`。生产环境请修改密码，并通过 `JWT_SECRET` 环境变量更换签名密钥。

**普通用户能做什么？**可查看仪表盘、题目和分类；管理员可管理包括用户、数据库、网站设置在内的全部功能，并通过分类可见性控制普通用户可访问的题库范围。

**启动时报 better-sqlite3 找不到 bindings 文件？**Node 版本太新而依赖里的 better-sqlite3 过旧（如 Node 24 搭配 v11）会导致预编译二进制缺失。确保使用 v12 及以上版本（`package.json` 已内置），重新 `yarn install` 即可。

**端口被占用？**自定义端口启动：`PORT=8080 node backend/server.js`。

**导入 JSON 会重复吗？**不会，导入时自动去重（含回收站检测），冲突可选择性覆盖或跳过，也可映射到已有本地分类。

## 参与开发

```bash
yarn install                      # 安装后端依赖
cd frontend && yarn install       # 安装前端依赖
yarn build                        # 构建前端
yarn start                        # 启动服务

yarn release:patch|minor|major    # 发版（自动更新 CHANGELOG 并打 tag）
```

提交信息遵循约定式提交（`feat` / `fix` / `ui` / `docs` / `refactor` / `chore`），CHANGELOG 由 [git-cliff](https://github.com/orhun/git-cliff) 自动生成。

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)（基于提交记录自动生成，由 `yarn release` 驱动）。

## License

MIT
