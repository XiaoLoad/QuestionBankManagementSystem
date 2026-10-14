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

  function buildSettingsResponse(settings, changelog) {
    return {
      site_name: settings.site_name || DEFAULTS.site_name,
      site_description: settings.site_description || DEFAULTS.site_description,
      announcement_modal: settings.announcement_modal || DEFAULTS.announcement_modal,
      announcement_modal_enabled: settings.announcement_modal_enabled === '1',
      announcement_modal_updated_at: settings.announcement_modal_updated_at || '',
      announcement_banner: settings.announcement_banner || DEFAULTS.announcement_banner,
      announcement_banner_enabled: settings.announcement_banner_enabled === '1',
      announcement_banner_updated_at: settings.announcement_banner_updated_at || '',
      footer_text: settings.footer_text || DEFAULTS.footer_text,
      footer_hitokoto: settings.footer_hitokoto === '1',
      footer_hitokoto_types: settings.footer_hitokoto_types || DEFAULTS.footer_hitokoto_types,
      footer_hitokoto_cache_minutes: parseInt(settings.footer_hitokoto_cache_minutes || DEFAULTS.footer_hitokoto_cache_minutes),
      app_version: settings.app_version || DEFAULTS.app_version,
      changelog: changelog || settings.changelog || DEFAULTS.changelog,
    };
  }

  // 构建带更新日志的完整响应（异步），版本号优先取最新版本 tag
  async function buildSettingsResponseWithChangelog(settings) {
    const { content } = await getChangelog();
    const response = buildSettingsResponse(settings, content);
    if (githubChangelogCache && githubChangelogCache.latestTag) {
      response.app_version = githubChangelogCache.latestTag;
    }
    return response;
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

  // GitHub Releases 更新日志缓存
  const GITHUB_REPO = 'XiaoLoad/QuestionBankManagementSystem';
  const GITHUB_CHANGELOG_CACHE_MS = 30 * 60 * 1000; // 30 分钟
  let githubChangelogCache = null;   // { content, fetchedAt }
  let githubChangelogFetching = null; // 进行中的请求 Promise，避免并发重复拉取

  // GITHUB_INSECURE_TLS=1 可跳过证书校验（默认严格校验）
  const GITHUB_INSECURE_TLS = process.env.GITHUB_INSECURE_TLS === '1';

  // 用 node:https 请求 GitHub API（支持跳过证书校验）
  function httpsGetJson(url, headers, rejectUnauthorized) {
    return new Promise((resolve, reject) => {
      const req = require('https').request(url, {
        method: 'GET',
        headers,
        rejectUnauthorized,
        timeout: 8000,
      }, (res) => {
        // 用 Buffer 拼接，避免中文多字节 UTF-8 字符被 chunk 边界切断产生乱码
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try {
            const data = Buffer.concat(chunks).toString('utf8');
            resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch (e) {
            reject(new Error('响应 JSON 解析失败'));
          }
        });
      });
      req.on('timeout', () => { req.destroy(new Error('请求超时')); });
      req.on('error', reject);
      req.end();
    });
  }

  // 请求 GitHub API（GITHUB_INSECURE_TLS=1 可跳过证书校验，默认严格校验）
  async function githubApiGet(url, headers) {
    return httpsGetJson(url, headers, !GITHUB_INSECURE_TLS);
  }

  // 从 GitHub Releases 拉取更新日志并拼接为现有格式
  async function fetchChangelogFromGithub() {
    // 缓存命中
    if (githubChangelogCache && (Date.now() - githubChangelogCache.fetchedAt) < GITHUB_CHANGELOG_CACHE_MS) {
      return githubChangelogCache.content;
    }

    // 已有进行中的请求则复用
    if (githubChangelogFetching) {
      return githubChangelogFetching;
    }

    githubChangelogFetching = (async () => {
      try {
        const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'question-bank-manager' };
        if (process.env.GITHUB_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        const response = await githubApiGet(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50`, headers);

        if (response.status !== 200) {
          throw new Error(`GitHub API 响应 ${response.status}`);
        }

        const releases = response.json;
        if (!Array.isArray(releases) || releases.length === 0) {
          throw new Error('GitHub Releases 为空');
        }

        const content = releases
          .filter(r => (r.body || '').trim())
          .map(r => {
            const tag = r.tag_name || '';
            const date = (r.published_at || '').split('T')[0];
            return `## ${tag} (${date})\n\n${r.body.trim()}`;
          })
          .join('\n\n---\n\n');

        if (!content) {
          throw new Error('GitHub Releases 内容为空');
        }

        // 最新 Release 的 tag 作为当前版本号
        const latestTag = releases.find(r => (r.body || '').trim())?.tag_name || releases[0].tag_name || '';

        githubChangelogCache = { content, fetchedAt: Date.now(), latestTag };
        return content;
      } finally {
        githubChangelogFetching = null;
      }
    })();

    return githubChangelogFetching;
  }

  // 读取本地 CHANGELOG.md（发版脚本自动生成，随项目发布）
  function readLocalChangelog() {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '..', '..', 'CHANGELOG.md');
    const raw = fs.readFileSync(filePath, 'utf8');
    // 去掉文件头部说明（第一个 "## " 版本段之前的内容）
    const idx = raw.indexOf('\n## ');
    const content = idx >= 0 ? raw.slice(idx + 1).trim() : raw.trim();
    if (!content) {
      throw new Error('本地 CHANGELOG.md 内容为空');
    }
    // 从本地文件提取最新版本号
    const tagMatch = content.match(/^## (v[\w.-]+)/m);
    return { content, latestTag: tagMatch ? tagMatch[1] : '' };
  }

  // 获取更新日志：GitHub 成功则存库并显示；失败则读本地 CHANGELOG.md 并存库；再失败返回空（前端显示失败提示）
  async function getChangelog() {
    try {
      const content = await fetchChangelogFromGithub();
      saveChangelogToDb(content);
      return { content, fromGithub: true };
    } catch (e) {
      console.error('[site-settings] 拉取 GitHub 更新日志失败，尝试本地 CHANGELOG.md:', e.message);
    }

    try {
      const { content, latestTag } = readLocalChangelog();
      saveChangelogToDb(content);
      if (latestTag) {
        githubChangelogCache = { content, fetchedAt: Date.now(), latestTag };
      }
      return { content, fromGithub: false };
    } catch (e) {
      console.error('[site-settings] 读取本地 CHANGELOG.md 失败:', e.message);
      return { content: '', fromGithub: false, failed: true };
    }
  }

  // 将更新日志写入数据库持久化
  function saveChangelogToDb(content) {
    try {
      const db = getDb();
      db.prepare('INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run('changelog', content, localNow());
    } catch (e) {
      console.error('[site-settings] 更新日志写入数据库失败:', e.message);
    }
  }

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
      if (row.key === 'announcement_banner' && row.updated_at) {
        settings.announcement_banner_updated_at = row.updated_at;
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
  router.get('/', async (req, res) => {
    try {
      res.json(await buildSettingsResponseWithChangelog(getSettingsObj()));
    } catch (err) {
      sendError(res, err, 'GET /api/site-settings');
    }
  });

  // GET /api/site-settings/all — 管理员获取全部设置
  router.get('/all', auth.adminRequired, async (req, res) => {
    try {
      res.json(await buildSettingsResponseWithChangelog(getSettingsObj()));
    } catch (err) {
      sendError(res, err, 'GET /api/site-settings/all');
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

      res.json({ message: '设置已保存', updated: updates });
    } catch (err) {
      sendError(res, err, 'PUT /api/site-settings');
    }
  });

  return router;
};
