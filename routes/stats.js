const express = require('express');

module.exports = function (getDb, { sendError }) {
  const router = express.Router();

  // GET /api/stats
  router.get('/', (req, res) => {
    try {
      const db = getDb();
      const days = Math.max(7, Math.min(365, parseInt(req.query.days) || 30));
      const total = db.prepare('SELECT COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NULL').get().cnt;
      const trashCount = db.prepare('SELECT COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NOT NULL').get().cnt;
      const byType = db.prepare('SELECT type, COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NULL GROUP BY type').all();
      const byCategory = db.prepare("SELECT COALESCE(category, '默认') as category, COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NULL GROUP BY category").all();
      const dailyTrend = db.prepare(`
        SELECT date(created_at) as date, COUNT(*) as cnt
        FROM data_questions WHERE deleted_at IS NULL
        GROUP BY date(created_at)
        ORDER BY date DESC LIMIT ?
      `).all(days).reverse();
      res.json({ total, trashCount, byType, byCategory, dailyTrend });
    } catch (err) { sendError(res, err, 'GET /api/stats'); }
  });

  return router;
};
