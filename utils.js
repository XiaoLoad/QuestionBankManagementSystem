const crypto = require('crypto')

function localNow() {
  const d = new Date()
  const pad = (n, len = 2) => String(n).padStart(len, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  const ms = pad(d.getMilliseconds(), 3)
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}`
}

function safeParse(val) {
  if (Buffer.isBuffer(val)) { try { return JSON.parse(val.toString('utf-8')); } catch { return val.toString('utf-8'); } }
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

function sendError(res, err, context = '') {
  const msg = err.message || '未知错误'
  console.error(`[Error] ${context}: ${msg}`)
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: msg })
  }
  res.status(500).json({ error: '服务器内部错误' })
}

// 从文本中提取图片 URL
// 1. 带图片扩展名的 URL
// 2. 已知图片 CDN 无扩展名 URL（如 chaoxing、edu.cn 等）
const IMAGE_URL_RE = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s"'<>]*)?|https?:\/\/p\.ananas\.chaoxing\.com\/[^\s"'<>]+/gi

function extractImageUrls(text) {
  if (!text || typeof text !== 'string') return []
  return text.match(IMAGE_URL_RE) || []
}

// 去掉文本中的图片 URL
function stripImageUrls(text) {
  if (!text || typeof text !== 'string') return text
  return text.replace(IMAGE_URL_RE, '').replace(/\s{2,}/g, ' ').trim()
}

// 构建支持图片的 user message content
// 有图片时返回数组格式（Vision API），无图片时返回纯字符串
function buildUserContent(text, imageUrls) {
  if (!imageUrls || imageUrls.length === 0) return text
  const parts = [{ type: 'text', text }]
  for (const url of imageUrls) {
    parts.push({ type: 'image_url', image_url: { url } })
  }
  return parts
}

module.exports = { localNow, safeParse, md5, sendError, extractImageUrls, stripImageUrls, buildUserContent }
