const express = require('express');
const { validateCategoryName } = require('../validate');

module.exports = function (getDb, { sendError, localNow }) {
  const router = express.Router();

  // GET /api/categories
  router.get('/', (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT c.id, c.name, c.score, c.created_at,
          COALESCE(q.cnt, 0) as question_count
        FROM data_categories c
        LEFT JOIN (
          SELECT category, COUNT(*) as cnt
          FROM data_questions WHERE deleted_at IS NULL
          GROUP BY category
        ) q ON q.category = c.name
        ORDER BY c.id ASC
      `).all();
      res.json(rows);
    } catch (err) { sendError(res, err, 'GET /api/categories'); }
  });

  // POST /api/categories
  router.post('/', (req, res) => {
    try {
      const db = getDb();
      const { name, score } = req.body;
      const errors = validateCategoryName(name);
      if (errors.length > 0) return res.status(400).json({ error: errors[0] });

      const trimmed = name.trim();
      const existing = db.prepare("SELECT id FROM data_categories WHERE name = ?").get(trimmed);
      if (existing) return res.status(400).json({ error: '分类已存在' });
      const now = localNow();
      const catScore = (score !== undefined && score !== null && score !== '') ? Math.floor(Number(score)) : null;
      const result = db.prepare("INSERT INTO data_categories (name, score, created_at) VALUES (?, ?, ?)").run(trimmed, catScore >= 0 ? catScore : null, now);
      res.json({ id: result.lastInsertRowid, message: '添加成功' });
    } catch (err) { sendError(res, err, 'POST /api/categories'); }
  });

  // PUT /api/categories/:id
  router.put('/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的分类 ID' });

      const { name, score } = req.body;
      const trimmed = name ? name.trim() : null;
      const hasScore = score !== undefined;
      const catScore = hasScore ? (score === '' || score === null ? null : Math.floor(Number(score))) : undefined;

      if (!trimmed && !hasScore) return res.status(400).json({ error: '请提供分类名称或分数' });

      const cat = db.prepare("SELECT * FROM data_categories WHERE id = ?").get(id);
      if (!cat) return res.status(404).json({ error: '分类不存在' });

      if (trimmed) {
        const errors = validateCategoryName(name);
        if (errors.length > 0) return res.status(400).json({ error: errors[0] });
        const dup = db.prepare("SELECT id FROM data_categories WHERE name = ? AND id != ?").get(trimmed, id);
        if (dup) return res.status(400).json({ error: '分类名已存在' });
      }

      const updateCategory = db.transaction(() => {
        if (trimmed) {
          db.prepare("UPDATE data_questions SET category = ? WHERE category = ? AND deleted_at IS NULL").run(trimmed, cat.name);
          db.prepare("UPDATE data_categories SET name = ? WHERE id = ?").run(trimmed, id);
        }
        if (hasScore) {
          db.prepare("UPDATE data_categories SET score = ? WHERE id = ?").run(catScore !== null && catScore >= 0 ? catScore : null, id);
        }
      });
      updateCategory();
      res.json({ message: '更新成功' });
    } catch (err) { sendError(res, err, 'PUT /api/categories/:id'); }
  });

  // DELETE /api/categories/:id
  router.delete('/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的分类 ID' });

      const cat = db.prepare("SELECT * FROM data_categories WHERE id = ?").get(id);
      if (!cat) return res.status(404).json({ error: '分类不存在' });
      db.prepare("UPDATE data_questions SET category = '默认' WHERE category = ? AND deleted_at IS NULL").run(cat.name);
      db.prepare("DELETE FROM data_categories WHERE id = ?").run(id);
      const def = db.prepare("SELECT id FROM data_categories WHERE name = '默认'").get();
      if (!def) {
        db.prepare("INSERT INTO data_categories (name, created_at) VALUES ('默认', ?)").run(localNow());
      }
      res.json({ message: '删除成功' });
    } catch (err) { sendError(res, err, 'DELETE /api/categories/:id'); }
  });

  return router;
};
