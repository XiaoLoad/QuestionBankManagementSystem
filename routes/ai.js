const express = require('express');

const BUILT_IN_PROVIDERS = [
  { name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1' },
  { name: '硅基流动', base_url: 'https://api.siliconflow.cn/v1' },
  { name: 'Kimi', base_url: 'https://api.moonshot.cn/v1' },
  { name: '豆包', base_url: 'https://ark.cn-beijing.volces.com/api/v3' },
];

module.exports = function (getDb, { md5, sendError, localNow, extractImageUrls, stripImageUrls, buildUserContent, pickReferer }, auth) {
  const router = express.Router();

  // 解析题目 images 字段（JSON 数组字符串），提取可用的图片 URL
  function parseStoredImages(raw) {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(u => typeof u === 'string' && /^https?:\/\//.test(u)) : [];
    } catch { return []; }
  }

  // 服务端下载图片并转为 base64 data URL（AI 服务商无法直接访问带防盗链的图床）
  async function fetchImageAsDataUrl(url) {
    try {
      const headers = {};
      const referer = pickReferer(url);
      if (referer) headers['Referer'] = referer;
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return null;
      const type = resp.headers.get('content-type') || '';
      if (!type.startsWith('image/')) return null;
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length === 0 || buf.length > 5 * 1024 * 1024) return null;
      return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
    } catch { return null; }
  }

  // 依次解析图片 URL：下载成功转 base64，失败回退原 URL（最多 5 张防滥用）
  async function resolveImageUrls(urls) {
    const out = [];
    for (const u of urls.slice(0, 5)) {
      out.push(await fetchImageAsDataUrl(u) || u);
    }
    return out;
  }

  // GET /api/ai/presets (所有登录用户可访问)
  router.get('/presets', (req, res) => {
    res.json(BUILT_IN_PROVIDERS);
  });

  // GET /api/ai/providers (仅管理员)
  router.get('/providers', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT * FROM ai_providers ORDER BY is_default DESC, id ASC').all();
      const masked = rows.map(r => ({
        ...r,
        api_key_masked: r.api_key.length > 8
          ? r.api_key.slice(0, 4) + '****' + r.api_key.slice(-4)
          : '****',
      }));
      res.json(masked);
    } catch (err) { sendError(res, err, 'GET /api/ai/providers'); }
  });

  // POST /api/ai/providers
  router.post('/providers', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const { name, base_url, api_key, model = '', is_default = false } = req.body;
      if (!name || !base_url || !api_key) {
        return res.status(400).json({ error: '名称、API 地址和 API Key 不能为空' });
      }
      const now = localNow();
      if (is_default) {
        db.prepare('UPDATE ai_providers SET is_default = 0').run();
      }
      const result = db.prepare(
        'INSERT INTO ai_providers (name, base_url, api_key, model, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(name.trim(), base_url.trim(), api_key.trim(), model, is_default ? 1 : 0, now, now);
      res.json({ id: result.lastInsertRowid, message: '添加成功' });
    } catch (err) { sendError(res, err, 'POST /api/ai/providers'); }
  });

  // PUT /api/ai/providers/:id
  router.put('/providers/:id', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });
      const existing = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ error: '服务商不存在' });

      const { name, base_url, api_key, model, is_default, enabled } = req.body;
      const now = localNow();

      if (is_default) {
        db.prepare('UPDATE ai_providers SET is_default = 0').run();
      }

      db.prepare(
        `UPDATE ai_providers SET name=@name, base_url=@base_url, api_key=@api_key, model=@model, is_default=@is_default, enabled=@enabled, updated_at=@updated_at WHERE id=@id`
      ).run({
        id,
        name: name !== undefined ? name.trim() : existing.name,
        base_url: base_url !== undefined ? base_url.trim() : existing.base_url,
        api_key: api_key !== undefined ? api_key.trim() : existing.api_key,
        model: model !== undefined ? model : existing.model,
        is_default: is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
        enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        updated_at: now,
      });
      res.json({ message: '更新成功' });
    } catch (err) { sendError(res, err, 'PUT /api/ai/providers/:id'); }
  });

  // DELETE /api/ai/providers/:id
  router.delete('/providers/:id', auth.adminRequired, (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });
      const result = db.prepare('DELETE FROM ai_providers WHERE id = ?').run(id);
      if (result.changes === 0) return res.status(404).json({ error: '服务商不存在' });
      res.json({ message: '删除成功' });
    } catch (err) { sendError(res, err, 'DELETE /api/ai/providers/:id'); }
  });

  // POST /api/ai/providers/:id/test
  router.post('/providers/:id/test', auth.adminRequired, async (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });
      const provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id);
      if (!provider) return res.status(404).json({ error: '服务商不存在' });

      const url = provider.base_url.replace(/\/+$/, '') + '/models';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${provider.api_key}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.json({ ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` });
      }

      res.json({ ok: true, message: '连接成功' });
    } catch (err) {
      res.json({ ok: false, error: err.message || '连接失败' });
    }
  });

  // GET /api/ai/providers/:id/models
  router.get('/providers/:id/models', auth.adminRequired, async (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });
      const provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id);
      if (!provider) return res.status(404).json({ error: '服务商不存在' });

      const url = provider.base_url.replace(/\/+$/, '') + '/models';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${provider.api_key}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.status(response.status).json({ error: `获取模型列表失败: HTTP ${response.status}` });
      }

      const data = await response.json();
      const models = (data.data || data.models || []).map(m => m.id || m.name).filter(Boolean).sort();
      res.json({ models });
    } catch (err) { sendError(res, err, 'GET /api/ai/providers/:id/models'); }
  });

  // POST /api/ai/analyze
  router.post('/analyze', async (req, res) => {
    try {
      const db = getDb();
      const { providerId, type, content, options, timeout, forceRefresh } = req.body;
      if (!type || !content) return res.status(400).json({ error: '题目类型和内容不能为空' });

      // 检查是否有缓存的解析（通过内容匹配）
      if (!forceRefresh) {
        try {
          const existing = db.prepare(
            'SELECT analysis, ai_answer FROM data_questions WHERE content = ? AND type = ? AND deleted_at IS NULL AND analysis IS NOT NULL LIMIT 1'
          ).get(content, type);
          if (existing && existing.analysis) {
            let cachedAnswer = [];
            try { cachedAnswer = JSON.parse(existing.ai_answer || '[]'); } catch {}
            return res.json({
              analysis: existing.analysis,
              answer: cachedAnswer,
              model: '',
              provider: '',
              rawResponse: '',
              cached: true,
            });
          }
        } catch {}
      }

      // AI 服务商查找优先级（只使用已启用的服务商）：
      // 管理员：直接使用全局 ai_providers
      // 普通用户：
      //   1. 用户自定义默认
      //   2. 用户自定义第一个
      //   3. 管理员默认（需 can_use_admin_ai = 1）
      //   4. 管理员第一个（需 can_use_admin_ai = 1）
      let provider;
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      if (providerId) {
        // 指定服务商：管理员查全局，普通用户先查自己的再查全局
        if (isAdmin) {
          provider = db.prepare('SELECT * FROM ai_providers WHERE id = ? AND enabled = 1').get(providerId);
        } else {
          provider = db.prepare('SELECT * FROM user_ai_providers WHERE id = ? AND user_id = ? AND enabled = 1').get(providerId, userId);
          if (!provider) {
            // 检查是否授权使用管理员服务商
            const user = db.prepare('SELECT can_use_admin_ai FROM users WHERE id = ?').get(userId);
            if (user?.can_use_admin_ai) {
              provider = db.prepare('SELECT * FROM ai_providers WHERE id = ? AND enabled = 1').get(providerId);
            }
          }
        }
      } else {
        // 管理员：直接查全局服务商
        if (isAdmin) {
          provider = db.prepare('SELECT * FROM ai_providers WHERE is_default = 1 AND enabled = 1').get();
          if (!provider) provider = db.prepare('SELECT * FROM ai_providers WHERE enabled = 1 ORDER BY id ASC LIMIT 1').get();
        } else {
          // 普通用户：先查自己的
          provider = db.prepare('SELECT * FROM user_ai_providers WHERE user_id = ? AND is_default = 1 AND enabled = 1').get(userId);
          if (!provider) {
            provider = db.prepare('SELECT * FROM user_ai_providers WHERE user_id = ? AND enabled = 1 ORDER BY id ASC LIMIT 1').get(userId);
          }

          // 再查管理员的（需授权）
          if (!provider) {
            const user = db.prepare('SELECT can_use_admin_ai FROM users WHERE id = ?').get(userId);
            if (user?.can_use_admin_ai) {
              provider = db.prepare('SELECT * FROM ai_providers WHERE is_default = 1 AND enabled = 1').get();
              if (!provider) provider = db.prepare('SELECT * FROM ai_providers WHERE enabled = 1 ORDER BY id ASC LIMIT 1').get();
            }
          }
        }
      }

      if (!provider) return res.status(400).json({ error: '请先配置 AI 服务商' });
      if (!provider.model) return res.status(400).json({ error: '请先为该服务商选择模型' });

      // 默认提示词
      let systemPrompt = '你是一个答题助手，只输出JSON格式的结果。';
      let userPromptTemplate = `你是一个专业的答题助手。请分析以下题目，给出简要解析和正确答案。

题型：{type}
题目：{content}
选项：{options}
分类：{category}

要求：
1. 给出简要解析（不超过200字）
2. 给出正确答案
3. 严格按照以下JSON格式输出，不要输出其他任何内容

输出格式：
{"analysis":"解析内容","answer":["答案1"]}

注意：
- 单选题和判断题 answer 数组只有1个元素，多选题 answer 数组有多个元素
- 填空题和简答题 answer 数组只有1个元素，为答案文本
- 必须返回选项的完整文本内容，不要返回字母编号
- 答案中不要使用双引号，如果必须引用请用单引号
- 不要输出JSON以外的任何内容`;

      // 读取管理员配置的默认提示词
      try {
        const adminPromptsRow = db.prepare("SELECT value FROM site_settings WHERE key = 'default_ai_prompts'").get();
        if (adminPromptsRow?.value) {
          const adminPrompts = JSON.parse(adminPromptsRow.value);
          if (adminPrompts.analyze) {
            if (adminPrompts.analyze.system) systemPrompt = adminPrompts.analyze.system;
            if (adminPrompts.analyze.user) userPromptTemplate = adminPrompts.analyze.user;
          }
        }
      } catch {}

      // 读取用户自定义提示词（优先级最高）
      if (userId) {
        try {
          const userPrompt = db.prepare(
            'SELECT system_prompt, user_prompt FROM user_ai_prompts WHERE user_id = ? AND prompt_key = ?'
          ).get(userId, 'analyze');
          if (userPrompt) {
            if (userPrompt.system_prompt) systemPrompt = userPrompt.system_prompt;
            if (userPrompt.user_prompt) userPromptTemplate = userPrompt.user_prompt;
          }
        } catch {}
      }

      // 变量替换
      const optionsStr = options && options.length > 0 && ['单选题', '多选题', '判断题'].includes(type)
        ? options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' ')
        : '';

      // 查找题目分类（只取下划线前的分类名，去除导入来源）
      let category = '';
      let question = null;
      try {
        question = db.prepare('SELECT category, images FROM data_questions WHERE content = ? AND type = ? AND deleted_at IS NULL LIMIT 1').get(content, type);
        const rawCategory = question?.category || '默认';
        // 如果分类名包含下划线，只取第一部分作为题库分类名
        category = rawCategory.includes('_') ? rawCategory.split('_')[0] : rawCategory;
      } catch { category = '默认'; }

      let prompt = userPromptTemplate
        .replace(/\{type\}/g, type)
        .replace(/\{content\}/g, content)
        .replace(/\{options\}/g, optionsStr)
        .replace(/\{category\}/g, category);

      const url = provider.base_url.replace(/\/+$/, '') + '/chat/completions';
      const controller = new AbortController();
      const timeoutMs = Math.max(10000, Math.min(600000, parseInt(timeout) || 120000));
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // 检测题目中的图片 URL（正文 + images 字段），构建 multimodal content
      const storedImageUrls = parseStoredImages(question?.images);
      const imageUrls = [...new Set([...extractImageUrls(content), ...storedImageUrls])];
      const resolvedImageUrls = await resolveImageUrls(imageUrls);
      const userContent = resolvedImageUrls.length > 0
        ? buildUserContent(stripImageUrls(prompt), resolvedImageUrls)
        : prompt;

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.api_key}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
            ],
            temperature: 0.1,
            stream: false,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr.name === 'AbortError' || fetchErr.name === 'TimeoutError' || fetchErr.code === 'ABORT_ERR';
        return res.status(isTimeout ? 504 : 502).json({
          error: isTimeout ? `AI 请求超时（${Math.round(timeoutMs / 1000)}秒），请在 AI 设置中增加超时时间或稍后重试` : `AI 请求失败: ${fetchErr.message}`,
        });
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        // 不要直接返回 AI 服务商的 401 状态码，避免前端误认为登录过期
        const status = response.status === 401 ? 502 : response.status;
        return res.status(status).json({ error: `AI 请求失败: HTTP ${response.status}，请检查 API Key 是否正确`, detail: text.slice(0, 500) });
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '';

      const rawResponse = reply;
      let analysis = '', answer = [];

      // 提取 JSON 字符串（可能被 markdown 代码块包裹）
      let jsonStr = reply;
      const codeBlockMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

      // ---- 第一层：正常 JSON.parse ----
      let parsed = null;
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {}
      }

      // ---- 第二层：预处理后重试（处理答案中含未转义双引号的情况） ----
      if (!parsed && jsonMatch) {
        try {
          let fixStr = jsonMatch[0];
          // 把 JSON 字符串值内部的 ASCII 双引号 " 替换为中文引号 ""
          // 策略：逐字符遍历，只替换字符串内部的裸引号
          let result = '';
          let inString = false;
          let escaped = false;
          for (let i = 0; i < fixStr.length; i++) {
            const ch = fixStr[i];
            if (escaped) {
              result += ch;
              escaped = false;
              continue;
            }
            if (ch === '\\') {
              result += ch;
              escaped = true;
              continue;
            }
            if (ch === '"') {
              if (!inString) {
                // 进入字符串
                inString = true;
                result += ch;
              } else {
                // 判断这个引号是「字符串结束」还是「字符串内部的裸引号」
                // 往后看：跳过空白后应该是 , ] } : 或者到达末尾
                let j = i + 1;
                while (j < fixStr.length && fixStr[j] === ' ') j++;
                const next = fixStr[j];
                if (next === ',' || next === '}' || next === ']' || next === ':' || next === undefined) {
                  // 是正常的字符串结束引号
                  inString = false;
                  result += ch;
                } else {
                  // 是字符串内部的裸引号，替换为中文引号
                  result += '\u201C'; // "
                }
              }
            } else {
              result += ch;
            }
          }
          parsed = JSON.parse(result);
        } catch {}
      }

      // ---- 第三层：正则兜底提取 ----
      if (!parsed) {
        try {
          // 提取 analysis
          const aMatch = jsonStr.match(/"analysis"\s*:\s*"([\s\S]*?)"\s*,\s*"answer"/);
          if (aMatch) analysis = aMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');

          // 提取 answer 数组内容
          const ansMatch = jsonStr.match(/"answer"\s*:\s*\[([\s\S]*?)\]/);
          if (ansMatch) {
            const ansContent = ansMatch[1];
            // 按引号分割提取每个元素
            const items = [];
            const re = /"((?:[^"\\]|\\.)*)"/g;
            let m;
            while ((m = re.exec(ansContent)) !== null) {
              items.push(m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
            }
            answer = items;
          }
        } catch {}
      }

      // ---- 正常解析成功的情况 ----
      if (parsed) {
        // 处理嵌套：模型把整个 JSON 塞进了 analysis 字符串
        if ((!parsed.answer || (Array.isArray(parsed.answer) && parsed.answer.length === 0)) && typeof parsed.analysis === 'string') {
          const innerMatch = parsed.analysis.match(/^\s*\{[\s\S]*\}\s*$/);
          if (innerMatch) {
            try {
              const inner = JSON.parse(innerMatch[0]);
              if (inner.analysis !== undefined) parsed = inner;
            } catch {}
          }
        }
        analysis = typeof parsed.analysis === 'string' ? parsed.analysis : JSON.stringify(parsed.analysis);
        answer = Array.isArray(parsed.answer) ? parsed.answer : (parsed.answer ? [String(parsed.answer)] : []);
      } else if (!analysis) {
        // 三层都失败，原始文本作为解析
        analysis = reply;
      }

      // Normalize AI answers: convert letter indices (A/B/C/D) to full option text
      if (answer.length > 0 && options && options.length > 0 && ['单选题', '多选题', '判断题'].includes(type)) {
        const letterMap = {};
        options.forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          letterMap[letter] = opt;
          const prefixMatch = opt.match(/^[A-Z][.\s、·:：]+(.+)/);
          if (prefixMatch) {
            letterMap[letter] = prefixMatch[1].trim();
          }
        });

        answer = answer.map(a => {
          const trimmed = a.trim();
          if (/^[A-Za-z]$/.test(trimmed) && letterMap[trimmed.toUpperCase()]) {
            return letterMap[trimmed.toUpperCase()];
          }
          if (options.includes(trimmed)) return trimmed;
          const stripped = trimmed.replace(/^[A-Za-z][.\s、·:：]+/, '').trim();
          if (options.includes(stripped)) return stripped;
          for (const opt of options) {
            const optText = opt.replace(/^[A-Z][.\s、·:：]+/, '').trim();
            if (optText === trimmed || optText.includes(trimmed) || trimmed.includes(optText)) {
              return opt;
            }
          }
          return stripped || a;
        });
      } else if (answer.length > 0) {
        // For non-choice questions (填空题/简答题), still strip letter prefixes
        answer = answer.map(a => {
          const stripped = String(a).trim().replace(/^[A-Za-z][.\s、·:：]+/, '').trim()
          return stripped || a
        })
      }

      // 缓存解析结果和AI答案到数据库
      if (analysis) {
        try {
          const now = localNow();
          const answerJson = JSON.stringify(answer || []);
          const result = db.prepare(
            'UPDATE data_questions SET analysis = ?, ai_answer = ?, updated_at = ? WHERE content = ? AND type = ? AND deleted_at IS NULL'
          ).run(analysis, answerJson, now, content, type);
          // 如果没有更新到记录（题目不在本地库），不做处理，解析结果仍会返回给前端
        } catch (e) {
          console.error('[ai] 缓存解析失败:', e.message);
        }
      }

      // 记录 AI 使用日志
      if (userId) {
        try {
          db.prepare('INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)')
            .run(userId, 'ai_analyze', JSON.stringify({
              type: type,
              content: content.substring(0, 100),
              provider: provider.name,
              model: provider.model,
            }), localNow());
        } catch {}
      }

      res.json({ analysis, answer, model: provider.model, provider: provider.name, rawResponse, cached: false });
    } catch (err) { sendError(res, err, 'POST /api/ai/analyze'); }
  });

  // POST /api/ai/analyze-stream (流式输出，SSE)
  router.post('/analyze-stream', async (req, res) => {
    try {
      const db = getDb();
      const { type, content, options, timeout } = req.body;
      if (!type || !content) {
        return res.status(400).json({ error: '题目类型和内容不能为空' });
      }

      // 设置 SSE 头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 查找服务商（复用 analyze 逻辑）
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';
      let provider;

      if (isAdmin) {
        provider = db.prepare('SELECT * FROM ai_providers WHERE is_default = 1 AND enabled = 1').get();
        if (!provider) provider = db.prepare('SELECT * FROM ai_providers WHERE enabled = 1 ORDER BY id ASC LIMIT 1').get();
      } else {
        provider = db.prepare('SELECT * FROM user_ai_providers WHERE user_id = ? AND is_default = 1 AND enabled = 1').get(userId);
        if (!provider) {
          provider = db.prepare('SELECT * FROM user_ai_providers WHERE user_id = ? AND enabled = 1 ORDER BY id ASC LIMIT 1').get(userId);
        }
        if (!provider) {
          const user = db.prepare('SELECT can_use_admin_ai FROM users WHERE id = ?').get(userId);
          if (user?.can_use_admin_ai) {
            provider = db.prepare('SELECT * FROM ai_providers WHERE is_default = 1 AND enabled = 1').get();
            if (!provider) provider = db.prepare('SELECT * FROM ai_providers WHERE enabled = 1 ORDER BY id ASC LIMIT 1').get();
          }
        }
      }

      if (!provider || !provider.model) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: '请先配置 AI 服务商' })}\n\n`);
        return res.end();
      }

      // 构建提示词
      let systemPrompt = '你是一个答题助手，只输出JSON格式的结果。';
      let userPromptTemplate = `你是一个专业的答题助手。请分析以下题目，给出简要解析和正确答案。

题型：{type}
题目：{content}
选项：{options}
分类：{category}

要求：
1. 给出简要解析（不超过200字）
2. 给出正确答案
3. 严格按照以下JSON格式输出，不要输出其他任何内容

输出格式：
{"analysis":"解析内容","answer":["答案1"]}

注意：
- 单选题和判断题 answer 数组只有1个元素，多选题 answer 数组有多个元素
- 填空题和简答题 answer 数组只有1个元素，为答案文本
- 必须返回选项的完整文本内容，不要返回字母编号
- 答案中不要使用双引号，如果必须引用请用单引号
- 不要输出JSON以外的任何内容`;

      // 读取管理员配置的默认提示词
      try {
        const adminPromptsRow = db.prepare("SELECT value FROM site_settings WHERE key = 'default_ai_prompts'").get();
        if (adminPromptsRow?.value) {
          const adminPrompts = JSON.parse(adminPromptsRow.value);
          if (adminPrompts.analyze) {
            if (adminPrompts.analyze.system) systemPrompt = adminPrompts.analyze.system;
            if (adminPrompts.analyze.user) userPromptTemplate = adminPrompts.analyze.user;
          }
        }
      } catch {}

      // 读取用户自定义提示词
      if (userId) {
        try {
          const userPrompt = db.prepare('SELECT system_prompt, user_prompt FROM user_ai_prompts WHERE user_id = ? AND prompt_key = ?').get(userId, 'analyze');
          if (userPrompt) {
            if (userPrompt.system_prompt) systemPrompt = userPrompt.system_prompt;
            if (userPrompt.user_prompt) userPromptTemplate = userPrompt.user_prompt;
          }
        } catch {}
      }

      // 变量替换
      const optionsStr = options && options.length > 0 && ['单选题', '多选题', '判断题'].includes(type)
        ? options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' ')
        : '';

      let category = '默认';
      let question = null;
      try {
        question = db.prepare('SELECT category, images FROM data_questions WHERE content = ? AND type = ? AND deleted_at IS NULL LIMIT 1').get(content, type);
        const rawCategory = question?.category || '默认';
        category = rawCategory.includes('_') ? rawCategory.split('_')[0] : rawCategory;
      } catch {}

      const prompt = userPromptTemplate
        .replace(/\{type\}/g, type)
        .replace(/\{content\}/g, content)
        .replace(/\{options\}/g, optionsStr)
        .replace(/\{category\}/g, category);

      // 检测题目中的图片 URL（正文 + images 字段），构建 multimodal content（与 /analyze 保持一致）
      const storedImageUrls = parseStoredImages(question?.images);
      const imageUrls = [...new Set([...extractImageUrls(content), ...storedImageUrls])];
      const resolvedImageUrls = await resolveImageUrls(imageUrls);
      const userContent = resolvedImageUrls.length > 0
        ? buildUserContent(stripImageUrls(prompt), resolvedImageUrls)
        : prompt;

      // 发送用户提问词
      res.write(`data: ${JSON.stringify({ type: 'prompt', content: prompt })}\n\n`);

      // 调用 AI API（流式）
      const url = provider.base_url.replace(/\/+$/, '') + '/chat/completions';
      const timeoutMs = Math.max(10000, Math.min(600000, parseInt(timeout) || 120000));
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.api_key}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
            ],
            temperature: 0.1,
            stream: true,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr.name === 'AbortError' || fetchErr.name === 'TimeoutError';
        const isNetworkError = fetchErr.message.includes('fetch failed') || fetchErr.message.includes('network');
        let errorMsg = isTimeout ? '请求超时，请稍后重试' : (isNetworkError ? '网络连接失败，请检查网络' : fetchErr.message);
        res.write(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`);
        return res.end();
      }

      if (!response.ok) {
        clearTimeout(timeoutId);
        const text = await response.text().catch(() => '');
        // 不要直接返回 AI 服务商的 401 状态码
        const status = response.status === 401 ? 502 : response.status;
        const errorMsg = response.status === 401 ? 'API Key 无效，请检查 AI 设置' : `AI 请求失败: HTTP ${response.status}`;
        // 透传服务商错误详情（如"模型不支持图像输入"），便于定位问题
        const detail = text.slice(0, 300).replace(/\s+/g, ' ').trim();
        res.write(`data: ${JSON.stringify({ type: 'error', message: detail ? `${errorMsg} - ${detail}` : errorMsg })}\n\n`);
        return res.end();
      }

      // 流式读取
      let fullContent = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
              }
            } catch {}
          }
        }
      }

      clearTimeout(timeoutId);

      // 解析完整结果
      let analysis = '', answer = [];
      try {
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          analysis = parsed.analysis || fullContent;
          answer = Array.isArray(parsed.answer) ? parsed.answer : [];
        } else {
          analysis = fullContent;
        }
      } catch {
        analysis = fullContent;
      }

      // 缓存结果
      if (analysis) {
        try {
          const now = localNow();
          db.prepare('UPDATE data_questions SET analysis = ?, ai_answer = ?, updated_at = ? WHERE content = ? AND type = ? AND deleted_at IS NULL')
            .run(analysis, JSON.stringify(answer), now, content, type);
        } catch {}
      }

      // 记录日志
      if (userId) {
        try {
          db.prepare('INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)')
            .run(userId, 'ai_analyze', JSON.stringify({ type, content: content.substring(0, 100), provider: provider.name, model: provider.model }), localNow());
        } catch {}
      }

      // 发送完成信号
      res.write(`data: ${JSON.stringify({ type: 'done', analysis, answer, model: provider.model, provider: provider.name })}\n\n`);
      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message || 'AI 分析失败' })}\n\n`);
      res.end();
    }
  });

  return router;
};
