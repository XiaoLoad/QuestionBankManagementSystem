const express = require('express');

module.exports = function (getDb, { safeParse, sendError }) {
  const router = express.Router();

  // GET /api/quiz/questions — 获取刷题题目列表（不含答案）
  router.get('/questions', (req, res) => {
    try {
      const db = getDb();
      const { category, type, mode = 'sequential', limit = 50 } = req.query;
      const lim = Math.min(200, Math.max(1, parseInt(limit) || 50));

      let where = 'WHERE deleted_at IS NULL';
      const params = {};
      if (category && category !== '全部') { where += ' AND category = @category'; params.category = category; }
      if (type && type !== '全部') { where += ' AND type = @type'; params.type = type; }

      const order = mode === 'random' ? 'RANDOM()' : 'id ASC';
      const rows = db.prepare(`SELECT id, type, content, options, category, images FROM data_questions ${where} ORDER BY ${order} LIMIT @limit`).all({ ...params, limit: lim });

      const items = rows.map(row => ({
        id: row.id,
        type: row.type,
        content: row.content,
        category: row.category,
        options: row.options ? safeParse(row.options) : null,
        images: row.images ? safeParse(row.images) : [],
      }));

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

      const correctAnswers = row.answers ? safeParse(row.answers) : [];
      const options = row.options ? safeParse(row.options) : [];

      // 用户未作答
      if (answer === undefined || answer === null || (Array.isArray(answer) && answer.length === 0) || answer === '') {
        return res.json({ correct: false, correctAnswers, userAnswer: answer });
      }

      const userAns = Array.isArray(answer) ? answer.map(s => String(s).trim()) : [String(answer).trim()];
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

  return router;
};
