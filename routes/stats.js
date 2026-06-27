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
      const byCategory = db.prepare(`SELECT COALESCE(category, '默认') as category, COUNT(*) as cnt FROM data_questions ${whereTotal} GROUP BY category`).all(paramsTotal);

      const dailyTrend = db.prepare(`
        SELECT date(created_at) as date, COUNT(*) as cnt
        FROM data_questions ${whereTotal}
        GROUP BY date(created_at)
        ORDER BY date DESC LIMIT @limit
      `).all({ ...paramsTotal, limit: days }).reverse();

      res.json({ total, trashCount, byType, byCategory, dailyTrend });
    } catch (err) { sendError(res, err, 'GET /api/stats'); }
  });

  return router;
};
