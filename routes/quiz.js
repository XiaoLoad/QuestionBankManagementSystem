const express = require('express');

module.exports = function (getDb, { safeParse, sendError, localNow }, auth) {
  const router = express.Router();

  // 去除选项前缀: "A.教育职能" → "教育职能", "A.A.教育职能" → "教育职能"
  function stripOptionPrefix(val) {
    if (!val) return val
    if (Array.isArray(val)) {
      return val.map(v => String(v).replace(/^[A-Za-z][.\s、·:：]+/, '').trim())
    }
    return String(val).replace(/^[A-Za-z][.\s、·:：]+/, '').trim()
  }

  // GET /api/quiz/type-counts — 获取各分类下各题型的数量
  router.get('/type-counts', (req, res) => {
    try {
      const db = getDb();
      const { category } = req.query;

      let where = 'WHERE deleted_at IS NULL';
      const params = {};
      if (category && category !== '全部') {
        const categories = String(category).split(',').filter(Boolean);
        if (categories.length === 1) {
          where += ' AND category = @category'; params.category = categories[0];
        } else if (categories.length > 1) {
          const placeholders = categories.map((_, i) => `@cat${i}`).join(',');
          where += ` AND category IN (${placeholders})`;
          categories.forEach((c, i) => { params[`cat${i}`] = c; });
        }
      }

      const total = db.prepare(`SELECT COUNT(*) as cnt FROM data_questions ${where}`).get(params).cnt;
      const rows = db.prepare(`SELECT type, COUNT(*) as cnt FROM data_questions ${where} GROUP BY type`).all(params);

      const byType = {};
      for (const row of rows) {
        byType[row.type] = row.cnt;
      }

      res.json({ total, byType });
    } catch (err) { sendError(res, err, 'GET /api/quiz/type-counts'); }
  });

  // GET /api/quiz/questions — 获取刷题题目列表（不含答案）
  router.get('/questions', (req, res) => {
    try {
      const db = getDb();
      const { category, type, mode = 'sequential', limit = 50 } = req.query;
      const lim = Math.min(300, Math.max(1, parseInt(limit) || 50));

      let where = 'WHERE deleted_at IS NULL';
      const params = {};
      if (category && category !== '全部') {
        const categories = String(category).split(',').filter(Boolean);
        if (categories.length === 1) {
          where += ' AND category = @category'; params.category = categories[0];
        } else if (categories.length > 1) {
          const placeholders = categories.map((_, i) => `@cat${i}`).join(',');
          where += ` AND category IN (${placeholders})`;
          categories.forEach((c, i) => { params[`cat${i}`] = c; });
        }
      }
      if (type) {
        const types = String(type).split(',').filter(Boolean);
        if (types.length === 1) {
          where += ' AND type = @type'; params.type = types[0];
        } else if (types.length > 1) {
          const placeholders = types.map((_, i) => `@type${i}`).join(',');
          where += ` AND type IN (${placeholders})`;
          types.forEach((t, i) => { params[`type${i}`] = t; });
        }
      }

      const order = mode === 'random' ? 'RANDOM()' : 'id ASC';
      const rows = db.prepare(`SELECT id, type, content, options, category, images FROM data_questions ${where} ORDER BY ${order} LIMIT @limit`).all({ ...params, limit: lim });

      const items = rows.map(row => ({
        id: row.id,
        type: row.type,
        content: row.content,
        category: row.category,
        options: row.options ? stripOptionPrefix(safeParse(row.options)) : null,
        images: row.images ? safeParse(row.images) : [],
      }));

      // 记录刷题开始日志
      if (req.user && items.length > 0) {
        try {
          const types = [...new Set(items.map(i => i.type))];
          const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
          db.prepare('INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)')
            .run(req.user.id, 'quiz_start', JSON.stringify({
              category: category || '全部',
              types: types,
              categories: cats,
              count: items.length,
            }), localNow());
        } catch {}
      }

      res.json({ items, total: items.length });
    } catch (err) { sendError(res, err, 'GET /api/quiz/questions'); }
  });

  // POST /api/quiz/check — 校验答案
  router.post('/check', (req, res) => {
    try {
      const db = getDb();
      const { id, answer } = req.body;
      if (!id) return res.status(400).json({ error: '缺少题目 ID' });

      const row = db.prepare('SELECT id, type, options, answers FROM data_questions WHERE id = ? AND deleted_at IS NULL').get(id);
      if (!row) return res.status(404).json({ error: '题目不存在' });

      const correctAnswers = row.answers ? stripOptionPrefix(safeParse(row.answers)) : [];
      const options = row.options ? stripOptionPrefix(safeParse(row.options)) : [];

      // 用户未作答
      if (answer === undefined || answer === null || (Array.isArray(answer) && answer.length === 0) || answer === '') {
        return res.json({ correct: false, correctAnswers, userAnswer: answer });
      }

      const userAns = Array.isArray(answer) ? answer.map(s => stripOptionPrefix(String(s).trim())) : [stripOptionPrefix(String(answer).trim())];
      const correctAns = correctAnswers.map(s => String(s).trim());

      let correct = false;

      if (row.type === '判断题') {
        // 判断题：匹配 "对"/"错" 或 "正确"/"错误"
        const normalizeBool = s => {
          const t = s.trim();
          if (t === '对' || t === '正确' || t === 'true' || t === '√') return '对';
          if (t === '错' || t === '错误' || t === 'false' || t === '×') return '错';
          return t;
        };
        correct = normalizeBool(userAns[0]) === normalizeBool(correctAns[0]);
      } else if (['单选题', '判断题'].includes(row.type)) {
        correct = userAns[0] === correctAns[0];
      } else if (row.type === '多选题') {
        const u = [...userAns].sort();
        const c = [...correctAns].sort();
        correct = u.length === c.length && u.every((v, i) => v === c[i]);
      } else {
        // 填空题 / 简答题：模糊匹配（忽略首尾空格）
        correct = userAns[0].trim() === correctAns[0].trim();
      }

      res.json({ correct, correctAnswers, userAnswer: answer });
    } catch (err) { sendError(res, err, 'POST /api/quiz/check'); }
  });

  // POST /api/quiz/result — 记录刷题结果
  router.post('/result', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '未登录' });

      const db = getDb();
      const { total, correct, accuracy, category, wrongCount } = req.body;

      db.prepare('INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)')
        .run(req.user.id, 'quiz_end', JSON.stringify({
          total: total || 0,
          correct: correct || 0,
          accuracy: accuracy || 0,
          wrongCount: wrongCount || 0,
          category: category || '全部',
        }), localNow());

      res.json({ message: '刷题结果已记录' });
    } catch (err) { sendError(res, err, 'POST /api/quiz/result'); }
  });

  return router;
};
