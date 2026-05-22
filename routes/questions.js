const express = require('express');
const { validateQuestion } = require('../validate');

module.exports = function (getDb, { md5, safeParse, sendError, localNow }) {
  const router = express.Router();

  // GET /api/questions
  router.get('/', (req, res) => {
    try {
      const db = getDb();
      const { type, search, category, sort = 'desc', dateFrom, dateTo, page = 1, pageSize = 20 } = req.query;
      const p = Math.max(1, parseInt(page));
      const ps = Math.min(200, Math.max(1, parseInt(pageSize) || 20));
      const offset = (p - 1) * ps;

      let where = 'WHERE deleted_at IS NULL';
      const params = {};

      if (type && type !== '全部') { where += ' AND type = @type'; params.type = type; }
      if (category && category !== '全部') { where += ' AND category = @category'; params.category = category; }
      if (search) { where += ' AND content LIKE @search'; params.search = `%${search}%`; }
      if (dateFrom) { where += ' AND created_at >= @dateFrom'; params.dateFrom = dateFrom; }
      if (dateTo) { where += ' AND created_at <= @dateTo'; params.dateTo = dateTo + ' 23:59:59'; }

      const order = sort === 'asc' ? 'ASC' : 'DESC';
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM data_questions ${where}`).get(params);
      const rows = db.prepare(`SELECT * FROM data_questions ${where} ORDER BY created_at ${order} LIMIT @limit OFFSET @offset`).all({ ...params, limit: ps, offset });

      const items = rows.map(row => ({
        ...row,
        options: row.options ? safeParse(row.options) : null,
        answers: row.answers ? safeParse(row.answers) : null,
      }));
      res.json({ items, total: countRow.total, page: p, pageSize: ps, totalPages: Math.ceil(countRow.total / ps) });
    } catch (err) { sendError(res, err, 'GET /api/questions'); }
  });

  // GET /api/questions/:id
  router.get('/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的题目 ID' });
      const row = db.prepare('SELECT * FROM data_questions WHERE id = ? AND deleted_at IS NULL').get(id);
      if (!row) return res.status(404).json({ error: '题目不存在' });
      row.options = row.options ? safeParse(row.options) : null;
      row.answers = row.answers ? safeParse(row.answers) : null;
      res.json(row);
    } catch (err) { sendError(res, err, 'GET /api/questions/:id'); }
  });

  // POST /api/questions
  router.post('/', (req, res) => {
    try {
      const db = getDb();
      const { type, content, options, answers, right_status = 0, category = '默认', force = false } = req.body;

      const errors = validateQuestion(req.body);
      if (errors.length > 0) return res.status(400).json({ error: errors[0] });

      const insertQuestion = db.transaction(() => {
        if (!force) {
          const dup = db.prepare('SELECT id, type, content, deleted_at FROM data_questions WHERE type = ? AND content = ?').get(type, content);
          if (dup) {
            const inTrash = dup.deleted_at !== null;
            return { conflict: true, message: inTrash ? '该题目已在回收站中' : '该题目已存在', duplicateId: dup.id, inTrash };
          }
        }

        const now = localNow();
        const hash = md5(`${type}-${content.trim()}`);
        const result = db.prepare(
          `INSERT INTO data_questions (created_at, updated_at, md5, type, content, options, answers, right_status, category)
           VALUES (@created_at, @updated_at, @md5, @type, @content, @options, @answers, @right_status, @category)`
        ).run({
          created_at: now, updated_at: now, md5: hash, type, content: content.trim(),
          options: options ? Buffer.from(JSON.stringify(options)) : null,
          answers: answers ? Buffer.from(JSON.stringify(answers)) : null,
          right_status, category,
        });
        return { id: result.lastInsertRowid, message: '添加成功' };
      });

      const result = insertQuestion();
      if (result.conflict) {
        return res.status(409).json({ error: 'duplicate', message: result.message, duplicateId: result.duplicateId, inTrash: result.inTrash });
      }
      res.json(result);
    } catch (err) { sendError(res, err, 'POST /api/questions'); }
  });

  // PUT /api/questions/batch-category
  router.put('/batch-category', (req, res) => {
    try {
      const db = getDb();
      const { ids, category } = req.body;
      if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ error: '请选择题目' });
      if (!category || typeof category !== 'string') return res.status(400).json({ error: '请选择分类' });
      // SAFETY: placeholders from array length, not user input. Values bound via parameterized query.
      const placeholders = ids.map(() => '?').join(',');
      const result = db.prepare(`UPDATE data_questions SET category = ?, updated_at = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`).run(category, localNow(), ...ids);
      res.json({ message: `已将 ${result.changes} 道题目的分类修改为「${category}」`, updated: result.changes });
    } catch (err) { sendError(res, err, 'PUT /api/questions/batch-category'); }
  });

  // PUT /api/questions/:id
  router.put('/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的题目 ID' });

      const { type, content, options, answers, right_status, category, force = false } = req.body;
      const existing = db.prepare('SELECT * FROM data_questions WHERE id = ? AND deleted_at IS NULL').get(id);
      if (!existing) return res.status(404).json({ error: '题目不存在' });

      const newType = type || existing.type;
      const newContent = content ? content.trim() : existing.content;

      if (type && !['单选题', '多选题', '判断题', '填空题', '简答题'].includes(type)) {
        return res.status(400).json({ error: '无效的题型' });
      }
      if (content && newContent.length > 10000) {
        return res.status(400).json({ error: '题目内容过长' });
      }

      const updateQuestion = db.transaction(() => {
        if (!force && (content || type)) {
          const dup = db.prepare('SELECT id, deleted_at FROM data_questions WHERE type = ? AND content = ? AND id != ?').get(newType, newContent, id);
          if (dup) {
            const inTrash = dup.deleted_at !== null;
            return { conflict: true, message: inTrash ? '该题目已在回收站中' : '该题目已存在', duplicateId: dup.id, inTrash };
          }
        }

        const now = localNow();
        db.prepare(
          `UPDATE data_questions SET updated_at=@updated_at, md5=@md5, type=@type, content=@content,
           options=@options, answers=@answers, right_status=@right_status, category=@category WHERE id=@id`
        ).run({
          id, updated_at: now,
          md5: (content || type) ? md5(`${newType}-${newContent}`) : existing.md5,
          type: newType, content: newContent,
          options: options !== undefined ? (options ? Buffer.from(JSON.stringify(options)) : null) : existing.options,
          answers: answers !== undefined ? (answers ? Buffer.from(JSON.stringify(answers)) : null) : existing.answers,
          right_status: right_status !== undefined ? right_status : existing.right_status,
          category: category !== undefined ? category : (existing.category || '默认'),
        });
        return { message: '更新成功' };
      });

      const result = updateQuestion();
      if (result.conflict) {
        return res.status(409).json({ error: 'duplicate', message: result.message, duplicateId: result.duplicateId, inTrash: result.inTrash });
      }
      res.json(result);
    } catch (err) { sendError(res, err, 'PUT /api/questions/:id'); }
  });

  // DELETE /api/questions/:id (soft delete)
  router.delete('/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的题目 ID' });
      const now = localNow();
      const result = db.prepare('UPDATE data_questions SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, id);
      if (result.changes === 0) return res.status(404).json({ error: '题目不存在' });
      res.json({ message: '已移至回收站' });
    } catch (err) { sendError(res, err, 'DELETE /api/questions/:id'); }
  });

  // POST /api/questions/batch-delete
  router.post('/batch-delete', (req, res) => {
    try {
      const db = getDb();
      const { ids, before, after, type, category } = req.body;
      const now = localNow();

      if (ids && Array.isArray(ids) && ids.length > 0) {
        // SAFETY: placeholders from array length, not user input. Values bound via parameterized query.
        const placeholders = ids.map(() => '?').join(',');
        const result = db.prepare(`UPDATE data_questions SET deleted_at = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`).run(now, ...ids);
        return res.json({ message: `已将 ${result.changes} 道题目移至回收站`, deleted: result.changes });
      }

      if (!before && !after && !type && !category) return res.status(400).json({ error: '请至少指定一个删除条件' });

      let where = 'WHERE deleted_at IS NULL';
      const params = {};
      if (before) { where += ' AND created_at < @before'; params.before = before; }
      if (after) { where += ' AND created_at > @after'; params.after = after + ' 23:59:59'; }
      if (type && type !== '全部') { where += ' AND type = @type'; params.type = type; }
      if (category && category !== '全部') { where += ' AND category = @category'; params.category = category; }

      const count = db.prepare(`SELECT COUNT(*) as cnt FROM data_questions ${where}`).get(params).cnt;
      if (count === 0) return res.json({ message: '没有符合条件的题目', deleted: 0 });

      const result = db.prepare(`UPDATE data_questions SET deleted_at = @__deleted_at ${where}`).run({ ...params, __deleted_at: now });
      res.json({ message: `已将 ${result.changes} 道题目移至回收站`, deleted: result.changes });
    } catch (err) { sendError(res, err, 'POST /api/questions/batch-delete'); }
  });

  return router;
};
