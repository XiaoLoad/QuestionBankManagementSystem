const express = require('express');

module.exports = function (getDb, { sendError, localNow }, auth) {
  const router = express.Router();

  // 默认设置值
  const DEFAULTS = {
    site_name: '题库管理',
    site_description: 'Question Bank',
    announcement_modal: '',
    announcement_modal_enabled: '0',
    announcement_banner: '',
    announcement_banner_enabled: '0',
    footer_text: '',
    footer_hitokoto: '0',
    footer_hitokoto_types: 'a.b.c.d.e.f.g.h.i.j.k.l',
    footer_hitokoto_cache_minutes: '5',
    app_version: 'v1.0.0',
    changelog: '',
  };

  // 一言缓存
  let hitokotoCache = null;   // { hitokoto, from, from_who }
  let hitokotoCacheTime = 0;  // 缓存时间戳

  function buildSettingsResponse(settings) {
    return {
      site_name: settings.site_name || DEFAULTS.site_name,
      site_description: settings.site_description || DEFAULTS.site_description,
      announcement_modal: settings.announcement_modal || DEFAULTS.announcement_modal,
      announcement_modal_enabled: settings.announcement_modal_enabled === '1',
      announcement_modal_updated_at: settings.announcement_modal_updated_at || '',
      announcement_banner: settings.announcement_banner || DEFAULTS.announcement_banner,
      announcement_banner_enabled: settings.announcement_banner_enabled === '1',
      footer_text: settings.footer_text || DEFAULTS.footer_text,
      footer_hitokoto: settings.footer_hitokoto === '1',
      footer_hitokoto_types: settings.footer_hitokoto_types || DEFAULTS.footer_hitokoto_types,
      footer_hitokoto_cache_minutes: parseInt(settings.footer_hitokoto_cache_minutes || DEFAULTS.footer_hitokoto_cache_minutes),
      app_version: settings.app_version || DEFAULTS.app_version,
      changelog: settings.changelog || DEFAULTS.changelog,
    };
  }

  // 初始更新日志内容
  const INITIAL_CHANGELOG = `## v1.0.0 (2026-06-23)

### 🎉 正式版发布
- 题库管理系统正式版上线
- 支持多数据库管理与切换
- Docker 部署支持

### ✨ 新增功能
- 网站设置与公告系统（弹窗公告、横幅公告）
- 公告支持 Markdown 语法渲染
- 更新日志系统，自动记录版本更新
- 移动端 Toast 适配为顶部通栏样式
- 页面过渡动画与骨架屏加载优化

### 🐛 问题修复
- 修复数据库上传缺少认证 token 导致网络错误
- 修复简答题答案不再按行拆分
- 旧公告数据自动迁移

---

## v0.9.0 (2026-06-20)

### ✨ 刷题功能增强
- 刷题功能扩展及页面优化
- 新增选项乱序功能
- 刷题页面布局优化及重命名
- 刷题页面移动端适配及进度持久化

### 🐛 问题修复
- 修复刷题完成日志漏报问题
- 修复导出 JSON 未登录问题及题型多选

---

## v0.8.0 (2026-06-18)

### ✨ 用户系统
- 新增用户登录和权限管理系统
- 普通用户可查看仪表盘、题目、分类
- 新增用户删除功能
- 新增用户活动日志功能

### ✨ API 增强
- 新增题型数量查询接口
- 多页面移动端布局优化

---

## v0.7.0 (2026-06-15)

### ✨ 刷题模块
- 新增刷题模块
- 刷题模块优化及构建脚本
- 复习模式优化

### 🐛 问题修复
- 编辑判断题时自动补全选项防止丢失

---

## v0.6.0 (2026-06-12)

### ✨ 外部接口优化
- 默认分类保护及外部接口参数优化
- 填空题和简答题调用 AI 时过滤无效选项防止 JS 代码污染 prompt
- 填空题和简答题入库时清除选项数据

---

## v0.5.0 (2026-06-10)

### ✨ 图片与分类增强
- 支持题目图片字段及 AI 图片识别
- 分类备注功能及导入分类映射优化
- 新增移动题目功能并优化删除分类逻辑

---

## v0.1.0 (2026-06-08)

### 🎉 初始版本
- 题库管理系统基础功能
- 题目管理：增删改查、搜索、筛选
- 分类管理：科目分类的增删改查
- 数据管理：JSON 导入导出、数据库备份
- 仪表盘：数据概览、新增趋势图表`;

  // 获取设置（内部辅助函数）
  function getSettingsObj() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value, updated_at FROM site_settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
      if (row.key === 'announcement_modal' && row.updated_at) {
        settings.announcement_modal_updated_at = row.updated_at;
      }
    }

    // 如果没有更新日志，自动初始化
    if (!settings.changelog) {
      try {
        const now = localNow();
        db.prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)').run('changelog', INITIAL_CHANGELOG, now);
        settings.changelog = INITIAL_CHANGELOG;
        console.log('[db] 已初始化更新日志');
      } catch (e) {
        console.error('[db] 初始化更新日志失败:', e.message);
      }
    }

    return settings;
  }

  // GET /api/site-settings — 公开接口，返回公告和页脚设置
  router.get('/', (req, res) => {
    try {
      res.json(buildSettingsResponse(getSettingsObj()));
    } catch (err) {
      sendError(res, err, 'GET /api/site-settings');
    }
  });

  // GET /api/site-settings/all — 管理员获取全部设置
  router.get('/all', auth.adminRequired, (req, res) => {
    try {
      res.json(buildSettingsResponse(getSettingsObj()));
    } catch (err) {
      sendError(res, err, 'GET /api/site-settings/all');
    }
  });

  // POST /api/site-settings/reset-changelog — 管理员重置更新日志为初始内容
  router.post('/reset-changelog', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const now = localNow();
      db.prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)').run('changelog', INITIAL_CHANGELOG, now);
      res.json({ message: '更新日志已重置', changelog: INITIAL_CHANGELOG });
    } catch (err) {
      sendError(res, err, 'POST /api/site-settings/reset-changelog');
    }
  });

  // GET /api/site-settings/hitokoto — 代理一言 API（带缓存）
  router.get('/hitokoto', async (req, res) => {
    try {
      const db = getDb();

      // 读取缓存时长
      const cacheRow = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('footer_hitokoto_cache_minutes');
      const cacheMinutes = Math.max(1, Math.min(60, parseInt(cacheRow?.value || DEFAULTS.footer_hitokoto_cache_minutes)));
      const cacheMs = cacheMinutes * 60 * 1000;

      // 缓存命中
      const now = Date.now();
      if (hitokotoCache && (now - hitokotoCacheTime) < cacheMs) {
        return res.json(hitokotoCache);
      }

      // 缓存过期，请求一言 API
      const typesRow = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('footer_hitokoto_types');
      const types = typesRow ? typesRow.value : DEFAULTS.footer_hitokoto_types;

      const params = types.split('.').filter(Boolean).map(t => `c=${t}`).join('&');
      const url = `https://v1.hitokoto.cn/${params ? '?' + params : ''}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      const data = await response.json();
      const result = { hitokoto: data.hitokoto || '', from: data.from || '', from_who: data.from_who || '' };

      // 更新缓存
      hitokotoCache = result;
      hitokotoCacheTime = now;

      res.json(result);
    } catch (err) {
      // 请求失败时返回缓存（如有），否则返回空
      if (hitokotoCache) {
        return res.json(hitokotoCache);
      }
      res.json({ hitokoto: '', from: '', from_who: '' });
    }
  });

  // PUT /api/site-settings — 管理员批量更新设置
  router.put('/', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const now = localNow();
      const allowedKeys = ['site_name', 'site_description', 'announcement_modal', 'announcement_modal_enabled', 'announcement_banner', 'announcement_banner_enabled', 'footer_text', 'footer_hitokoto', 'footer_hitokoto_types', 'footer_hitokoto_cache_minutes', 'app_version'];

      // 保存后清除一言缓存，使新配置立即生效
      if (req.body.footer_hitokoto_types !== undefined || req.body.footer_hitokoto_cache_minutes !== undefined) {
        hitokotoCache = null;
        hitokotoCacheTime = 0;
      }

      const stmt = db.prepare('INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');

      const updates = [];
      for (const key of allowedKeys) {
        if (req.body[key] !== undefined) {
          const val = String(req.body[key]);
          stmt.run(key, val, now);
          updates.push(key);
        }
      }

      // 处理更新日志追加
      if (req.body.is_changelog && req.body.announcement_modal) {
        const changelogRow = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('changelog');
        const existingChangelog = changelogRow ? changelogRow.value : '';
        const newEntry = req.body.announcement_modal.trim();
        const dateStr = now.split(' ')[0]; // 只取日期部分
        const version = req.body.app_version || DEFAULTS.app_version;

        // 构建新的更新日志条目
        const entry = `## ${version} (${dateStr})\n\n${newEntry}`;
        const updatedChangelog = existingChangelog ? `${entry}\n\n---\n\n${existingChangelog}` : entry;

        stmt.run('changelog', updatedChangelog, now);
        updates.push('changelog');
      }

      res.json({ message: '设置已保存', updated: updates });
    } catch (err) {
      sendError(res, err, 'PUT /api/site-settings');
    }
  });

  return router;
};
