const express = require('express');

module.exports = function (getDb, { safeParse, sendError, localNow }) {
  const router = express.Router();

  // GET /api/trash
  router.get('/', (req, res) => {
    try {
      const db = getDb();
      const { search, type, category, sort = 'desc', page = 1, pageSize = 20 } = req.query;
      const p = Math.max(1, parseInt(page));
      const ps = Math.min(200, Math.max(1, parseInt(pageSize) || 20));
      const offset = (p - 1) * ps;

      let where = 'WHERE deleted_at IS NOT NULL';
      const params = {};

      if (type && type !== '全部') { where += ' AND type = @type'; params.type = type; }
      if (category && category !== '全部') { where += ' AND category = @category'; params.category = category; }
      if (search) { where += ' AND content LIKE @search'; params.search = `%${search}%`; }

      const order = sort === 'asc' ? 'ASC' : 'DESC';
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM data_questions ${where}`).get(params);
      const rows = db.prepare(`SELECT * FROM data_questions ${where} ORDER BY deleted_at ${order} LIMIT @limit OFFSET @offset`).all({ ...params, limit: ps, offset });

      const items = rows.map(row => ({
        ...row,
        options: row.options ? safeParse(row.options) : null,
        answers: row.answers ? safeParse(row.answers) : null,
      }));
      res.json({ items, total: countRow.total, page: p, pageSize: ps, totalPages: Math.ceil(countRow.total / ps) });
    } catch (err) { sendError(res, err, 'GET /api/trash'); }
  });

  // GET /api/trash/count
  router.get('/count', (req, res) => {
    try {
      const db = getDb();
      const row = db.prepare('SELECT COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NOT NULL').get();
      res.json({ count: row.cnt });
    } catch (err) { sendError(res, err, 'GET /api/trash/count'); }
  });

  // POST /api/trash/:id/restore
  router.post('/:id/restore', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的题目 ID' });
      const { force = false } = req.body || {};

      const restoreSingle = db.transaction(() => {
        const item = db.prepare('SELECT id, type, content FROM data_questions WHERE id = ? AND deleted_at IS NOT NULL').get(id);
        if (!item) return { notFound: true };

        if (!force) {
          const dup = db.prepare('SELECT id FROM data_questions WHERE type = ? AND content = ? AND deleted_at IS NULL').get(item.type, item.content);
          if (dup) return { conflict: true, message: '正常列表中已存在相同题目', duplicateId: dup.id };
        }

        db.prepare('UPDATE data_questions SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL').run(id);
        return { message: '已恢复' };
      });

      const result = restoreSingle();
      if (result.notFound) return res.status(404).json({ error: '题目不在回收站中' });
      if (result.conflict) return res.status(409).json({ error: 'duplicate', message: result.message, duplicateId: result.duplicateId });
      res.json(result);
    } catch (err) { sendError(res, err, 'POST /api/trash/:id/restore'); }
  });

  // POST /api/trash/batch-restore
  router.post('/batch-restore', (req, res) => {
    try {
      const db = getDb();
      const { ids, force = false } = req.body;
      if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ error: '请选择要恢复的题目' });

      const batchRestore = db.transaction(() => {
        let restored = 0, skipped = 0;
        const checkDup = db.prepare('SELECT id FROM data_questions WHERE type = ? AND content = ? AND deleted_at IS NULL');

        if (force) {
          // SAFETY: placeholders from array length, not user input. Values bound via parameterized query.
          const placeholders = ids.map(() => '?').join(',');
          const result = db.prepare(`UPDATE data_questions SET deleted_at = NULL WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`).run(...ids);
          restored = result.changes;
        } else {
          for (const id of ids) {
            const item = db.prepare('SELECT id, type, content FROM data_questions WHERE id = ? AND deleted_at IS NOT NULL').get(id);
            if (!item) { skipped++; continue; }
            const dup = checkDup.get(item.type, item.content);
            if (dup) { skipped++; continue; }
            db.prepare('UPDATE data_questions SET deleted_at = NULL WHERE id = ?').run(id);
            restored++;
          }
        }

        return { restored, skipped };
      });

      const { restored, skipped } = batchRestore();
      const msg = force
        ? `已恢复 ${restored} 道题目`
        : `已恢复 ${restored} 道题目${skipped > 0 ? `，跳过 ${skipped} 条（重复或不存在）` : ''}`;
      res.json({ message: msg, restored, skipped });
    } catch (err) { sendError(res, err, 'POST /api/trash/batch-restore'); }
  });

  // DELETE /api/trash/:id (permanent)
  router.delete('/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的题目 ID' });
      const result = db.prepare('DELETE FROM data_questions WHERE id = ? AND deleted_at IS NOT NULL').run(id);
      if (result.changes === 0) return res.status(404).json({ error: '题目不在回收站中' });
      res.json({ message: '已永久删除' });
    } catch (err) { sendError(res, err, 'DELETE /api/trash/:id'); }
  });

  // POST /api/trash/batch-delete
  router.post('/batch-delete', (req, res) => {
    try {
      const db = getDb();
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ error: '请选择要删除的题目' });
      // SAFETY: placeholders from array length, not user input. Values bound via parameterized query.
      const placeholders = ids.map(() => '?').join(',');
      const result = db.prepare(`DELETE FROM data_questions WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`).run(...ids);
      res.json({ message: `已永久删除 ${result.changes} 道题目`, deleted: result.changes });
    } catch (err) { sendError(res, err, 'POST /api/trash/batch-delete'); }
  });

  // POST /api/trash/empty
  router.post('/empty', (req, res) => {
    try {
      const db = getDb();
      const count = db.prepare('SELECT COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NOT NULL').get().cnt;
      if (count === 0) return res.json({ message: '回收站为空', deleted: 0 });
      const result = db.prepare('DELETE FROM data_questions WHERE deleted_at IS NOT NULL').run();
      res.json({ message: `已永久删除 ${result.changes} 道题目`, deleted: result.changes });
    } catch (err) { sendError(res, err, 'POST /api/trash/empty'); }
  });

  return router;
};
