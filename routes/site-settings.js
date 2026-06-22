const express = require('express');

module.exports = function (getDb, { sendError, localNow }, auth) {
  const router = express.Router();

  // 默认设置值
  const DEFAULTS = {
    site_name: '题库管理',
    site_description: 'Question Bank',
    announcement: '',
    announcement_enabled: '0',
    footer_text: '',
    footer_hitokoto: '0',
    footer_hitokoto_types: 'a.b.c.d.e.f.g.h.i.j.k.l',
    footer_hitokoto_cache_minutes: '5',
  };

  // 一言缓存
  let hitokotoCache = null;   // { hitokoto, from, from_who }
  let hitokotoCacheTime = 0;  // 缓存时间戳

  function buildSettingsResponse(settings) {
    return {
      site_name: settings.site_name || DEFAULTS.site_name,
      site_description: settings.site_description || DEFAULTS.site_description,
      announcement: settings.announcement || DEFAULTS.announcement,
      announcement_enabled: settings.announcement_enabled === '1',
      footer_text: settings.footer_text || DEFAULTS.footer_text,
      footer_hitokoto: settings.footer_hitokoto === '1',
      footer_hitokoto_types: settings.footer_hitokoto_types || DEFAULTS.footer_hitokoto_types,
      footer_hitokoto_cache_minutes: parseInt(settings.footer_hitokoto_cache_minutes || DEFAULTS.footer_hitokoto_cache_minutes),
    };
  }

  // GET /api/site-settings — 公开接口，返回公告和页脚设置
  router.get('/', (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT key, value FROM site_settings').all();
      const settings = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      res.json(buildSettingsResponse(settings));
    } catch (err) {
      sendError(res, err, 'GET /api/site-settings');
    }
  });

  // GET /api/site-settings/all — 管理员获取全部设置
  router.get('/all', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT key, value FROM site_settings').all();
      const settings = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      res.json(buildSettingsResponse(settings));
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
      const allowedKeys = ['site_name', 'site_description', 'announcement', 'announcement_enabled', 'footer_text', 'footer_hitokoto', 'footer_hitokoto_types', 'footer_hitokoto_cache_minutes'];

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
