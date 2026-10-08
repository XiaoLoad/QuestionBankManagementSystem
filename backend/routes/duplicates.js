const express = require('express');

module.exports = function (getDb, { safeParse, sendError, localNow }) {
  const router = express.Router();

  // GET /api/duplicates — scan for duplicate question groups
  router.get('/', (req, res) => {
    try {
      const db = getDb();
      const minGroup = Math.max(2, parseInt(req.query.minGroup) || 2);
      const groups = db.prepare(`
        SELECT type, TRIM(content) as content, COUNT(*) as cnt
        FROM data_questions WHERE deleted_at IS NULL
        GROUP BY type, TRIM(content) HAVING COUNT(*) >= ?
        ORDER BY cnt DESC, type ASC
      `).all(minGroup);

      if (groups.length === 0) return res.json({ groups: [], totalDuplicates: 0 });

      const fetchGroup = db.prepare(`
        SELECT id, type, content, options, answers, category, created_at, updated_at, md5
        FROM data_questions WHERE deleted_at IS NULL AND type = ? AND TRIM(content) = ?
        ORDER BY created_at DESC
      `);

      const result = [];
      let totalDuplicates = 0;
      for (const g of groups) {
        const items = fetchGroup.all(g.type, g.content).map(row => ({
          ...row, options: row.options ? safeParse(row.options) : null,
          answers: row.answers ? safeParse(row.answers) : null,
        }));
        result.push({ type: g.type, content: g.content, count: g.cnt, items });
        totalDuplicates += g.cnt - 1;
      }
      res.json({ groups: result, totalGroups: result.length, totalDuplicates });
    } catch (err) { sendError(res, err, 'GET /api/duplicates'); }
  });

  // POST /api/duplicates/resolve — keep specified IDs, move rest to trash
  router.post('/resolve', (req, res) => {
    try {
      const db = getDb();
      const { groups } = req.body;
      if (!groups || !Array.isArray(groups)) return res.status(400).json({ error: '请指定 groups 参数' });

      const now = localNow();
      let trashed = 0;
      const resolveTransaction = db.transaction(() => {
        for (const g of groups) {
          if (!g.type || !g.content || !g.keepId) continue;
          const result = db.prepare(`
            UPDATE data_questions SET deleted_at = ?
            WHERE type = ? AND TRIM(content) = ? AND deleted_at IS NULL AND id != ?
          `).run(now, g.type, g.content.trim(), g.keepId);
          trashed += result.changes;
        }
      });
      resolveTransaction();
      res.json({ message: `已将 ${trashed} 条重复题目移至回收站`, trashed });
    } catch (err) { sendError(res, err, 'POST /api/duplicates/resolve'); }
  });

  return router;
};
