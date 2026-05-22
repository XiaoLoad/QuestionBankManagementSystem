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

module.exports = { localNow, safeParse, md5, sendError }
