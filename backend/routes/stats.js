const express = require('express');

module.exports = function (getDb, { sendError }, auth) {
  const router = express.Router();

  // 获取用户分类限制
  function getCategoryRestriction(db, userId, role) {
    if (role === 'admin') return null;
    const user = db.prepare('SELECT restriction_mode FROM users WHERE id = ?').get(userId);
    const mode = user?.restriction_mode || 'allow';
    const categories = db.prepare('SELECT category FROM user_category_restrictions WHERE user_id = ?')
      .all(userId).map(r => r.category);
    if (categories.length === 0) return null;
    return { mode, categories };
  }

  // 应用分类限制到 WHERE 子句
  function applyCategoryRestriction(where, params, restriction) {
    if (!restriction) return where;
    const placeholders = restriction.categories.map((_, i) => `@rcat${i}`).join(',');
    if (restriction.mode === 'block') {
      where += ` AND category NOT IN (${placeholders})`;
    } else {
      where += ` AND category IN (${placeholders})`;
    }
    restriction.categories.forEach((c, i) => { params[`rcat${i}`] = c; });
    return where;
  }

  // GET /api/stats (所有登录用户可访问，普通用户受分类限制)
  router.get('/', auth.authRequired, (req, res) => {
    try {
      const db = getDb();
      const days = Math.max(7, Math.min(365, parseInt(req.query.days) || 30));

      // 获取用户分类限制
      const restriction = req.user ? getCategoryRestriction(db, req.user.id, req.user.role) : null;

      // 构建基础 WHERE 子句
      let whereTotal = 'WHERE deleted_at IS NULL';
      let whereTrash = 'WHERE deleted_at IS NOT NULL';
      const paramsTotal = {};
      const paramsTrash = {};

      // 应用分类限制
      whereTotal = applyCategoryRestriction(whereTotal, paramsTotal, restriction);
      whereTrash = applyCategoryRestriction(whereTrash, paramsTrash, restriction);

      const total = db.prepare(`SELECT COUNT(*) as cnt FROM data_questions ${whereTotal}`).get(paramsTotal).cnt;
      const trashCount = db.prepare(`SELECT COUNT(*) as cnt FROM data_questions ${whereTrash}`).get(paramsTrash).cnt;

      const byType = db.prepare(`SELECT type, COUNT(*) as cnt FROM data_questions ${whereTotal} GROUP BY type`).all(paramsTotal);
      const byCategory = db.prepare(`SELECT COALESCE(category, '默认') as category, COUNT(*) as cnt FROM data_questions ${whereTotal} GROUP BY category ORDER BY cnt DESC, category ASC`).all(paramsTotal);

      const dailyTrend = db.prepare(`
        SELECT date(created_at) as date, COUNT(*) as cnt
        FROM data_questions ${whereTotal}
        GROUP BY date(created_at)
        ORDER BY date DESC LIMIT @limit
      `).all({ ...paramsTotal, limit: days }).reverse();

      res.json({ total, trashCount, byType, byCategory, dailyTrend });
    } catch (err) { sendError(res, err, 'GET /api/stats'); }
  });

  // GET /api/stats/admin (仅管理员) —— 用户维度统计
  router.get('/admin', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const days = Math.max(7, Math.min(365, parseInt(req.query.days) || 30));

      const users = {
        total: db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt,
        admins: db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get().cnt,
        active: db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1').get().cnt,
        locked: db.prepare("SELECT COUNT(*) as cnt FROM users WHERE locked_until IS NOT NULL AND locked_until > datetime('now')").get().cnt,
        active7d: db.prepare("SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= datetime('now', '-7 day')").get().cnt,
        newThisWeek: db.prepare("SELECT COUNT(*) as cnt FROM users WHERE created_at >= datetime('now', '-7 day')").get().cnt,
      };

      // 每日活跃用户数（去重）与操作次数
      const activityTrend = db.prepare(`
        SELECT date(created_at) as date,
               COUNT(*) as actions,
               COUNT(DISTINCT user_id) as users
        FROM user_activity_logs
        WHERE created_at >= date('now', @daysAgo)
        GROUP BY date(created_at)
        ORDER BY date ASC
      `).all({ daysAgo: `-${days} day` });

      // 活跃排行：有操作记录的用户按次数排序，无记录的以 0 参与
      const ranking = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.role, u.is_active, u.last_login_at,
               COUNT(l.id) as actions
        FROM users u
        LEFT JOIN user_activity_logs l
          ON l.user_id = u.id AND l.created_at >= date('now', ?)
        GROUP BY u.id
        ORDER BY actions DESC, u.id ASC
        LIMIT 10
      `).all(`-${days} day`);

      // 刷题正确率：detail 为 JSON 字符串，用 json_extract 取值
      let accuracyRanking = [];
      try {
        accuracyRanking = db.prepare(`
          SELECT u.id, u.username, u.display_name,
                 SUM(CAST(json_extract(l.detail, '$.total') AS INTEGER)) as total,
                 SUM(CAST(json_extract(l.detail, '$.correct') AS INTEGER)) as correct,
                 COUNT(l.id) as rounds
          FROM user_activity_logs l
          JOIN users u ON u.id = l.user_id
          WHERE l.action = 'quiz_end'
            AND json_extract(l.detail, '$.total') > 0
            AND l.created_at >= date('now', ?)
          GROUP BY u.id
          HAVING total > 0
          ORDER BY (CAST(correct AS REAL) / total) DESC, total DESC
          LIMIT 10
        `).all(`-${days} day`).map(r => ({
          ...r,
          accuracy: Math.round((r.correct / r.total) * 1000) / 10,
        }));
      } catch {}

      res.json({ users, activityTrend, ranking, accuracyRanking });
    } catch (err) { sendError(res, err, 'GET /api/stats/admin'); }
  });

  return router;
};
