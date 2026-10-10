# 更新日志

本文件基于提交记录自动生成，请勿手动编辑（发版由 `yarn release:patch|minor|major` 驱动）。
## v2.1.0（2026-10-10）

### 文档
- 补充外部题库接口的密钥鉴权说明（d50b733）

### 新功能
- **external**: 外部题库接口增加密钥鉴权、总开关与管理端点访问控制（8bbc916）
- **external**: 外部题库页新增接口安全管理卡片（344a850）

### 重构
- **data**: 移除部署到刷课软件功能（781d1a1）
## 未发布

### 文档
- **readme**: 同步开发模式说明并修正目录树（8e86f16）
- **readme**: 新增运行截图章节（0e915e6）

### 新功能
- **release**: 发版时自动生成版本总结写入 commit 与 tag（1877c60）
- **dev**: 根目录 yarn dev 一键并行启动前后端（3ee51d7）
- **release**: 新增 GitHub Actions 自动发版工作流（d6b6526）
## v2.0.0（2026-10-08）

### 文档
- 部署与架构文档归组至 docs 目录（af3fc85）
- **readme**: 重构 README 排版，新增徽标、程序图标与目录结构（875839b）
- 补充 v1.0.0 升级至 v2.0.0 的迁移指南（46ea2cd）

### 新功能
- **前端**: 新增站点 favicon 图标（fd25cf0）

### 重构
- **backend**: 统一后端至 backend 目录，运行时数据集中至 data（d839d8c）

### 问题修复
- **后端**: 题目图片经代理加载并支持 AI 请求携带图片（268a019）
## v1.0.0（2026-10-08）

### 文档
- 更新 README 并新增题库导入格式规范（cae967b）

### 新功能
- **auth**: 新增用户登录和权限管理系统（aff6ad5）
- **quiz**: 刷题页面移动端适配及进度持久化（027653e）
- **api**: 新增题型数量查询接口（a76ef08）
- **权限**: 普通用户可查看仪表盘、题目、分类（f722c2a）
- **user**: 新增用户删除功能（0ef1ac3）
- **ui**: 多页面移动端布局优化（bd64ded）
- **log**: 新增用户活动日志功能（661b9b6）
- **quiz**: 刷题功能扩展及复习模式优化（69f04dc）
- **quiz**: 刷题功能扩展及页面优化（25909b0）
- **quiz**: 新增选项乱序功能（d9d9842）
- **ui**: 刷题页面布局优化及重命名（26db6cc）
- **settings**: 新增网站设置与公告功能（e75bcc5）
- **ui**: 页面过渡动画与骨架屏加载优化（ba92d37）
- **announcement**: 公告拆分为弹窗公告和横幅公告（b82a07d）
- **db**: 旧公告数据自动迁移（493147d）
- **docker**: 新增 Docker 部署支持（b43cb91）
- **ui**: 移动端Toast适配为顶部通栏样式（5472bf0）
- **changelog**: 新增版本更新日志系统（f2e13d8）
- **ui**: 公告弹窗和横幅改为全局显示（833fbd6）
- **auth**: 新增用户分类题库可见性控制（274e6bb）
- AI 解析缓存功能（3bfcf28）
- 登录账号锁定功能（ab29a67）
- **quiz**: 刷题页面 UI 优化与 AI 解析功能（70e259d）
- 用户自定义 AI 模型功能（b3552fd）
- 用户自定义 AI 提示词功能（6e9a365）
- AI 校验弹窗流式输出 + 后台生成 + 悬浮进度球（bd1acc3）
- AI 答案替换与标记状态功能（63d5f7b）
- 多主题色切换功能（e20c817）

### 杂项
- **后端**: 搭建版本管理体系（npm version + git-cliff）（fcac202）

### 界面优化
- **quiz**: 练习结果页布局优化（6e5cd24）
- **ai-settings**: 优化 AI 设置页布局（00f257d）
- 优化全局动画效果，提升用户体验（1a75bd2）
- 优化主题切换过渡动画效果（94f9c3e）
- 统一图标样式，添加边框效果（96afd78）

### 重构
- **ui**: 重构关于页面，参考 ZhHeo 博客风格（8a60b73）

### 问题修复
- **外部接口**: 填空题和简答题调用AI时过滤无效选项防止JS代码污染prompt（c7a830c）
- **export**: 修复导出JSON未登录问题及题型多选（41bac65）
- **quiz**: 修复刷题完成日志漏报问题（d455b90）
- **form**: 简答题答案不再按行拆分（c9d74ae）
- **db**: 修复数据库上传缺少认证token导致网络错误（9774762）
- **users**: 修复删除用户时外键约束失败的问题（c9c5c2a）
- **quiz**: 修复复习模式被错误记录为刷题的问题（5bdcc2e）
- **ui**: 优化题库对接页面移动端布局（a056be2）
- **ui**: 重置密码增加二次确认输入（40c0b65）
- **ui**: 修复横幅公告和弹窗公告显示问题（71706de）
- 修复横幅公告关闭状态和独立性问题（cd92807）
- **ui**: 修复题目列表和回收站移动端布局问题（866cbc3）
- **quiz**: 修复错题重练后返回设置页被重定向回结果页的BUG（c81290c）
- **ai-settings**: 优化移动端布局和按钮文字（4c9783d）
- 修复 AI API 401 导致用户退出登录 + AI 日志布局优化（f1bb5ea）
- 修复判断题答案标准化问题（401bd1e）
- 修复用户分类限制和主题样式问题（8392a39）
- **后端**: 升级 better-sqlite3 到 v12 以支持 Node 24（09e5ecf）
## v1.0.0-beta.1（2026-06-03）

### 其他
- Initial commit: Question Bank Management System

A web-based question bank management tool for yatori-go-console and OCS.

Features:
- CRUD operations for questions (5 types)
- Category management with scores
- AI answer verification (OpenAI compatible)
- Yatori/OCS external query interfaces
- Multi-database management
- Import/Export with conflict resolution
- Trash management with soft delete

Tech stack: Node.js, Express, Vue 3, Vite, SQLite, TailwindCSS（05bf1f3）

### 新功能
- **分类管理**: 新增移动题目功能并优化删除分类逻辑（2b7e080）
- 支持题目图片字段及 AI 图片识别（5fa8804）
- 分类备注功能及导入分类映射优化（d49efb8）
- 新增刷题模块（5852a00）
- 刷题模块优化及构建脚本（13dd094）
- 默认分类保护及外部接口参数优化（66fff85）

### 问题修复
- **外部接口**: 填空题和简答题入库时清除选项数据（d7e1077）
- 编辑判断题时自动补全选项防止丢失（819559d）
