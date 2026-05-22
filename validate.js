const VALID_TYPES = ['单选题', '多选题', '判断题', '填空题', '简答题']
const MAX_CONTENT_LENGTH = 10000
const MAX_OPTION_LENGTH = 2000
const MAX_ANSWER_LENGTH = 5000
const MAX_CATEGORY_LENGTH = 100

function validateQuestion(body) {
  const errors = []

  // type
  if (!body.type || typeof body.type !== 'string') {
    errors.push('题型不能为空')
  } else if (!VALID_TYPES.includes(body.type)) {
    errors.push(`题型必须是以下之一：${VALID_TYPES.join('、')}`)
  }

  // content
  if (!body.content || typeof body.content !== 'string') {
    errors.push('题目内容不能为空')
  } else if (body.content.trim().length > MAX_CONTENT_LENGTH) {
    errors.push(`题目内容不能超过 ${MAX_CONTENT_LENGTH} 个字符`)
  }

  // options
  if (body.options !== undefined && body.options !== null) {
    if (!Array.isArray(body.options)) {
      errors.push('选项必须是数组格式')
    } else {
      for (let i = 0; i < body.options.length; i++) {
        if (typeof body.options[i] !== 'string') {
          errors.push(`第 ${i + 1} 个选项必须是字符串`)
        } else if (body.options[i].length > MAX_OPTION_LENGTH) {
          errors.push(`第 ${i + 1} 个选项不能超过 ${MAX_OPTION_LENGTH} 个字符`)
        }
      }
    }
  }

  // answers
  if (body.answers !== undefined && body.answers !== null) {
    if (!Array.isArray(body.answers)) {
      errors.push('答案必须是数组格式')
    } else {
      for (let i = 0; i < body.answers.length; i++) {
        if (typeof body.answers[i] !== 'string') {
          errors.push(`第 ${i + 1} 个答案必须是字符串`)
        } else if (body.answers[i].length > MAX_ANSWER_LENGTH) {
          errors.push(`第 ${i + 1} 个答案不能超过 ${MAX_ANSWER_LENGTH} 个字符`)
        }
      }
    }
  }

  // category
  if (body.category !== undefined && body.category !== null) {
    if (typeof body.category !== 'string') {
      errors.push('分类必须是字符串')
    } else if (body.category.length > MAX_CATEGORY_LENGTH) {
      errors.push(`分类名称不能超过 ${MAX_CATEGORY_LENGTH} 个字符`)
    }
  }

  // right_status
  if (body.right_status !== undefined) {
    if (![0, 1, 2].includes(body.right_status)) {
      errors.push('正确状态必须是 0、1 或 2')
    }
  }

  return errors
}

function validateCategoryName(name) {
  const errors = []
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('分类名称不能为空')
  } else if (name.trim().length > MAX_CATEGORY_LENGTH) {
    errors.push(`分类名称不能超过 ${MAX_CATEGORY_LENGTH} 个字符`)
  }
  return errors
}

module.exports = { validateQuestion, validateCategoryName, VALID_TYPES }
