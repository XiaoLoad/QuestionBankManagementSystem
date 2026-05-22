const express = require('express');

const BUILT_IN_PROVIDERS = [
  { name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1' },
  { name: '硅基流动', base_url: 'https://api.siliconflow.cn/v1' },
  { name: 'Kimi', base_url: 'https://api.moonshot.cn/v1' },
  { name: '豆包', base_url: 'https://ark.cn-beijing.volces.com/api/v3' },
];

module.exports = function (getDb, { md5, sendError, localNow }) {
  const router = express.Router();

  // GET /api/ai/presets
  router.get('/presets', (req, res) => {
    res.json(BUILT_IN_PROVIDERS);
  });

  // GET /api/ai/providers
  router.get('/providers', (req, res) => {
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
  router.post('/providers', (req, res) => {
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
  router.put('/providers/:id', (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });
      const existing = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ error: '服务商不存在' });

      const { name, base_url, api_key, model, is_default } = req.body;
      const now = localNow();

      if (is_default) {
        db.prepare('UPDATE ai_providers SET is_default = 0').run();
      }

      db.prepare(
        `UPDATE ai_providers SET name=@name, base_url=@base_url, api_key=@api_key, model=@model, is_default=@is_default, updated_at=@updated_at WHERE id=@id`
      ).run({
        id,
        name: name !== undefined ? name.trim() : existing.name,
        base_url: base_url !== undefined ? base_url.trim() : existing.base_url,
        api_key: api_key !== undefined ? api_key.trim() : existing.api_key,
        model: model !== undefined ? model : existing.model,
        is_default: is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
        updated_at: now,
      });
      res.json({ message: '更新成功' });
    } catch (err) { sendError(res, err, 'PUT /api/ai/providers/:id'); }
  });

  // DELETE /api/ai/providers/:id
  router.delete('/providers/:id', (req, res) => {
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
  router.post('/providers/:id/test', async (req, res) => {
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
  router.get('/providers/:id/models', async (req, res) => {
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
      const { providerId, type, content, options, timeout } = req.body;
      if (!type || !content) return res.status(400).json({ error: '题目类型和内容不能为空' });

      let provider;
      if (providerId) {
        provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(providerId);
      } else {
        provider = db.prepare('SELECT * FROM ai_providers WHERE is_default = 1').get();
        if (!provider) provider = db.prepare('SELECT * FROM ai_providers ORDER BY id ASC LIMIT 1').get();
      }
      if (!provider) return res.status(400).json({ error: '请先配置 AI 服务商' });
      if (!provider.model) return res.status(400).json({ error: '请先为该服务商选择模型' });

      let prompt = `你是一个专业的答题助手。请分析以下题目，给出简要解析和正确答案。

题型：${type}
题目：${content}`;

      if (options && options.length > 0 && ['单选题', '多选题', '判断题'].includes(type)) {
        prompt += `\n选项：${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' ')}`;
      }

      prompt += `

要求：
1. 给出简要解析（不超过200字）
2. 给出正确答案
3. 严格按照以下JSON格式输出，不要输出其他任何内容

输出格式：
{"analysis":"解析内容","answer":["答案1"]}

注意：
- 单选题和判断题 answer 数组只有1个元素，多选题 answer 数组有多个元素
- 填空题和简答题 answer 数组只有1个元素，为答案文本
- **必须返回选项的完整文本内容，不要返回字母编号**
  例如：选项为"A. 北京  B. 上海  C. 广州"，正确答案是B，则answer应为["上海"]，不要返回["B"]
- 答案中不要使用双引号（"），如果必须引用请用单引号（'）
- 不要输出JSON以外的任何内容`;

      const url = provider.base_url.replace(/\/+$/, '') + '/chat/completions';
      const controller = new AbortController();
      const timeoutMs = Math.max(10000, Math.min(600000, parseInt(timeout) || 120000));
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
              { role: 'system', content: '你是一个答题助手，只输出JSON格式的结果。' },
              { role: 'user', content: prompt },
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
        return res.status(response.status).json({ error: `AI 请求失败: HTTP ${response.status}`, detail: text.slice(0, 500) });
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

      res.json({ analysis, answer, model: provider.model, provider: provider.name, rawResponse });
    } catch (err) { sendError(res, err, 'POST /api/ai/analyze'); }
  });

  return router;
};
