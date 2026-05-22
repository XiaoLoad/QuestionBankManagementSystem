const express = require('express');
const path = require('path');
const fs = require('fs');
const { VALID_TYPES } = require('../validate');

module.exports = function (getDb, { md5, safeParse, sendError, localNow }) {
  const router = express.Router();

  // Strip option letter prefixes: "C.教育职能" → "教育职能"
  function stripAnswerPrefix(val) {
    if (!val) return val
    if (Array.isArray(val)) {
      return val.map(v => String(v).replace(/^[A-Za-z][.\s、·:：]+/, '').trim())
    }
    return String(val).replace(/^[A-Za-z][.\s、·:：]+/, '').trim()
  }

  // GET /api/backup — download database file
  router.get('/', (req, res) => {
    try {
      const dbPath = path.join(__dirname, '..', 'default.db');
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: '数据库文件不存在' });
      }
      const timestamp = localNow().replace(/[:.]/g, '-').substring(0, 19);
      res.setHeader('Content-Disposition', `attachment; filename="question-bank-backup-${timestamp}.db"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      const stream = fs.createReadStream(dbPath);
      stream.on('error', (err) => {
        console.error('[Error] Backup stream error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: '备份文件读取失败' });
      });
      stream.pipe(res);
    } catch (err) { sendError(res, err, 'GET /api/backup'); }
  });

  // POST /api/backup/export — export as JSON
  router.post('/export', (req, res) => {
    try {
      const db = getDb();
      const { type, category } = req.body || {};
      let where = 'WHERE deleted_at IS NULL';
      const params = {};
      if (type && type !== '全部') { where += ' AND type = @type'; params.type = type; }
      if (category && category !== '全部') { where += ' AND category = @category'; params.category = category; }
      const rows = db.prepare(`SELECT type, content, options, answers, category FROM data_questions ${where} ORDER BY created_at DESC`).all(params);
      const items = rows.map(r => ({
        type: r.type, content: r.content, category: r.category || '默认',
        options: r.options ? safeParse(r.options) : null,
        answers: r.answers ? safeParse(r.answers) : null,
      }));
      const timestamp = localNow().replace(/[:.]/g, '-').substring(0, 19);
      res.setHeader('Content-Disposition', `attachment; filename="questions-export-${timestamp}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(items, null, 2));
    } catch (err) { sendError(res, err, 'POST /api/backup/export'); }
  });

  // POST /api/backup/import/preview — analyze JSON and return categories with scores
  router.post('/import/preview', express.json({ limit: '50mb' }), (req, res) => {
    try {
      const db = getDb();
      const { questions } = req.body;
      if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: '没有可导入的数据' });

      const categorySet = new Set();
      for (const q of questions) {
        categorySet.add(q.category || '默认');
      }
      const importCategories = Array.from(categorySet);

      const existingCats = db.prepare("SELECT name, score FROM data_categories").all();
      const scoreMap = {};
      for (const c of existingCats) {
        scoreMap[c.name] = c.score;
      }

      const categories = importCategories.map(name => ({
        name,
        existing: name in scoreMap,
        currentScore: name in scoreMap ? scoreMap[name] : null,
      }));

      res.json({ categories, totalQuestions: questions.length });
    } catch (err) { sendError(res, err, 'POST /api/backup/import/preview'); }
  });

  // POST /api/backup/import — import from JSON
  router.post('/import', express.json({ limit: '50mb' }), (req, res) => {
    try {
      const db = getDb();
      const { questions, categoryScores } = req.body;
      if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: '没有可导入的数据' });

      const now = localNow();
      let imported = 0;
      const conflicts = [];
      const duplicates = [];
      const insertStmt = db.prepare(
        `INSERT INTO data_questions (created_at, updated_at, md5, type, content, options, answers, right_status, category)
         VALUES (@created_at, @updated_at, @md5, @type, @content, @options, @answers, 0, @category)`
      );
      const checkStmt = db.prepare('SELECT id, answers, category FROM data_questions WHERE type = ? AND content = ? AND deleted_at IS NULL');
      const catInsert = db.prepare("INSERT OR IGNORE INTO data_categories (name, created_at) VALUES (?, ?)");

      const insertMany = db.transaction((items) => {
        for (const q of items) {
          if (!q.type || !q.content) { continue; }
          if (!VALID_TYPES.includes(q.type)) { continue; }
          // Clean answer prefixes on import
          const cleanAnswers = stripAnswerPrefix(q.answers)
          const dup = checkStmt.get(q.type, q.content);
          if (dup) {
            const existingAnswers = dup.answers ? JSON.stringify(safeParse(dup.answers)) : 'null';
            const importedAnswers = JSON.stringify(cleanAnswers || null);
            if (existingAnswers === importedAnswers) {
              duplicates.push({
                type: q.type, content: q.content,
                options: q.options || null, answers: cleanAnswers || null,
                category: q.category || '默认', existingCategory: dup.category || '默认',
              });
            } else {
              conflicts.push({
                type: q.type, content: q.content,
                options: q.options || null,
                existingAnswers: dup.answers ? safeParse(dup.answers) : null,
                importedAnswers: cleanAnswers || null,
                existingCategory: dup.category || '默认',
                importedCategory: q.category || '默认',
              });
            }
            continue;
          }
          catInsert.run(q.category || '默认', now);
          insertStmt.run({
            created_at: now, updated_at: now,
            md5: md5(`${q.type}-${q.content}`),
            type: q.type, content: q.content,
            options: q.options ? Buffer.from(JSON.stringify(q.options)) : null,
            answers: cleanAnswers ? Buffer.from(JSON.stringify(cleanAnswers)) : null,
            category: q.category || '默认',
          });
          imported++;
        }
      });
      insertMany(questions);

      // Apply category scores
      if (categoryScores && typeof categoryScores === 'object') {
        const updateScore = db.prepare("UPDATE data_categories SET score = ? WHERE name = ?");
        const entries = Array.isArray(categoryScores) ? categoryScores : Object.entries(categoryScores).map(([name, score]) => ({ name, score }));
        for (const item of entries) {
          const catName = item.name || item[0];
          const catScore = item.score !== undefined ? item.score : item[1];
          if (catName && catScore !== undefined && catScore !== null && catScore !== '') {
            const s = Math.floor(Number(catScore));
            if (s >= 0) updateScore.run(s, catName);
          } else if (catName && (catScore === '' || catScore === null)) {
            updateScore.run(null, catName);
          }
        }
      }

      const parts = [`成功 ${imported} 条`];
      if (duplicates.length > 0) parts.push(`跳过 ${duplicates.length} 条重复`);
      if (conflicts.length > 0) parts.push(`${conflicts.length} 条答案冲突`);
      const message = `导入完成：${parts.join('，')}`;

      res.json({ message, imported, skipped: duplicates.length, duplicates, conflicts });
    } catch (err) { sendError(res, err, 'POST /api/backup/import'); }
  });

  // POST /api/backup/import/resolve — resolve answer conflicts
  router.post('/import/resolve', (req, res) => {
    try {
      const db = getDb();
      const { updates } = req.body;
      if (!Array.isArray(updates) || !updates.length) return res.status(400).json({ error: '没有需要处理的冲突' });

      const now = localNow();
      let resolved = 0, failed = 0;
      const updateStmt = db.prepare(
        `UPDATE data_questions SET answers = @answers, updated_at = @updated_at, md5 = @md5, category = @category
         WHERE type = @type AND content = @content AND deleted_at IS NULL`
      );
      const catInsert = db.prepare("INSERT OR IGNORE INTO data_categories (name, created_at) VALUES (?, ?)");

      const resolveAll = db.transaction((items) => {
        for (const u of items) {
          if (!u.type || !u.content || !u.answers) { failed++; continue; }
          catInsert.run(u.category || '默认', now);
          const cleanAnswers = stripAnswerPrefix(u.answers)
          const result = updateStmt.run({
            type: u.type, content: u.content,
            answers: Buffer.from(JSON.stringify(cleanAnswers)),
            updated_at: now,
            md5: md5(`${u.type}-${u.content}`),
            category: u.category || '默认',
          });
          if (result.changes > 0) resolved++;
          else failed++;
        }
      });
      resolveAll(updates);

      res.json({ message: `已覆盖 ${resolved} 条题目的答案${failed > 0 ? `，${failed} 条处理失败` : ''}`, resolved, failed });
    } catch (err) { sendError(res, err, 'POST /api/backup/import/resolve'); }
  });

  return router;
};
