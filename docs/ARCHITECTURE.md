# 题库管理系统 (Question Bank Manager)

基于 SQLite 数据库的可视化题库增删改查管理工具，专为 [yatori-go-quesbank](https://github.com/yatori-dev/yatori-go-quesbank) 自动考试答题系统设计。

## 项目用途

本项目是一个**题库缓存数据库的前端管理界面**，用于：

- 管理自动考试脚本所使用的本地题库（SQLite 格式）
- 对题目进行可视化增删改查操作
- 按科目分类管理不同课程的题库
- 支持批量导入、筛选、删除题目
- 数据库备份与 JSON 导入导出
- 回收站管理，支持软删除与恢复
- **多数据库管理**：支持切换、上传、管理多个 SQLite 数据库
- **AI 答案校验**：接入 OpenAI 兼容的 AI 服务，对题目答案进行智能分析与校验
- **题库对接**：提供 Yatori 和 OCS 兼容的外部查询接口，支持自动查题 + AI 兜底 + 自动入库

数据库文件 `default.db` 同时被 yatori-go-quesbank 直接读取，本管理工具对其结构完全兼容。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + better-sqlite3 + multer |
| 前端 | Vue 3 + Vite + Vue Router 4 + Pinia + TailwindCSS + Chart.js |
| 数据库 | SQLite 3.x（WAL 模式） |
| 设计系统 | Notion Design 风格 |

## 页面结构

| 路径 | 页面 | 功能 |
|------|------|------|
| `/` | 仪表盘 | 统计卡片 + 30 天新增趋势图 + 分类分布 + 回收站统计 + 快捷入口 |
| `/questions` | 题目管理 | 搜索（关键词高亮）/可搜索分类筛选/分页/增删改查/批量操作 |
| `/questions/:id` | 题目详情 | 查看完整题目信息（选项、答案、元数据）+ AI 校验答案 |
| `/categories` | 分类管理 | 分类的增删改查，内联编辑，搜索分页，点击跳转题目列表 |
| `/data` | 数据管理 | 数据库切换/上传/备份 + 部署到刷课软件 + JSON 导入导出 + 题目去重 + 批量删除 |
| `/trash` | 回收站 | 查看已删除题目 / 恢复 / 永久删除 / 清空回收站 |
| `/ai-settings` | AI 设置 | 管理 AI 服务商配置、模型选择、连通性测试、超时设置 |
| `/external` | 题库对接 | 管理 Yatori/OCS 外部查询接口配置、查看统计数据和查询日志 |
| `/about` | 关于 | 项目介绍、作者信息、技术栈展示 |
| `/:pathMatch(.*)*` | 404 | 页面未找到，引导返回首页 |

## 设计系统

前端采用 **Notion** 设计风格，支持浅色 / 深色模式切换，偏好自动保存至 `localStorage`。

| 元素 | 浅色模式 | 深色模式 |
|------|---------|---------|
| 画布背景 | `#ffffff` | `#191919` |
| 表面 | `#f7f6f3` | `#202020` |
| 主文字 | `#37352f` | `#e8e6e3` |
| 次文字 | `#9b9a97` | `#6b6b6b` |
| 边框 | `#e5e3df` | `#333333` |
| 强调色 | `#5645d4` | `#7c6ef0` |

## 数据库结构

### data_questions（题目表）

```sql
CREATE TABLE data_questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  DATETIME,
    updated_at  DATETIME,
    deleted_at  DATETIME,              -- 软删除时间戳，NULL 表示未删除
    md5         TEXT,
    type        TEXT NOT NULL,          -- 题型：单选题/多选题/判断题/填空题/简答题
    content     TEXT NOT NULL,          -- 题目内容
    options     BLOB,                   -- 选项，JSON 数组
    answers     TEXT,                   -- 答案，JSON 数组
    right_status INTEGER DEFAULT 0,     -- 正确状态：0待定 1错误 2正确
    category    TEXT DEFAULT '默认'     -- 科目分类
);
```

### data_categories（分类表）

```sql
CREATE TABLE data_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,   -- 分类名称
    score       INTEGER,                -- 分类分值（可选）
    created_at  DATETIME
);
```

### ai_providers（AI 服务商配置表）

```sql
CREATE TABLE ai_providers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,          -- 服务商名称
    base_url    TEXT NOT NULL,          -- API 地址（OpenAI 兼容格式）
    api_key     TEXT NOT NULL,          -- API Key
    model       TEXT DEFAULT '',        -- 模型名称
    is_default  INTEGER DEFAULT 0,     -- 是否默认服务商
    created_at  DATETIME,
    updated_at  DATETIME
);
```

### external_config（外部接口配置表）

```sql
CREATE TABLE external_config (
    key         TEXT PRIMARY KEY,       -- 配置键
    value       TEXT,                   -- 配置值（JSON 格式）
    updated_at  DATETIME
);
```

### external_logs（外部查询日志表）

```sql
CREATE TABLE external_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,          -- 查询来源：yatori / ocs
    content     TEXT NOT NULL,          -- 查询的题目内容
    type        TEXT,                   -- 题型
    result      TEXT NOT NULL,          -- 查询结果：local / ai / not_found
    answer      TEXT,                   -- 返回的答案
    cost_ms     INTEGER,               -- 耗时（毫秒）
    created_at  DATETIME
);
```

### 性能索引

```sql
CREATE INDEX idx_questions_type ON data_questions(type);
CREATE INDEX idx_questions_category ON data_questions(category);
CREATE INDEX idx_questions_created_at ON data_questions(created_at);
CREATE INDEX idx_questions_deleted_at ON data_questions(deleted_at);
```

### 数据格式

```json
{
  "type": "单选题",
  "content": "（）是艺术起源的理论之一",
  "options": ["情感说", "表现说", "游戏说", "模仿说"],
  "answers": ["表现说"],
  "category": "艺术概论"
}
```

| 题型 | options 格式 | answers 格式 |
|------|-------------|-------------|
| 单选题 | `["选项A", "选项B", "选项C", "选项D"]` | `["正确答案"]` |
| 多选题 | `["A.选项1", "B.选项2", ...]` | `["答案1", "答案2", ...]` |
| 判断题 | `["正确", "错误"]` | `["正确"]` 或 `["错误"]` |
| 填空题 | `null` | `["空1答案", "空2答案", ...]` |
| 简答题 | `null` | `["答案文本"]` |

## yatori-go-quesbank 兼容性

[yatori-go-quesbank](https://github.com/yatori-dev/yatori-go-quesbank) 使用 GORM 的 `AutoMigrate` 初始化数据库。经源码验证，本项目与其**完全兼容**：

- **`AutoMigrate` 只处理 `data_questions` 表**：yatori 的 struct 仅定义了 `DataQuestion`，不会触碰 `data_categories` 或 `ai_providers` 等其他表
- **`category` 列无影响**：yatori 的 `Question` struct 无 `category` 字段，查询时自动忽略
- **SQL 查询仅涉及 `type`、`content`、`md5`**：yatori 的所有查询逻辑不涉及 `category`
- **MD5 算法已对齐**：本项目使用 `type + content` 生成 MD5，与 yatori 的 `fmt.Sprintf("%s-%s", type, content)` 一致
- **性能索引无影响**：索引对应用层完全透明，不改变数据或查询逻辑

## 功能清单

### 题目管理

| 功能 | 说明 |
|------|------|
| 题目列表 | 响应式表格，支持分页（10/20/50/100 条可选） |
| 搜索 | 按题目内容模糊搜索，300ms 防抖，**搜索关键词高亮显示** |
| 题型筛选 | 单选题/多选题/判断题/填空题/简答题 |
| 分类筛选 | **可搜索下拉框**，输入关键词实时过滤分类 |
| 时间筛选 | 按创建时间范围筛选 |
| 排序 | 创建时间升序/降序切换 |
| 添加题目 | 支持 5 种题型，选项/答案动态编辑 |
| 编辑题目 | 修改内容、选项、答案、分类 |
| 查看详情 | 独立详情页展示完整题目信息 |
| 删除 | **软删除，移至回收站**，可在回收站恢复 |
| 重复检测 | 添加/编辑时自动检测重复题目（**含回收站**），可强制继续 |
| 批量删除 | 复选框勾选后一键移至回收站 |
| 批量修改分类 | 勾选后统一修改分类（可搜索下拉框选择分类） |

### 回收站

| 功能 | 说明 |
|------|------|
| 回收站列表 | 查看所有已删除题目，支持搜索/筛选/分页 |
| 删除时间 | 显示删除时间及「已删除 X 天」友好提示 |
| 单条恢复 | 恢复单条题目（重复时提示是否强制恢复） |
| 批量恢复 | 勾选后一键恢复（自动跳过重复项） |
| 单条永久删除 | 从回收站永久删除单条题目 |
| 批量永久删除 | 勾选后一键永久删除 |
| 清空回收站 | 一键永久清空所有回收站数据 |
| 侧边栏角标 | 侧边栏回收站项显示红色数量角标 |

### 分类管理

| 功能 | 说明 |
|------|------|
| 分类列表 | 独立页面管理所有分类，**支持搜索和分页** |
| 添加分类 | 输入名称直接添加，可设置分类分值 |
| 编辑分类 | 内联编辑名称和分值，同步更新关联题目 |
| 删除分类 | 删除后题目自动归入「默认」分类 |
| 跳转筛选 | **点击分类卡片跳转到题目管理页，自动按该分类筛选** |
| 分类分值 | 每个分类可设置分值（score），用于导入时自动匹配 |

### 数据管理

| 功能 | 说明 |
|------|------|
| **数据库切换** | **选择本地 `.db` 文件上传并切换，支持管理多个数据库** |
| **上传冲突处理** | **上传与当前数据库同名的文件时，可选择覆盖或自动重命名（加时间戳后缀）** |
| **数据库列表** | **显示最近使用的数据库，支持快速切换和从列表移除** |
| **切回默认** | **一键切回项目目录下的默认数据库 `default.db`** |
| **部署到刷课软件** | **设置刷课软件数据库目录，选择数据库一键复制部署（支持自定义文件名）** |
| 数据库备份 | 下载当前数据库文件 |
| 导出 JSON | 按题型/分类下拉筛选后导出为 JSON 文件 |
| 导入 JSON | 从 JSON 文件（支持拖拽上传）或粘贴数据批量导入，自动去重（含回收站） |
| 导入冲突处理 | 答案冲突时逐条展示，支持全选覆盖/跳过/选择性覆盖 |
| 导入冲突 AI 辅助 | 对冲突题目调用 AI 分析，判断 AI 答案与现有/导入答案的一致性 |
| 题目去重 | 扫描重复题目（题型+内容相同），选择保留哪条，其余移至回收站 |
| 按时间批量移至回收站 | 按日期范围软删除，可选题型和分类 |

### AI 答案校验

| 功能 | 说明 |
|------|------|
| AI 服务商管理 | 添加/编辑/删除 AI 服务商，支持预设（DeepSeek、硅基流动、Kimi、豆包） |
| 默认服务商 | 设定默认 AI 服务商，题目详情页直接调用 |
| 连通性测试 | 测试 AI 服务商 API 是否可达 |
| 模型列表获取 | 从服务商 API 自动获取可用模型列表，点击选择 |
| 题目 AI 分析 | 在题目详情页调用 AI 分析题目，返回解析和答案 |
| 答案比对 | AI 答案与当前题库答案自动比对，标记一致/不同 |
| 冲突 AI 辅助 | 导入数据答案冲突时，可批量/单独调用 AI 判断正确答案 |
| 超时设置 | 可配置 AI 请求超时时间（10-600 秒），保存至 localStorage |

### 题库对接

| 功能 | 说明 |
|------|------|
| Yatori 接口 | 提供 POST `/api/external/yatori` 接口，兼容 yatori-go-quesbank 的 API 配置 |
| OCS 接口 | 提供 GET/POST `/api/external/ocs` 接口，兼容 OCS（在线考试辅助工具）的自定义题库配置 |
| 本地优先查询 | 收到查询请求后，优先在本地题库中精确/模糊匹配题目 |
| AI 兜底 | 本地未命中时，自动调用配置的 AI 服务获取答案 |
| 自动入库 | AI 返回的答案自动保存到本地题库（可关闭），逐步扩充题库 |
| 接口开关 | 可独立启用/禁用 Yatori 和 OCS 接口 |
| 并发控制 | AI 请求信号量机制，可配置最大并发数（默认 5） |
| 查询统计 | 实时统计今日查询次数、本地命中/AI 命中/未命中数 |
| 查询日志 | 记录每次查询的来源、内容、结果、耗时，支持按来源/结果筛选 |
| 日志清理 | 支持按天数清理或清空历史日志 |
| 接口配置 | 可配置 AI 超时时间、最大并发数、是否自动入库等 |

### 界面

| 功能 | 说明 |
|------|------|
| 侧边导航 | 响应式侧边栏，显示当前页面高亮，回收站显示数量角标 |
| 主题切换 | 浅色/深色模式，自动保存偏好，跟随系统偏好初始化 |
| 统计面板 | 按题型分布的实时统计卡片 + **回收站统计**（可点击跳转） |
| 趋势图表 | 近 7/30/90 天每日新增趋势（Chart.js 按需加载，支持切换时间范围） |
| Toast 通知 | 操作成功/失败/信息的即时反馈 |
| 确认弹窗 | 危险操作前的二次确认 |
| 搜索清除 | 搜索框内置清除按钮 |
| 按钮状态 | 批量操作按钮带 loading 动画 + disabled 防重复点击 |
| keep-alive 缓存 | 题目管理和回收站页面启用 keep-alive，返回时保持滚动位置 |
| 可搜索下拉框 | 分类筛选支持输入关键词实时过滤（SearchableSelect 组件） |
| 404 页面 | 未匹配路由展示友好 404 页面 |

## 启动

```bash
cd question-bank-manager

# 安装后端依赖
npm install

# 安装前端依赖并构建
cd frontend
npm install
npm run build
cd ..

# 启动服务（自动初始化数据库）
node backend/server.js
# 访问 http://localhost:3000

# 自定义端口
PORT=8080 node backend/server.js

# 手动初始化数据库（可选，首次启动自动执行）
npm run db:init
```

### 开发模式

```bash
# 终端 1：启动后端
cd question-bank-manager
node backend/server.js

# 终端 2：启动前端开发服务器（支持热更新）
cd question-bank-manager/frontend
npm run dev
# 访问 http://localhost:5173（自动代理 /api 到后端 3000 端口）
```

## 项目结构

```
question-bank-manager/
├── .gitignore               # Git 忽略配置
├── backend/                 # 后端源码
│   ├── server.js            # Express 后端入口（中间件注册 + 路由挂载 + 优雅关闭）
│   ├── utils.js             # 后端工具函数（localNow, safeParse, md5, sendError）
│   ├── validate.js          # 输入验证模块
│   ├── db-init.js           # 数据库初始化脚本（首次运行自动创建 data/default.db）
│   ├── middleware/          # JWT 认证中间件
│   └── routes/
│       ├── questions.js     # 题目 CRUD + 批量操作路由
│       ├── trash.js         # 回收站路由（恢复/永久删除/清空）
│       ├── stats.js         # 统计数据路由（GET /api/stats）
│       ├── categories.js    # 分类 CRUD 路由
│       ├── backup.js        # 备份/导入导出路由（含冲突解析）
│       ├── database.js      # 数据库管理路由（切换/上传/新建/重置/部署）
│       ├── ai.js            # AI 服务商管理 + 题目分析路由
│       ├── duplicates.js    # 题目去重路由
│       └── external.js      # 外部题库查询路由（Yatori/OCS 接口）
├── scripts/                 # 辅助脚本（发版、数据迁移）
├── package.json             # 后端依赖 + db:init / prestart 脚本
├── data/                    # 运行时数据目录（DATA_DIR 默认值，与 Docker /app/data 一致）
│   ├── default.db           # SQLite 默认数据库文件（运行时生成）
│   ├── db-config.json       # 数据库配置（当前路径 + 最近使用列表 + 目标目录，运行时生成）
│   ├── databases/           # 上传的数据库存放目录
│   └── tmp-uploads/         # 上传临时文件目录
├── frontend/
│   ├── index.html           # HTML 入口（lang=zh-CN, Inter 字体）
│   ├── vite.config.js       # Vite 配置（含 /api 代理到 localhost:3000）
│   ├── tailwind.config.js   # TailwindCSS 配置（Notion 色彩系统）
│   ├── postcss.config.js    # PostCSS 配置
│   ├── package.json         # 前端依赖
│   ├── yarn.lock            # Yarn 锁文件
│   └── src/
│       ├── main.js          # 应用入口（Pinia + Router）
│       ├── App.vue          # 根组件（keep-alive 缓存 Questions/Trash）
│       ├── assets/
│       │   ├── main.css     # TailwindCSS 组件样式 + 动画 + 搜索高亮 + 滚动条
│       │   └── images/
│       │       └── test.jpg # 关于页面头像图片
│       ├── router/
│       │   └── index.js     # Vue Router 路由配置（含 404 兜底）
│       ├── stores/
│       │   ├── theme.js     # 主题切换 store（跟随系统偏好 + localStorage 持久化）
│       │   ├── toast.js     # Toast 通知 store（success/error/info，自动消失）
│       │   ├── confirm.js   # 确认弹窗 store（Promise 风格 API）
│       │   ├── trash.js     # 回收站计数 store
│       │   └── questionsPage.js # 题目页状态缓存 store
│       ├── composables/
│       │   ├── useApi.js           # API 请求封装（fetch + 错误处理 + 所有接口）
│       │   ├── constants.js        # 常量定义（题型、颜色、图标）
│       │   ├── utils.js            # 工具函数（formatDate, daysSince, highlightText, normalizeAnswer, stripAnswerPrefix）
│       │   ├── usePagination.js    # 分页逻辑 composable（智能页码范围）
│       │   ├── useSelection.js     # 选择逻辑 composable（数组响应式，Vue 3 兼容）
│       │   └── useDebounceSearch.js # 搜索防抖 composable（300ms，自动清理）
│       ├── components/
│       │   ├── AppLayout.vue        # 布局壳（移动端汉堡菜单 + 侧边栏遮罩）
│       │   ├── Sidebar.vue          # 侧边导航栏（回收站角标 + 主题切换）
│       │   ├── ToastContainer.vue   # Toast 容器（TransitionGroup 动画）
│       │   ├── ConfirmDialog.vue    # 确认弹窗（Teleport 到 body）
│       │   ├── QuestionFormModal.vue # 题目表单弹窗（动态选项/答案输入）
│       │   ├── PaginationBar.vue    # 分页栏组件（页码跳转 + 每页条数切换）
│       │   ├── SearchInput.vue      # 搜索输入组件（清除按钮）
│       │   ├── SearchableSelect.vue # 可搜索下拉选择组件（关键词过滤 + 外部点击关闭）
│       │   ├── ImportResultDialog.vue # 导入结果弹窗（重复/冲突展示）
│       │   └── ImportCategoryDialog.vue # 导入分类确认弹窗（编辑分类名称和分值）
│       └── views/
│           ├── Dashboard.vue        # 仪表盘（Chart.js 趋势图 + 统计卡片）
│           ├── Questions.vue        # 题目管理（搜索高亮 + 可搜索分类筛选 + 批量操作）
│           ├── QuestionDetail.vue   # 题目详情（AI 校验答案 + 答案比对）
│           ├── Categories.vue       # 分类管理（内联编辑 + 搜索分页 + 点击跳转筛选）
│           ├── DataManagement.vue   # 数据管理（数据库切换/上传 + 导入导出 + 去重 + 批量删除）
│           ├── Trash.vue            # 回收站（批量恢复/永久删除/清空）
│           ├── AiSettings.vue       # AI 设置（服务商管理 + 模型选择 + 超时配置）
│           ├── ExternalBanks.vue    # 题库对接（Yatori/OCS 接口配置 + 统计 + 日志）
│           ├── About.vue            # 关于页面（项目介绍 + 技术栈展示）
│           └── NotFound.vue         # 404 页面
└── README.md
```

## API 接口

### 输入验证

所有写入接口均带输入验证，校验内容包括：

- **题型**：必须为 `单选题`/`多选题`/`判断题`/`填空题`/`简答题` 之一
- **题目内容**：不能为空，不超过 10000 字符
- **选项**：必须为字符串数组，单项不超过 2000 字符
- **答案**：必须为字符串数组，单项不超过 5000 字符
- **分类名称**：不能为空，不超过 100 字符
- **题目 ID**：必须为有效整数

### 错误响应

| HTTP 状态码 | 含义 |
|-------------|------|
| `400` | 请求参数无效（缺少必填字段、格式错误等） |
| `404` | 资源不存在 |
| `409` | 冲突（重复题目等） |
| `500` | 服务器内部错误 |
| `502` | AI 请求失败（网络错误等） |
| `504` | AI 请求超时 |

### 并发安全

所有涉及重复检测的写入操作（添加/编辑题目、恢复回收站）均使用 SQLite 事务包裹，确保高并发下不会插入重复数据。

### 题目

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/questions` | 题目列表（支持 type/category/search/sort/dateFrom/dateTo/page/pageSize） |
| GET | `/api/questions/:id` | 题目详情 |
| POST | `/api/questions` | 添加题目（支持 `force: true` 跳过重复检测） |
| PUT | `/api/questions/:id` | 编辑题目（支持 `force: true` 跳过重复检测） |
| DELETE | `/api/questions/:id` | **软删除**，移至回收站 |
| POST | `/api/questions/batch-delete` | **批量软删除**（支持 ids 数组或 before/after 时间范围 + type/category 筛选） |
| PUT | `/api/questions/batch-category` | 批量修改分类（`{ ids: [...], category: "..." }`） |

### 回收站

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/trash` | 回收站列表（支持 search/type/category/sort/page/pageSize） |
| GET | `/api/trash/count` | 回收站数量（用于侧边栏角标） |
| POST | `/api/trash/:id/restore` | 恢复单条题目（支持 `force: true` 跳过重复检测） |
| POST | `/api/trash/batch-restore` | 批量恢复（支持 `force: true`，自动跳过重复项） |
| DELETE | `/api/trash/:id` | 永久删除单条题目 |
| POST | `/api/trash/batch-delete` | 批量永久删除（`{ ids: [...] }`） |
| POST | `/api/trash/empty` | 清空回收站 |

### 统计与刷新

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 统计数据（总数、**回收站数**、按题型、按分类、每日趋势，支持 `?days=` 参数） |
| GET | `/api/refresh` | 合并刷新（统计数据 + 分类列表，减少请求次数） |

### 分类

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 分类列表（`[{ id, name, score, created_at, question_count }]`） |
| POST | `/api/categories` | 新增分类（支持 `score` 参数设置分值） |
| PUT | `/api/categories/:id` | 修改分类（支持 `name` 和 `score`，同步更新关联题目的 category 字段） |
| DELETE | `/api/categories/:id` | 删除分类（未删除题目归入「默认」） |

### 备份与导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/backup` | 下载数据库文件（`.db`），文件名含时间戳 |
| POST | `/api/backup/export` | 导出 JSON（支持 body 指定 type/category 筛选） |
| POST | `/api/backup/import/preview` | 导入预览（分析 JSON 中的分类及分值，返回分类列表） |
| POST | `/api/backup/import` | 导入 JSON（支持 categoryScores 参数，自动去重，含回收站检测，返回 imported/skipped/duplicates/conflicts） |
| POST | `/api/backup/import/resolve` | 解决导入冲突（批量覆盖指定题目的答案） |

### 数据库管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/database` | 获取当前数据库信息（路径、题目数、回收站数、分类数、文件大小、最近列表） |
| POST | `/api/database/switch` | 切换数据库（`{ dbPath }`），校验 SQLite 格式 + 完整性检查 |
| POST | `/api/database/create` | 新建空白数据库并切换（`{ dbPath }`） |
| POST | `/api/database/upload` | 上传 `.db` 文件并切换（multipart/form-data，支持 `?desiredName=` 指定保存名称） |
| POST | `/api/database/reset` | 切回默认数据库 `default.db` |
| DELETE | `/api/database/recent` | 从最近使用列表中移除指定路径（`{ dbPath }`） |
| GET | `/api/database/target-dir` | 获取刷课软件数据库目录路径 |
| PUT | `/api/database/target-dir` | 设置刷课软件数据库目录路径（`{ dir }`） |
| GET | `/api/database/available` | 获取所有可用数据库列表（默认数据库 + databases/ 目录下的数据库） |
| POST | `/api/database/deploy` | 部署数据库到刷课软件目录（`{ sourcePath, fileName, overwrite }`） |

### 题目去重

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/duplicates` | 扫描重复题目（题型+内容完全相同），返回分组列表 |
| POST | `/api/duplicates/resolve` | 去重处理（保留指定 ID，其余移至回收站） |

### AI 服务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/presets` | 获取内置 AI 服务商预设列表（DeepSeek、硅基流动、Kimi、豆包） |
| GET | `/api/ai/providers` | 获取已配置的 AI 服务商列表（API Key 脱敏显示） |
| POST | `/api/ai/providers` | 添加 AI 服务商 |
| PUT | `/api/ai/providers/:id` | 更新 AI 服务商 |
| DELETE | `/api/ai/providers/:id` | 删除 AI 服务商 |
| POST | `/api/ai/providers/:id/test` | 测试 AI 服务商连通性（调用 `/models` 端点） |
| GET | `/api/ai/providers/:id/models` | 获取 AI 服务商可用模型列表 |
| POST | `/api/ai/analyze` | AI 分析题目（返回 analysis + answer，支持自定义超时） |

### 外部题库查询

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/external/yatori` | Yatori 查询接口（兼容 yatori-go-quesbank API 配置） |
| GET | `/api/external/ocs` | OCS 查询接口（兼容 OCS 自定义题库配置） |
| POST | `/api/external/ocs` | OCS 查询接口（POST 方式） |
| GET | `/api/external/config` | 获取外部接口配置 |
| PUT | `/api/external/config` | 更新外部接口配置（yatori_enabled/ocs_enabled/max_concurrent_ai/ai_timeout/auto_save） |
| GET | `/api/external/stats` | 获取今日查询统计 |
| GET | `/api/external/logs` | 查询日志列表（支持 source/result 筛选） |
| DELETE | `/api/external/logs` | 清理日志（按天数或清空） |

## 多数据库管理

本项目支持管理多个 SQLite 数据库，方便在不同题库之间切换。

### 工作原理

- 数据库配置存储在 `db-config.json`（运行时自动生成），记录当前使用的数据库路径、最近使用列表和刷课软件目标目录
- 默认数据库 `default.db` 存放在项目根目录
- 上传的数据库统一存放在 `databases/` 子目录，与默认数据库隔离
- 切换数据库时，自动关闭旧连接（执行 WAL checkpoint），打开新连接并初始化表结构
- 切换前会校验文件是否为合法的 SQLite 数据库（检查文件头 magic number）并执行完整性检查
- 每次切换/上传/重置都会更新最近使用列表（最多保留 10 个）

### 使用方式

1. 在「数据管理」页面点击「选择数据库文件」，从本地选择 `.db` 文件上传
2. 上传与当前数据库同名的文件时，可选择「覆盖」或「自动重命名」（加时间戳后缀）
3. 在「最近使用的数据库」列表中点击切换到之前用过的数据库
4. 点击「切回默认数据库」可随时回到项目目录下的 `default.db`
5. 每条最近记录 hover 后有关闭按钮，可从列表中移除（不删除文件）

### 部署到刷课软件

支持将题库数据库一键部署到 [yatori-go-quesbank](https://github.com/yatori-dev/yatori-go-quesbank) 的数据库目录：

1. 在「部署到刷课软件」卡片中输入刷课软件的数据库目录路径，点击「验证」
2. 选择要部署的数据库（默认数据库或已上传的数据库）
3. 输入保存文件名（默认为 `default.db`，可自定义）
4. 点击「部署」，数据库文件将复制到目标目录
5. 若目标目录已存在同名文件，会提示确认是否覆盖

## 外部题库对接

本项目提供兼容 Yatori 和 OCS 的外部查询接口，可作为题库服务被其他工具调用。

### 工作原理

1. 收到查询请求后，**优先在本地题库中匹配**（精确匹配 → MD5 匹配 → 模糊匹配）
2. 本地未命中时，**自动调用配置的 AI 服务**获取答案
3. AI 返回的答案可**自动入库**（可关闭），逐步扩充本地题库
4. 使用信号量机制控制 AI 并发请求数，避免过载

### Yatori 接口

**端点**：`POST /api/external/yatori`

**请求格式**：
```json
{
  "type": "单选题",
  "content": "（）是艺术起源的理论之一",
  "options": ["情感说", "表现说", "游戏说", "模仿说"]
}
```

**响应格式**：
```json
{
  "type": "单选",
  "answers": ["表现说"]
}
```

**配置方式**：在 yatori-go-quesbank 的 `config.yml` 中配置：
```yaml
apiQueSetting:
  url: "http://localhost:3000/api/external/yatori"
```

### OCS 接口

**端点**：`GET /api/external/ocs` 或 `POST /api/external/ocs`

**请求参数**：
- `title`：题目内容（必填）
- `type`：题型（可选）
- `options`：选项 JSON 数组（可选）

**响应格式**：
```json
{
  "code": 1,
  "question": "题目内容",
  "answer": "答案1#答案2",
  "answers": ["答案1", "答案2"],
  "source": "local",
  "msg": "ok"
}
```

**配置方式**：在 OCS 中添加自定义题库配置：
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

### 查询结果来源

| source | 说明 |
|--------|------|
| `local` | 本地题库命中 |
| `ai` | AI 服务返回（已自动入库） |
| `not_found` | 本地和 AI 均未找到答案 |
| `disabled` | 对应接口已禁用 |

### 配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `yatori_enabled` | `true` | 是否启用 Yatori 接口 |
| `ocs_enabled` | `true` | 是否启用 OCS 接口 |
| `max_concurrent_ai` | `5` | 最大并发 AI 请求数 |
| `ai_timeout` | `30` | AI 请求超时（秒） |
| `auto_save` | `true` | 是否自动保存 AI 答案到本地 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |

## License

MIT
