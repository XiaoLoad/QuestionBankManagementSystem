const express = require('express');

// Simple semaphore for AI concurrency control
class Semaphore {
  constructor(max) {
    this._max = max;
    this._current = 0;
    this._queue = [];
  }
  acquire() {
    return new Promise((resolve) => {
      if (this._current < this._max) {
        this._current++;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }
  release() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    } else {
      this._current--;
    }
  }
  get current() { return this._current; }
  get waiting() { return this._queue.length; }
}

module.exports = function (getDb, { md5, safeParse, sendError, localNow }) {
  const router = express.Router();

  // CORS middleware for all external routes (OCS/yatori cross-origin requests)
  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    res.header('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // In-memory stats (persisted to external_config on shutdown, reset daily)
  const stats = {
    yatori: { total: 0, local: 0, ai: 0, notFound: 0, today: '' },
    ocs: { total: 0, local: 0, ai: 0, notFound: 0, today: '' },
  };

  let aiSemaphore = new Semaphore(5);

  // ========== Helpers ==========

  function getExternalConfig(db) {
    try {
      const rows = db.prepare("SELECT key, value FROM external_config").all();
      const cfg = {};
      for (const r of rows) {
        try { cfg[r.key] = JSON.parse(r.value); } catch { cfg[r.key] = r.value; }
      }
      return {
        yatori_enabled: cfg.yatori_enabled !== undefined ? cfg.yatori_enabled : true,
        ocs_enabled: cfg.ocs_enabled !== undefined ? cfg.ocs_enabled : true,
        max_concurrent_ai: cfg.max_concurrent_ai || 5,
        ai_timeout: cfg.ai_timeout || 30,
        auto_save: cfg.auto_save !== undefined ? cfg.auto_save : true,
      };
    } catch {
      return { yatori_enabled: true, ocs_enabled: true, max_concurrent_ai: 5, ai_timeout: 30, auto_save: true };
    }
  }

  function setExternalConfig(db, key, value) {
    const now = localNow();
    db.prepare(`
      INSERT INTO external_config (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, JSON.stringify(value), now);
  }

  function logQuery(db, source, content, type, result, answer, costMs) {
    try {
      db.prepare(`
        INSERT INTO external_logs (source, content, type, result, answer, cost_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(source, content, type || '', result, Array.isArray(answer) ? answer.join(', ') : (answer || ''), costMs, localNow());
    } catch (e) {
      console.error('[external] 写入日志失败:', e.message);
    }
  }

  // Normalize content for search: decode +, NBSP -> space, trim, collapse whitespace, strip trailing dash
  function normalizeContent(str) {
    if (!str) return '';
    return str
      .replace(/\+/g, ' ')           // URL-encoded + -> space
      .replace(/\u00a0/gi, ' ')      // NBSP -> space
      .replace(/\s*-\s*$/, '')       // strip trailing dash (OCS sends "question -")
      .replace(/\s+/g, ' ')          // collapse multiple spaces
      .trim();
  }

  // Escape HTML entities for safe display in OCS/browser
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Search local DB: fuzzy match by content + type
  function findInLocalDB(db, rawContent, type) {
    if (!rawContent || rawContent.trim().length === 0) return null;
    const content = normalizeContent(rawContent);

    // Normalize type
    const typeMap = {
      '单选': '单选题', '单选题': '单选题',
      '多选': '多选题', '多选题': '多选题',
      '判断': '判断题', '判断题': '判断题',
      '填空': '填空题', '填空题': '填空题',
      '简答': '简答题', '简答题': '简答题',
      'single': '单选题', 'multiple': '多选题', 'judgement': '判断题',
      'completion': '填空题', 'essay': '简答题',
    };
    const normalizedType = typeMap[type] || type || null;

    // Strategy 1: Exact content match (try normalized first)
    let row;
    if (normalizedType) {
      row = db.prepare(
        'SELECT * FROM data_questions WHERE content = ? AND type = ? AND deleted_at IS NULL LIMIT 1'
      ).get(content, normalizedType);
    } else {
      row = db.prepare(
        'SELECT * FROM data_questions WHERE content = ? AND deleted_at IS NULL LIMIT 1'
      ).get(content);
    }
    if (row) return row;

    // Strategy 1b: Try original content (in case normalization changed something)
    if (content !== rawContent.trim()) {
      if (normalizedType) {
        row = db.prepare(
          'SELECT * FROM data_questions WHERE content = ? AND type = ? AND deleted_at IS NULL LIMIT 1'
        ).get(rawContent.trim(), normalizedType);
      } else {
        row = db.prepare(
          'SELECT * FROM data_questions WHERE content = ? AND deleted_at IS NULL LIMIT 1'
        ).get(rawContent.trim());
      }
      if (row) return row;
    }

    // Strategy 2: MD5 match
    const hash = md5((normalizedType || '') + content);
    row = db.prepare(
      'SELECT * FROM data_questions WHERE md5 = ? AND deleted_at IS NULL LIMIT 1'
    ).get(hash);
    if (row) return row;

    // Strategy 3: LIKE fuzzy match with normalized content
    if (content.length >= 5) {
      const escaped = content.replace(/[%_]/g, '\\$&');
      if (normalizedType) {
        row = db.prepare(
          "SELECT * FROM data_questions WHERE content LIKE ? ESCAPE '\\' AND type = ? AND deleted_at IS NULL LIMIT 1"
        ).get(`%${escaped}%`, normalizedType);
      } else {
        row = db.prepare(
          "SELECT * FROM data_questions WHERE content LIKE ? ESCAPE '\\' AND deleted_at IS NULL LIMIT 1"
        ).get(`%${escaped}%`);
      }
    }

    // Strategy 4: Strip trailing whitespace in parens and retry LIKE
    // Handles cases like "question( )" vs "question(        )"
    if (!row && content.length >= 5) {
      const stripped = content.replace(/\(\s*\)/g, '( )').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
      if (stripped !== content) {
        const escaped = stripped.replace(/[%_]/g, '\\$&');
        if (normalizedType) {
          row = db.prepare(
            "SELECT * FROM data_questions WHERE content LIKE ? ESCAPE '\\' AND type = ? AND deleted_at IS NULL LIMIT 1"
          ).get(`%${escaped}%`, normalizedType);
        } else {
          row = db.prepare(
            "SELECT * FROM data_questions WHERE content LIKE ? ESCAPE '\\' AND deleted_at IS NULL LIMIT 1"
          ).get(`%${escaped}%`);
        }
      }
    }

    return row || null;
  }

  // Call AI to get answer
  async function callAIForAnswer(db, content, type, options, timeoutSec) {
    let provider;
    try {
      provider = db.prepare('SELECT * FROM ai_providers WHERE is_default = 1').get();
      if (!provider) provider = db.prepare('SELECT * FROM ai_providers ORDER BY id ASC LIMIT 1').get();
    } catch {}
    if (!provider || !provider.model) return null;

    let prompt = `你是一个专业的答题助手。请分析以下题目，给出正确答案。

题型：${type || '未知'}
题目：${content}`;

    if (options && options.length > 0) {
      prompt += `\n选项：${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' ')}`;
    }

    prompt += `

要求：
1. 只需要给出正确答案，不需要解析
2. 严格按照以下JSON格式输出，不要输出其他任何内容
输出格式：{"answer":["答案1"]}
- 单选题和判断题 answer 数组只有1个元素，多选题有多个
- 填空题和简答题 answer 数组只有1个元素
- 必须返回选项的完整文本内容，不要返回字母编号
- 不要输出JSON以外的任何内容`;

    const url = provider.base_url.replace(/\/+$/, '') + '/chat/completions';
    const timeoutMs = Math.max(10000, Math.min(300000, (timeoutSec || 30) * 1000));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.api_key}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: '你是一个答题助手，只输出JSON格式的结果。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '';
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      let answers = null;
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.answer) && parsed.answer.length > 0) {
          answers = parsed.answer.map(a => String(a).trim());
        }
      } catch {
        // Try regex fallback
        const ansMatch = reply.match(/"answer"\s*:\s*\[([\s\S]*?)\]/);
        if (ansMatch) {
          const items = [];
          const re = /"((?:[^"\\]|\\.)*)"/g;
          let m;
          while ((m = re.exec(ansMatch[1])) !== null) items.push(m[1]);
          if (items.length > 0) answers = items;
        }
      }

      if (!answers || answers.length === 0) return null;

      // Normalize answers: strip letter prefixes, match to full option text
      answers = normalizeAnswers(answers, type, options);
      return answers;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  // Normalize AI answers: convert letter indices to full option text, strip prefixes
  function normalizeAnswers(answer, type, options) {
    if (!answer || answer.length === 0) return answer;

    // For choice/judgement questions with options: map letters to full text
    if (options && options.length > 0 && ['单选题', '多选题', '判断题', 'single', 'multiple', 'judgement'].includes(type)) {
      const letterMap = {};
      options.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        letterMap[letter] = opt;
        // Also map "A. xxx" -> "xxx" for prefix stripping
        const prefixMatch = opt.match(/^[A-Z][.\s、·:：]+(.+)/);
        if (prefixMatch) {
          letterMap[letter] = prefixMatch[1].trim();
        }
      });

      return answer.map(a => {
        const trimmed = a.trim();
        // Pure letter: "A" -> full option text
        if (/^[A-Za-z]$/.test(trimmed) && letterMap[trimmed.toUpperCase()]) {
          return letterMap[trimmed.toUpperCase()];
        }
        // Already matches an option exactly
        if (options.includes(trimmed)) return trimmed;
        // Strip letter prefix: "A. xxx" -> "xxx"
        const stripped = trimmed.replace(/^[A-Za-z][.\s、·:：]+/, '').trim();
        if (options.includes(stripped)) return stripped;
        // Fuzzy match: compare stripped text against stripped options
        for (const opt of options) {
          const optText = opt.replace(/^[A-Z][.\s、·:：]+/, '').trim();
          if (optText === trimmed || optText.includes(trimmed) || trimmed.includes(optText)) {
            return opt;
          }
        }
        return stripped || a;
      });
    }

    // For non-choice questions: just strip letter prefixes
    return answer.map(a => {
      const stripped = String(a).trim().replace(/^[A-Za-z][.\s、·:：]+/, '').trim();
      return stripped || a;
    });
  }

  // Normalize options: split single-element arrays with \n, strip trailing dashes, remove letter prefixes
  function normalizeOptions(options) {
    if (!Array.isArray(options)) return options;
    const result = [];
    for (const opt of options) {
      if (typeof opt === 'string' && opt.includes('\n')) {
        // Split "对\n错" into ["对", "错"]
        const parts = opt.split('\n').map(s => s.trim()).filter(Boolean);
        result.push(...parts);
      } else {
        result.push(opt);
      }
    }

    // Detect and remove letter prefixes like "A.", "A、", "A:", "A " etc.
    // Pattern: single letter followed by punctuation/space, then optional content
    const cleaned = [];
    let hasLetterPrefix = false;

    // First pass: check if options have letter prefixes
    for (const opt of result) {
      if (typeof opt === 'string' && /^[A-Za-z][.\s、·:：]/.test(opt.trim())) {
        hasLetterPrefix = true;
        break;
      }
    }

    // Second pass: remove letter prefixes if detected
    if (hasLetterPrefix) {
      for (const opt of result) {
        if (typeof opt === 'string') {
          // Remove letter prefix: "A. xxx" -> "xxx", "A." -> "" (empty)
          const stripped = opt.trim().replace(/^[A-Za-z][.\s、·:：]*\s*/, '').trim();
          // Only add if there's actual content after stripping
          if (stripped) {
            cleaned.push(stripped);
          }
        } else {
          cleaned.push(opt);
        }
      }
    } else {
      cleaned.push(...result);
    }

    // Strip trailing dashes: "选项A-" -> "选项A"
    return cleaned.map(s => {
      if (typeof s === 'string') return s.replace(/-\s*$/, '').trim();
      return s;
    }).filter(Boolean);
  }

  // Save AI result to local DB
  function saveToLocalDB(db, content, type, options, answers) {
    try {
      const typeMap = {
        '单选': '单选题', '多选': '多选题', '判断': '判断题',
        '填空': '填空题', '简答': '简答题',
        'single': '单选题', 'multiple': '多选题', 'judgement': '判断题',
        'completion': '填空题', 'essay': '简答题',
      };
      const normalizedType = typeMap[type] || type || '单选题';
      const normalizedContent = normalizeContent(content);
      const hash = md5(normalizedType + normalizedContent);
      const now = localNow();

      // Check if already exists (including trash)
      const existing = db.prepare('SELECT id FROM data_questions WHERE md5 = ? LIMIT 1').get(hash);
      if (existing) return;

      // Normalize options before saving
      let normalizedOpts = normalizeOptions(options);
      // 填空题和简答题本身没有选项，置空避免存入垃圾数据
      if (['填空题', '简答题', 'completion', 'essay'].includes(normalizedType)) {
        normalizedOpts = null;
      }

      db.prepare(`
        INSERT INTO data_questions (created_at, updated_at, md5, type, content, options, answers, right_status, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, '默认')
      `).run(now, now, hash, normalizedType, normalizedContent,
        normalizedOpts ? JSON.stringify(normalizedOpts) : null,
        JSON.stringify(answers));
    } catch (e) {
      console.error('[external] 自动入库失败:', e.message);
    }
  }

  // Normalize answer for yatori format (text content, not letter indices)
  function normalizeAnswerForYatori(row) {
    const answers = safeParse(row.answers);
    if (!Array.isArray(answers)) return [];
    // Strip letter prefixes like "A. xxx" -> "xxx"
    return answers.map(a => {
      const s = String(a).trim();
      // If it's a single letter, it might be an un-normalized letter index — skip stripping
      if (/^[A-Za-z]$/.test(s)) return s;
      const stripped = s.replace(/^[A-Za-z][.\s、·:：]+/, '').trim();
      return stripped || s;
    });
  }

  // Type mapping for yatori response
  function yatoriType(type) {
    if (!type) return '单选';
    if (type.includes('单选')) return '单选';
    if (type.includes('多选')) return '多选';
    if (type.includes('判断')) return '判断';
    if (type.includes('填空')) return '填空';
    if (type.includes('简答')) return '简答';
    return '单选';
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function ensureToday(source) {
    const today = todayStr();
    if (stats[source].today !== today) {
      stats[source] = { total: 0, local: 0, ai: 0, notFound: 0, today };
    }
  }

  // ========== Core Query Logic ==========

  async function queryQuestion(source, content, type, options) {
    const db = getDb();
    const config = getExternalConfig(db);
    const start = Date.now();

    // Check if source is enabled
    if (source === 'yatori' && !config.yatori_enabled) {
      return { answers: [], type: '', source: 'disabled' };
    }
    if (source === 'ocs' && !config.ocs_enabled) {
      return { answers: [], type: '', source: 'disabled' };
    }

    ensureToday(source);
    stats[source].total++;

    // 1. Search local DB
    const local = findInLocalDB(db, content, type);
    if (local) {
      const answers = normalizeAnswerForYatori(local);
      if (answers.length > 0) {
        const costMs = Date.now() - start;
        stats[source].local++;
        logQuery(db, source, content, type, 'local', answers, costMs);
        return { answers, type: local.type, source: 'local', costMs };
      }
    }

    // 2. AI fallback
    // Update semaphore max if config changed
    if (aiSemaphore._max !== config.max_concurrent_ai) {
      aiSemaphore = new Semaphore(config.max_concurrent_ai);
    }

    await aiSemaphore.acquire();
    try {
      // Normalize content/options before sending to AI (strip trailing dashes, etc.)
      const cleanContent = normalizeContent(content) || content;
      const cleanOptions = normalizeOptions(options);
      const aiAnswers = await callAIForAnswer(db, cleanContent, type, cleanOptions, config.ai_timeout);
      const costMs = Date.now() - start;

      if (aiAnswers && aiAnswers.length > 0) {
        stats[source].ai++;
        logQuery(db, source, content, type, 'ai', aiAnswers, costMs);

        // Auto-save
        if (config.auto_save) {
          saveToLocalDB(db, cleanContent, type, cleanOptions, aiAnswers);
        }

        return { answers: aiAnswers, type: type || '单选题', source: 'ai', costMs };
      }

      stats[source].notFound++;
      logQuery(db, source, content, type, 'not_found', [], costMs);
      return { answers: [], type: type || '', source: 'not_found', costMs };
    } finally {
      aiSemaphore.release();
    }
  }

  // ========== Yatori Endpoint ==========

  // POST /api/external/yatori
  router.post('/yatori', async (req, res) => {
    try {
      const { type, content, hash, answer, json } = req.body;
      if (!content && !hash) {
        return res.status(400).json({ type: '单选', answers: [] });
      }

      const result = await queryQuestion('yatori', content, type, null);
      res.json({
        type: yatoriType(result.type || type),
        answers: result.answers,
      });
    } catch (err) {
      console.error('[external] Yatori 查询错误:', err.message);
      res.json({ type: '单选', answers: [] });
    }
  });

  // ========== OCS Endpoint ==========

  // GET /api/external/ocs
  router.get('/ocs', async (req, res) => {
    try {
      const { title, type, options: optStr } = req.query;
      if (!title) {
        return res.json({ code: 0, msg: '缺少 title 参数' });
      }

      let options = null;
      if (optStr) {
        try { options = JSON.parse(optStr); } catch {
          options = optStr.split('\\n').filter(Boolean);
        }
      }

      const result = await queryQuestion('ocs', title, type, options);
      res.json({
        code: result.source === 'disabled' ? 0 : 1,
        question: escapeHtml(title),
        answer: result.answers.length > 0 ? result.answers.join('#') : '',
        answers: result.answers,
        source: result.source,
        msg: result.source === 'not_found' ? '未找到答案' : (result.source === 'disabled' ? '接口已禁用' : 'ok'),
      });
    } catch (err) {
      console.error('[external] OCS 查询错误:', err.message);
      res.json({ code: 0, msg: '服务器错误' });
    }
  });

  // POST /api/external/ocs (also support POST)
  router.post('/ocs', async (req, res) => {
    try {
      const { title, type, options } = req.body;
      if (!title) {
        return res.json({ code: 0, msg: '缺少 title 参数' });
      }

      const result = await queryQuestion('ocs', title, type, options);
      res.json({
        code: result.source === 'disabled' ? 0 : 1,
        question: escapeHtml(title),
        answer: result.answers.length > 0 ? result.answers.join('#') : '',
        answers: result.answers,
        source: result.source,
        msg: result.source === 'not_found' ? '未找到答案' : (result.source === 'disabled' ? '接口已禁用' : 'ok'),
      });
    } catch (err) {
      console.error('[external] OCS 查询错误:', err.message);
      res.json({ code: 0, msg: '服务器错误' });
    }
  });

  // ========== Config Endpoints ==========

  // GET /api/external/config
  router.get('/config', (req, res) => {
    try {
      const db = getDb();
      const config = getExternalConfig(db);
      res.json(config);
    } catch (err) { sendError(res, err, 'GET /api/external/config'); }
  });

  // PUT /api/external/config
  router.put('/config', (req, res) => {
    try {
      const db = getDb();
      const updates = req.body;
      const allowed = ['yatori_enabled', 'ocs_enabled', 'max_concurrent_ai', 'ai_timeout', 'auto_save'];
      for (const [key, value] of Object.entries(updates)) {
        if (allowed.includes(key)) {
          setExternalConfig(db, key, value);
        }
      }
      // Update semaphore if max_concurrent_ai changed
      if (updates.max_concurrent_ai !== undefined) {
        aiSemaphore = new Semaphore(updates.max_concurrent_ai);
      }
      res.json({ message: '配置已更新' });
    } catch (err) { sendError(res, err, 'PUT /api/external/config'); }
  });

  // ========== Stats Endpoint ==========

  // GET /api/external/stats
  router.get('/stats', (req, res) => {
    try {
      const db = getDb();
      ensureToday('yatori');
      ensureToday('ocs');

      // Get today's stats from DB for persistence
      const today = todayStr();
      let dbStats = { yatori: { total: 0, local: 0, ai: 0 }, ocs: { total: 0, local: 0, ai: 0 } };
      try {
        const rows = db.prepare(`
          SELECT source, result, COUNT(*) as cnt
          FROM external_logs
          WHERE date(created_at) = ?
          GROUP BY source, result
        `).all(today);
        for (const r of rows) {
          if (dbStats[r.source]) {
            dbStats[r.source].total += r.cnt;
            if (r.result === 'local') dbStats[r.source].local = r.cnt;
            if (r.result === 'ai') dbStats[r.source].ai = r.cnt;
            if (r.result === 'not_found') dbStats[r.source].notFound = r.cnt;
          }
        }
      } catch {}

      // Merge with in-memory (in-memory may have more recent counts before flush)
      res.json({
        today,
        yatori: {
          total: Math.max(stats.yatori.total, dbStats.yatori.total),
          local: Math.max(stats.yatori.local, dbStats.yatori.local),
          ai: Math.max(stats.yatori.ai, dbStats.yatori.ai),
          notFound: Math.max(stats.yatori.notFound, dbStats.yatori.notFound || 0),
        },
        ocs: {
          total: Math.max(stats.ocs.total, dbStats.ocs.total),
          local: Math.max(stats.ocs.local, dbStats.ocs.local),
          ai: Math.max(stats.ocs.ai, dbStats.ocs.ai),
          notFound: Math.max(stats.ocs.notFound, dbStats.ocs.notFound || 0),
        },
        semaphore: { current: aiSemaphore.current, waiting: aiSemaphore.waiting },
      });
    } catch (err) { sendError(res, err, 'GET /api/external/stats'); }
  });

  // ========== Logs Endpoint ==========

  // GET /api/external/logs
  router.get('/logs', (req, res) => {
    try {
      const db = getDb();
      const limit = Math.max(1, Math.min(200, parseInt(req.query.limit) || 50));
      const source = req.query.source; // optional filter
      const result = req.query.result; // optional filter

      let sql = 'SELECT * FROM external_logs WHERE 1=1';
      const params = [];

      if (source && ['yatori', 'ocs'].includes(source)) {
        sql += ' AND source = ?';
        params.push(source);
      }
      if (result && ['local', 'ai', 'not_found'].includes(result)) {
        sql += ' AND result = ?';
        params.push(result);
      }

      sql += ' ORDER BY id DESC LIMIT ?';
      params.push(limit);

      const rows = db.prepare(sql).all(...params);
      res.json(rows);
    } catch (err) { sendError(res, err, 'GET /api/external/logs'); }
  });

  // DELETE /api/external/logs
  router.delete('/logs', (req, res) => {
    try {
      const db = getDb();
      const days = req.body.days !== undefined ? parseInt(req.body.days) : 30;
      if (days === 0) {
        const result = db.prepare('DELETE FROM external_logs').run();
        res.json({ message: `已清空 ${result.changes} 条日志` });
      } else {
        const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19);
        const result = db.prepare('DELETE FROM external_logs WHERE created_at < ?').run(cutoff);
        res.json({ message: `已清理 ${result.changes} 条日志` });
      }
    } catch (err) { sendError(res, err, 'DELETE /api/external/logs'); }
  });

  return router;
};
