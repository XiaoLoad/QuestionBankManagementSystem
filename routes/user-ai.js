const express = require('express');

module.exports = function (getDb, { sendError, localNow }, auth) {
  const router = express.Router();

  // 所有路由都需要登录
  router.use(auth.authRequired);

  /**
   * GET /api/user-ai/providers
   * 获取当前用户的 AI 服务商列表
   */
  router.get('/providers', (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare(
        'SELECT * FROM user_ai_providers WHERE user_id = ? ORDER BY is_default DESC, id ASC'
      ).all(req.user.id);

      const masked = rows.map(r => ({
        ...r,
        api_key_masked: r.api_key.length > 8
          ? r.api_key.slice(0, 4) + '****' + r.api_key.slice(-4)
          : '****',
      }));

      res.json(masked);
    } catch (err) { sendError(res, err, 'GET /api/user-ai/providers'); }
  });

  /**
   * POST /api/user-ai/providers
   * 添加用户 AI 服务商
   */
  router.post('/providers', (req, res) => {
    try {
      const db = getDb();
      const { name, base_url, api_key, model = '', is_default = false } = req.body;

      if (!name || !base_url || !api_key) {
        return res.status(400).json({ error: '名称、API 地址和 API Key 不能为空' });
      }

      const now = localNow();

      // 如果设为默认，先取消其他默认
      if (is_default) {
        db.prepare('UPDATE user_ai_providers SET is_default = 0 WHERE user_id = ?').run(req.user.id);
      }

      const result = db.prepare(
        'INSERT INTO user_ai_providers (user_id, name, base_url, api_key, model, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(req.user.id, name.trim(), base_url.trim(), api_key.trim(), model, is_default ? 1 : 0, now, now);

      res.json({ id: result.lastInsertRowid, message: '添加成功' });
    } catch (err) { sendError(res, err, 'POST /api/user-ai/providers'); }
  });

  /**
   * PUT /api/user-ai/providers/:id
   * 更新用户 AI 服务商
   */
  router.put('/providers/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });

      const existing = db.prepare(
        'SELECT * FROM user_ai_providers WHERE id = ? AND user_id = ?'
      ).get(id, req.user.id);

      if (!existing) return res.status(404).json({ error: '服务商不存在' });

      const { name, base_url, api_key, model, is_default, enabled } = req.body;
      const now = localNow();

      // 如果设为默认，先取消其他默认
      if (is_default) {
        db.prepare('UPDATE user_ai_providers SET is_default = 0 WHERE user_id = ?').run(req.user.id);
      }

      db.prepare(
        `UPDATE user_ai_providers SET name=@name, base_url=@base_url, api_key=@api_key, model=@model, is_default=@is_default, enabled=@enabled, updated_at=@updated_at WHERE id=@id AND user_id=@user_id`
      ).run({
        id,
        user_id: req.user.id,
        name: name !== undefined ? name.trim() : existing.name,
        base_url: base_url !== undefined ? base_url.trim() : existing.base_url,
        api_key: api_key !== undefined ? api_key.trim() : existing.api_key,
        model: model !== undefined ? model : existing.model,
        is_default: is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
        enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        updated_at: now,
      });

      res.json({ message: '更新成功' });
    } catch (err) { sendError(res, err, 'PUT /api/user-ai/providers/:id'); }
  });

  /**
   * DELETE /api/user-ai/providers/:id
   * 删除用户 AI 服务商
   */
  router.delete('/providers/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });

      const result = db.prepare(
        'DELETE FROM user_ai_providers WHERE id = ? AND user_id = ?'
      ).run(id, req.user.id);

      if (result.changes === 0) return res.status(404).json({ error: '服务商不存在' });
      res.json({ message: '删除成功' });
    } catch (err) { sendError(res, err, 'DELETE /api/user-ai/providers/:id'); }
  });

  /**
   * POST /api/user-ai/providers/:id/test
   * 测试用户 AI 服务商连接
   */
  router.post('/providers/:id/test', async (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });

      const provider = db.prepare(
        'SELECT * FROM user_ai_providers WHERE id = ? AND user_id = ?'
      ).get(id, req.user.id);

      if (!provider) return res.status(404).json({ error: '服务商不存在' });

      const url = provider.base_url.replace(/\/+$/, '') + '/models';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${provider.api_key}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.json({ ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` });
      }

      res.json({ ok: true, message: '连接成功' });
    } catch (err) {
      res.json({ ok: false, error: err.message || '连接失败' });
    }
  });

  /**
   * GET /api/user-ai/providers/:id/models
   * 获取用户 AI 服务商模型列表
   */
  router.get('/providers/:id/models', async (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });

      const provider = db.prepare(
        'SELECT * FROM user_ai_providers WHERE id = ? AND user_id = ?'
      ).get(id, req.user.id);

      if (!provider) return res.status(404).json({ error: '服务商不存在' });

      const url = provider.base_url.replace(/\/+$/, '') + '/models';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${provider.api_key}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.status(response.status).json({ error: `获取模型列表失败: HTTP ${response.status}` });
      }

      const data = await response.json();
      const models = (data.data || data.models || []).map(m => m.id || m.name).filter(Boolean).sort();
      res.json({ models });
    } catch (err) { sendError(res, err, 'GET /api/user-ai/providers/:id/models'); }
  });

  /**
   * GET /api/user-ai/admin-config
   * 获取管理员 AI 配置（只读，隐藏 API Key）
   */
  router.get('/admin-config', (req, res) => {
    try {
      const db = getDb();

      // 检查用户是否被授权使用管理员 AI
      const user = db.prepare('SELECT can_use_admin_ai FROM users WHERE id = ?').get(req.user.id);
      if (!user || !user.can_use_admin_ai) {
        return res.json({ authorized: false, providers: [] });
      }

      // 获取管理员的 AI 服务商
      const rows = db.prepare(
        'SELECT name, base_url, model, is_default FROM ai_providers ORDER BY is_default DESC, id ASC'
      ).all();

      res.json({
        authorized: true,
        providers: rows.map(r => ({
          name: r.name,
          base_url: r.base_url,
          model: r.model,
          is_default: !!r.is_default,
          api_key_masked: '****',
        })),
      });
    } catch (err) { sendError(res, err, 'GET /api/user-ai/admin-config'); }
  });

  return router;
};
