/**
 * Format a date string to 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm' depending on detail level.
 * @param {string} dateStr - ISO date string
 * @param {'date'|'datetime'} mode
 * @returns {string}
 */
export function formatDate(dateStr, mode = 'date') {
  if (!dateStr) return '-'
  if (mode === 'datetime') {
    return dateStr.slice(0, 16).replace('T', ' ')
  }
  return dateStr.slice(0, 10)
}

/**
 * Calculate how many days have passed since a date string.
 * Returns a human-readable Chinese string like '今天', '昨天', '3 天前'.
 * @param {string} dateStr
 * @returns {string}
 */
export function daysSince(dateStr) {
  if (!dateStr) return ''
  const deleted = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - deleted) / (1000 * 60 * 60 * 24))
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return `${diff} 天前`
}

/**
 * Strip option letter prefixes from answer strings.
 * Examples: "C.教育职能" → "教育职能", "A. 北京" → "北京", "B、上海" → "上海"
 * If the result matches a full option text, returns that option text as-is.
 * @param {string|string[]} answers
 * @param {string[]} [options] - full option list for matching
 * @returns {string[]}
 */
export function stripAnswerPrefix(answers, options) {
  if (!answers) return []
  const arr = Array.isArray(answers) ? answers : [answers]
  return arr.map(a => {
    let trimmed = String(a).trim()
    // Strip leading letter prefix: "C." "C、" "C:" "C " etc.
    trimmed = trimmed.replace(/^[A-Za-z][.\s、·:：]+/, '').trim()
    // If options provided, try to match against full option text
    if (options && options.length > 0) {
      // Exact match with stripped text
      const exactMatch = options.find(o => o.replace(/^[A-Z][.\s、·:：]+/, '').trim() === trimmed)
      if (exactMatch) return exactMatch
      // Exact match with full option
      if (options.includes(trimmed)) return trimmed
    }
    return trimmed
  })
}

/**
 * Normalize answer for comparison — converts letter indices (A/B/C/D) to full option text,
 * strips letter prefixes like "A. xxx" → "xxx".
 * @param {Array} answers
 * @param {Array} [options] - option list for letter→text mapping
 * @returns {string[]}
 */
export function normalizeAnswer(answers, options) {
  if (!answers || !Array.isArray(answers)) return []
  return answers.map(a => {
    const trimmed = String(a).trim()
    if (/^[A-Z]$/.test(trimmed) && options && options.length > 0) {
      const idx = trimmed.charCodeAt(0) - 65
      if (idx >= 0 && idx < options.length) {
        return options[idx].replace(/^[A-Z][.\s、·:：]+/, '').trim()
      }
    }
    return trimmed.replace(/^[A-Z][.\s、·:：]+/, '').trim()
  })
}

/**
 * Highlight search keyword in text with <mark> tags.
 * @param {string} text
 * @param {string} keyword
 * @returns {string}
 */
export function highlightText(text, keyword) {
  if (!text) return text
  const safe = escapeHtml(text)
  if (!keyword) return safe
  const trimmed = keyword.trim()
  if (!trimmed) return safe
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return safe.replace(regex, '<mark class="search-highlight">$1</mark>')
}

/**
 * Format a JSON string with pretty-print and syntax highlighting.
 * Returns an HTML string with colored spans for JSON elements.
 * Falls back to the original text if not valid JSON.
 * @param {string} text - raw JSON string
 * @returns {string} HTML string
 */
export function formatJson(text) {
  if (!text) return ''
  try {
    const obj = typeof text === 'string' ? JSON.parse(text) : text
    const pretty = JSON.stringify(obj, null, 2)
    return syntaxHighlightJson(pretty)
  } catch {
    // Not valid JSON, try to fix common issues and retry
    try {
      // Handle single quotes, trailing commas etc.
      const fixed = text.replace(/'/g, '"').replace(/,\s*([\]}])/g, '$1')
      const obj = JSON.parse(fixed)
      return syntaxHighlightJson(JSON.stringify(obj, null, 2))
    } catch {
      return escapeHtml(String(text))
    }
  }
}

/**
 * Add syntax highlighting spans to a pretty-printed JSON string.
 * @param {string} json - already formatted JSON string
 * @returns {string} HTML string
 */
function syntaxHighlightJson(json) {
  return json.replace(
    /("(?:[^"\\]|\\.)*")\s*(:)?|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str, colon, bool, num) => {
      if (str) {
        if (colon) {
          // Key
          return `<span class="json-key">${escapeHtml(str)}</span>:`
        }
        // String value
        return `<span class="json-str">${escapeHtml(str)}</span>`
      }
      if (bool) return `<span class="json-bool">${match}</span>`
      if (num) return `<span class="json-num">${match}</span>`
      return match
    }
  )
}

/**
 * Escape HTML special characters.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
