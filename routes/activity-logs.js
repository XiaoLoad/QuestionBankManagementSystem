const express = require('express');

/**
 * 活动日志路由工厂函数（仅管理员）
 * @param {Function} getDb - 获取数据库实例的函数
 * @param {Object} helpers - 工具函数
 * @param {Object} auth - 鉴权中间件
 * @returns {Object} Express Router
 */
module.exports = function (getDb, helpers, auth) {
  const router = express.Router();

  // 所有路由都需要管理员权限
  router.use(auth.adminRequired);

  /**
   * GET /api/activity-logs
   * 获取活动日志列表
   * 查询参数：user_id, action, page, pageSize
   */
  router.get('/', (req, res) => {
    try {
      const db = getDb();
      const { user_id, action, page = 1, pageSize = 20 } = req.query;
      const p = Math.max(1, parseInt(page));
      const ps = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
      const offset = (p - 1) * ps;

      let where = 'WHERE 1=1';
      const params = {};

      if (user_id) {
        where += ' AND l.user_id = @user_id';
        params.user_id = parseInt(user_id);
      }
      if (action) {
        where += ' AND l.action = @action';
        params.action = action;
      }

      const countRow = db.prepare(`SELECT COUNT(*) as total FROM user_activity_logs l ${where}`).get(params);
      const rows = db.prepare(`
        SELECT l.*, u.username, u.display_name
        FROM user_activity_logs l
        LEFT JOIN users u ON u.id = l.user_id
        ${where}
        ORDER BY l.created_at DESC
        LIMIT @limit OFFSET @offset
      `).all({ ...params, limit: ps, offset });

      const items = rows.map(row => ({
        ...row,
        detail: row.detail ? helpers.safeParse(row.detail) : null,
      }));

      res.json({
        items,
        total: countRow.total,
        page: p,
        pageSize: ps,
        totalPages: Math.ceil(countRow.total / ps),
      });
    } catch (err) {
      res.status(500).json({ error: '获取活动日志失败: ' + err.message });
    }
  });

  /**
   * DELETE /api/activity-logs/user/:userId
   * 清空指定用户的活动日志
   */
  router.delete('/user/:userId', (req, res) => {
    try {
      const db = getDb();
      const { userId } = req.params;

      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const result = db.prepare('DELETE FROM user_activity_logs WHERE user_id = ?').run(userId);
      res.json({ message: `已清空 ${result.changes} 条日志记录`, deleted: result.changes });
    } catch (err) {
      res.status(500).json({ error: '清空日志失败: ' + err.message });
    }
  });

  /**
   * GET /api/activity-logs/stats/:userId
   * 获取指定用户的活动统计
   */
  router.get('/stats/:userId', (req, res) => {
    try {
      const db = getDb();
      const { userId } = req.params;

      const user = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const totalLogins = db.prepare(
        "SELECT COUNT(*) as cnt FROM user_activity_logs WHERE user_id = ? AND action = 'login'"
      ).get(userId).cnt;

      const totalQuizSessions = db.prepare(
        "SELECT COUNT(*) as cnt FROM user_activity_logs WHERE user_id = ? AND action = 'quiz_start'"
      ).get(userId).cnt;

      const recentLogs = db.prepare(`
        SELECT * FROM user_activity_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).all(userId);

      const quizByCategory = db.prepare(`
        SELECT
          json_extract(detail, '$.category') as category,
          COUNT(*) as cnt
        FROM user_activity_logs
        WHERE user_id = ? AND action = 'quiz_start' AND detail IS NOT NULL
        GROUP BY category
        ORDER BY cnt DESC
      `).all(userId);

      res.json({
        user,
        totalLogins,
        totalQuizSessions,
        quizByCategory,
        recentLogs: recentLogs.map(l => ({ ...l, detail: l.detail ? helpers.safeParse(l.detail) : null })),
      });
    } catch (err) {
      res.status(500).json({ error: '获取用户活动统计失败: ' + err.message });
    }
  });

  return router;
};
