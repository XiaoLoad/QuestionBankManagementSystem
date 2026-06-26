const express = require('express');
const { validateCategoryName } = require('../validate');

module.exports = function (getDb, { sendError, localNow }, auth) {
  const router = express.Router();

  // GET /api/categories (所有登录用户可访问，非管理员按限制过滤)
  router.get('/', (req, res) => {
    try {
      const db = getDb();

      let rows = db.prepare(`
        SELECT c.id, c.name, c.score, c.notes, c.created_at,
          COALESCE(q.cnt, 0) as question_count
        FROM data_categories c
        LEFT JOIN (
          SELECT category, COUNT(*) as cnt
          FROM data_questions WHERE deleted_at IS NULL
          GROUP BY category
        ) q ON q.category = c.name
        ORDER BY CASE WHEN c.name = '默认' THEN 0 ELSE 1 END, c.id ASC
      `).all();

      // 非管理员：检查分类限制
      if (req.user && req.user.role !== 'admin') {
        const user = db.prepare('SELECT restriction_mode FROM users WHERE id = ?').get(req.user.id);
        const mode = user?.restriction_mode || 'allow';
        const restrictions = db.prepare('SELECT category FROM user_category_restrictions WHERE user_id = ?')
          .all(req.user.id).map(r => r.category);
        if (restrictions.length > 0) {
          if (mode === 'block') {
            rows = rows.filter(r => !restrictions.includes(r.name));
          } else {
            rows = rows.filter(r => restrictions.includes(r.name));
          }
        }
      }

      res.json(rows);
    } catch (err) { sendError(res, err, 'GET /api/categories'); }
  });

  // POST /api/categories (仅管理员)
  router.post('/', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const { name, score, notes } = req.body;
      const errors = validateCategoryName(name);
      if (errors.length > 0) return res.status(400).json({ error: errors[0] });

      const trimmed = name.trim();
      const existing = db.prepare("SELECT id FROM data_categories WHERE name = ?").get(trimmed);
      if (existing) return res.status(400).json({ error: '分类已存在' });
      const now = localNow();
      const catScore = (score !== undefined && score !== null && score !== '') ? Math.floor(Number(score)) : null;
      const catNotes = (notes !== undefined && notes !== null) ? String(notes).trim() || null : null;
      const result = db.prepare("INSERT INTO data_categories (name, score, notes, created_at) VALUES (?, ?, ?, ?)").run(trimmed, catScore >= 0 ? catScore : null, catNotes, now);
      res.json({ id: result.lastInsertRowid, message: '添加成功' });
    } catch (err) { sendError(res, err, 'POST /api/categories'); }
  });

  // PUT /api/categories/:id (仅管理员)
  router.put('/:id', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的分类 ID' });

      const { name, score, notes } = req.body;
      const trimmed = name ? name.trim() : null;
      const hasScore = score !== undefined;
      const hasNotes = notes !== undefined;
      const catScore = hasScore ? (score === '' || score === null ? null : Math.floor(Number(score))) : undefined;

      if (!trimmed && !hasScore && !hasNotes) return res.status(400).json({ error: '请提供分类名称、分数或备注' });

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
        if (hasNotes) {
          const catNotes = String(notes).trim() || null;
          db.prepare("UPDATE data_categories SET notes = ? WHERE id = ?").run(catNotes, id);
        }
      });
      updateCategory();
      res.json({ message: '更新成功' });
    } catch (err) { sendError(res, err, 'PUT /api/categories/:id'); }
  });

  // POST /api/categories/:id/move (仅管理员)
  router.post('/:id/move', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的分类 ID' });

      const { target } = req.body;
      if (!target || typeof target !== 'string' || !target.trim()) {
        return res.status(400).json({ error: '请选择或输入目标分类' });
      }
      const targetName = target.trim();
      if (targetName.length > 50) return res.status(400).json({ error: '分类名称过长' });

      const cat = db.prepare("SELECT * FROM data_categories WHERE id = ?").get(id);
      if (!cat) return res.status(404).json({ error: '分类不存在' });
      if (cat.name === targetName) return res.status(400).json({ error: '目标分类与当前分类相同' });

      const moveCategory = db.transaction(() => {
        // ensure target category exists
        let targetCat = db.prepare("SELECT id FROM data_categories WHERE name = ?").get(targetName);
        if (!targetCat) {
          db.prepare("INSERT INTO data_categories (name, created_at) VALUES (?, ?)").run(targetName, localNow());
        }
        const result = db.prepare("UPDATE data_questions SET category = ?, updated_at = ? WHERE category = ? AND deleted_at IS NULL").run(targetName, localNow(), cat.name);
        return result.changes;
      });
      const moved = moveCategory();
      res.json({ message: `已将 ${moved} 道题目移至「${targetName}」`, moved });
    } catch (err) { sendError(res, err, 'POST /api/categories/:id/move'); }
  });

  // DELETE /api/categories/:id (仅管理员)
  router.delete('/:id', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的分类 ID' });

      const { confirm } = req.body;
      const cat = db.prepare("SELECT * FROM data_categories WHERE id = ?").get(id);
      if (!cat) return res.status(404).json({ error: '分类不存在' });
      if (cat.name === '默认') return res.status(400).json({ error: '默认分类不能删除' });

      if (confirm !== cat.name) {
        return res.status(400).json({ error: 'confirm_required', message: `请输入分类名称「${cat.name}」以确认删除` });
      }

      const now = localNow();
      const delResult = db.prepare("UPDATE data_questions SET deleted_at = ? WHERE category = ? AND deleted_at IS NULL").run(now, cat.name);
      db.prepare("DELETE FROM data_categories WHERE id = ?").run(id);
      res.json({ message: `已删除分类「${cat.name}」并将 ${delResult.changes} 道题目移至回收站`, deleted: delResult.changes });
    } catch (err) { sendError(res, err, 'DELETE /api/categories/:id'); }
  });

  return router;
};
