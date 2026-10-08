<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useConfirmStore } from '@/stores/confirm'
import { useAiTaskStore } from '@/stores/aiTask'
import { useAuthStore } from '@/stores/auth'
import { TYPE_COLORS } from '@/composables/constants'
import { formatDate, formatJson } from '@/composables/utils'
import { normalizeAnswer } from '@/composables/utils'
import QuestionFormModal from '@/components/QuestionFormModal.vue'
import AiAnalyzeModal from '@/components/AiAnalyzeModal.vue'
import ReplaceAnswerDialog from '@/components/ReplaceAnswerDialog.vue'

defineOptions({ name: 'QuestionDetail' })

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToastStore()
const confirm = useConfirmStore()
const aiTask = useAiTaskStore()
const auth = useAuthStore()

const question = ref(null)
const loading = ref(true)
const categories = ref([])
const showEditForm = ref(false)
const showAiModal = ref(false)
const showReplaceDialog = ref(false)
const pendingAiAnswers = ref([])
const statusMenuRef = ref(null)

// AI analyze state
const analyzing = ref(false)
const aiResult = ref(null)
const aiError = ref('')

// 按钮状态：是否正在生成当前题目的 AI 解析
const isAiGenerating = computed(() => {
  return aiTask.isGenerating && aiTask.task?.questionId === question.value?.id
})

// 按钮文字
const aiButtonText = computed(() => {
  if (isAiGenerating.value) return 'AI 生成中...'
  if (question.value?.analysis) return '查看 AI 解析'
  return 'AI 校验答案'
})
const rawExpanded = ref(false)
const aiStreamCache = ref(null) // 缓存流式结果
const showStatusMenu = ref(false) // 标记状态菜单

// AI 答案标记状态配置
const statusConfig = {
  consistent: { label: '完全一致', icon: '✓', color: 'green' },
  similar: { label: '基本一致', icon: '≈', color: 'yellow' },
  different: { label: '答案不同', icon: '✗', color: 'red' },
}

// 当前标记状态
const currentAiStatus = computed(() => {
  return question.value?.ai_answer_status || null
})

onMounted(async () => {
  // 添加点击外部关闭菜单的监听器
  document.addEventListener('click', handleClickOutside)

  try {
    const [q, cats] = await Promise.all([
      api.getQuestion(route.params.id),
      api.getCategories(),
    ])
    question.value = q
    categories.value = cats

    // 如果有缓存的解析，自动显示
    if (q.analysis) {
      let cachedAnswer = []
      try { cachedAnswer = JSON.parse(q.ai_answer || '[]') } catch {}
      aiResult.value = {
        analysis: q.analysis,
        answer: cachedAnswer,
        model: '',
        provider: '',
        rawResponse: '',
        cached: true,
      }
      // 初始化流式缓存
      aiStreamCache.value = {
        analysis: q.analysis,
        answer: cachedAnswer,
        model: '',
        provider: '',
      }
    }
  } catch (e) {
    // handled
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function openEdit() {
  showEditForm.value = true
}

async function handleEditSubmit(formData) {
  try {
    await api.updateQuestion(question.value.id, formData)
    toast.success('更新成功')
    showEditForm.value = false
    question.value = await api.getQuestion(route.params.id)
  } catch (err) {
    if (err.status === 409 && err.data?.error === 'duplicate') {
      const ok = await confirm.show({
        title: '题目重复',
        message: '该题目已存在，是否强制更新？',
        confirmText: '强制更新',
        danger: true,
      })
      if (ok) {
        try {
          await api.updateQuestion(question.value.id, { ...formData, force: true })
          toast.success('更新成功')
          showEditForm.value = false
          question.value = await api.getQuestion(route.params.id)
        } catch (e) {
          // handled
        }
      }
    }
  }
}

async function handleDelete() {
  const ok = await confirm.show({
    title: '删除题目',
    message: '确定要删除这道题目吗？将移至回收站，可在回收站恢复。',
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return
  try {
    await api.deleteQuestion(question.value.id)
    toast.success('已移至回收站')
    router.push('/questions')
  } catch (e) {
    // handled
  }
}

async function handleAiAnalyze(forceRefresh = false) {
  // 如果正在生成中，直接打开弹窗查看进度
  if (isAiGenerating.value) {
    showAiModal.value = true
    aiTask.setModalOpen(true)
    return
  }

  // 如果已有缓存且不是强制刷新，弹窗确认是否覆盖
  if (question.value.analysis && !forceRefresh) {
    const ok = await confirm.show({
      title: '已有解析缓存',
      message: '该题目已有 AI 生成的解析，是否重新校验？新解析将覆盖旧内容。',
      confirmText: '重新校验',
      danger: false,
    })
    if (!ok) return
    forceRefresh = true
  }

  // 打开 AI 弹窗
  showAiModal.value = true
  aiTask.setModalOpen(true)
}

// AI 弹窗结果回调
function handleAiResult(result) {
  if (result && result.analysis) {
    aiResult.value = {
      analysis: result.analysis,
      answer: result.answer || [],
      model: result.model || '',
      provider: result.provider || '',
      rawResponse: '',
      cached: false,
    }
    // 更新本地缓存
    question.value.analysis = result.analysis
    question.value.ai_answer = JSON.stringify(result.answer || [])
    // 缓存流式结果
    aiStreamCache.value = {
      analysis: result.analysis,
      answer: result.answer || [],
      model: result.model || '',
      provider: result.provider || '',
    }
  }
}

// 关闭 AI 弹窗
function handleAiClose() {
  showAiModal.value = false
  aiTask.setModalOpen(false)
}

// 替换为 AI 答案 - 显示确认弹窗
async function handleReplaceWithAiAnswer() {
  if (!aiResult.value?.answer) return

  const aiAnswers = normalizeAnswer(aiResult.value.answer, renderOptions(question.value.options))
  pendingAiAnswers.value = aiAnswers
  showReplaceDialog.value = true
}

// 确认替换答案
async function handleReplaceConfirm() {
  const aiAnswers = pendingAiAnswers.value
  showReplaceDialog.value = false

  try {
    await api.updateQuestion(question.value.id, {
      type: question.value.type,
      content: question.value.content,
      options: question.value.options,
      answers: aiAnswers,
      category: question.value.category,
      images: question.value.images,
    })
    toast.success('答案已更新为 AI 答案')
    // 刷新题目数据
    question.value = await api.getQuestion(route.params.id)
  } catch (err) {
    if (err.status === 409 && err.data?.error === 'duplicate') {
      // 处理重复题目冲突
      const forceOk = await confirm.show({
        title: '题目重复',
        message: '该题目已存在，是否强制更新？',
        confirmText: '强制更新',
        danger: true,
      })
      if (forceOk) {
        try {
          await api.updateQuestion(question.value.id, {
            type: question.value.type,
            content: question.value.content,
            options: question.value.options,
            answers: aiAnswers,
            category: question.value.category,
            images: question.value.images,
            force: true,
          })
          toast.success('答案已更新为 AI 答案')
          question.value = await api.getQuestion(route.params.id)
        } catch (e) {
          // handled
        }
      }
    }
  }
}

// 取消替换
function handleReplaceCancel() {
  showReplaceDialog.value = false
  pendingAiAnswers.value = []
}

// 更新 AI 答案标记状态
async function handleUpdateAiStatus(status) {
  try {
    await api.updateQuestionAiStatus(question.value.id, status)
    question.value.ai_answer_status = status
    showStatusMenu.value = false
    toast.success(`已标记为「${statusConfig[status].label}」`)
  } catch (err) {
    // handled
  }
}

// 清除 AI 答案标记状态
async function handleClearAiStatus() {
  try {
    await api.updateQuestionAiStatus(question.value.id, null)
    question.value.ai_answer_status = null
    showStatusMenu.value = false
    toast.success('已清除标记')
  } catch (err) {
    // handled
  }
}

// 点击外部关闭状态菜单
function handleClickOutside(e) {
  if (statusMenuRef.value && !statusMenuRef.value.contains(e.target)) {
    showStatusMenu.value = false
  }
}

// 监听任务完成，同步状态到本地
watch(() => aiTask.task, (task) => {
  if (!task || !question.value) return
  // 只处理当前题目的任务
  if (task.questionId !== question.value.id) return

  if (task.status === 'completed' && task.result) {
    const result = task.result
    aiResult.value = {
      analysis: result.analysis,
      answer: result.answer || [],
      model: result.model || '',
      provider: result.provider || '',
      rawResponse: '',
      cached: false,
    }
    // 更新本地缓存
    question.value.analysis = result.analysis
    question.value.ai_answer = JSON.stringify(result.answer || [])
    // 缓存流式结果
    aiStreamCache.value = {
      analysis: result.analysis,
      answer: result.answer || [],
      model: result.model || '',
      provider: result.provider || '',
    }
  }
}, { deep: true })

function formatDateDisplay(dateStr) {
  return formatDate(dateStr, 'datetime')
}

function renderOptions(options) {
  if (!options) return []
  if (Array.isArray(options)) return options
  try { return JSON.parse(options) } catch { return [options] }
}

// 题目图片经后端代理加载，绕过图床防盗链（如超星 cldisk 校验 Referer）
function imgProxy(url) {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

function openImage(url) {
  window.open(url, '_blank')
}

function renderAnswers(answers) {
  if (!answers) return []
  if (Array.isArray(answers)) return answers
  try { return JSON.parse(answers) } catch { return [answers] }
}

function answersMatch(aiAnswers, currentAnswers) {
  if (!aiAnswers || !currentAnswers) return null
  const aiArr = Array.isArray(aiAnswers) ? aiAnswers : [aiAnswers]
  const curArr = Array.isArray(currentAnswers) ? currentAnswers : [currentAnswers]
  if (aiArr.length === 0 || curArr.length === 0) return null
  const options = renderOptions(question.value?.options)
  const a = [...normalizeAnswer(aiArr, options)].sort()
  const b = [...normalizeAnswer(curArr, options)].sort()
  return JSON.stringify(a) === JSON.stringify(b)
}

</script>

<template>
  <div>
    <!-- Back -->
    <button @click="router.push('/questions')" class="flex items-center gap-2 text-sm text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark mb-6 transition-colors">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
      </svg>
      返回题目列表
    </button>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
    </div>

    <!-- Not found -->
    <div v-else-if="!question" class="card text-center py-16">
      <p class="text-notion-muted dark:text-notion-muted-dark">题目不存在</p>
      <button @click="router.push('/questions')" class="btn-primary mt-4">返回列表</button>
    </div>

    <!-- Detail -->
    <template v-else>
      <div class="card mb-6">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div class="flex flex-wrap items-center gap-2">
            <span :class="['badge text-sm', TYPE_COLORS[question.type] || 'badge-type']">{{ question.type }}</span>
            <span class="badge badge-category text-sm">{{ question.category || '默认' }}</span>
            <span class="text-xs text-notion-muted dark:text-notion-muted-dark font-mono">#{{ question.id }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button @click="openEdit" class="btn-secondary text-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              编辑
            </button>
            <button @click="handleDelete" class="btn-danger text-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              删除
            </button>
            <button @click="handleAiAnalyze" :disabled="isAiGenerating" class="btn-primary text-sm">
              <svg v-if="isAiGenerating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>
              </svg>
              {{ aiButtonText }}
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="mb-6">
          <h3 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider mb-2">题目内容</h3>
          <p class="text-notion-text dark:text-notion-text-dark leading-relaxed whitespace-pre-wrap">{{ question.content }}</p>
        </div>

        <!-- Images -->
        <div v-if="question.images && question.images.length > 0" class="mb-6">
          <h3 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider mb-2">题目图片</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <img
              v-for="(url, i) in question.images"
              :key="i"
              :src="imgProxy(url)"
              class="w-full rounded-btn border border-notion-border dark:border-notion-border-dark cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
              @click="openImage(imgProxy(url))"
              @error="(e) => e.target.style.display='none'"
            />
          </div>
        </div>

        <!-- Options -->
        <div v-if="renderOptions(question.options).length" class="mb-6">
          <h3 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider mb-2">选项</h3>
          <div class="space-y-2">
            <div
              v-for="(opt, i) in renderOptions(question.options)"
              :key="i"
              class="flex items-start gap-3 p-3 rounded-btn bg-notion-surface border border-notion-border"
            >
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-accent-10 text-accent text-xs font-medium flex items-center justify-center">
                {{ String.fromCharCode(65 + i) }}
              </span>
              <span class="text-sm text-notion-text">{{ opt }}</span>
            </div>
          </div>
        </div>

        <!-- Answers -->
        <div v-if="renderAnswers(question.answers).length">
          <h3 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider mb-2">答案</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(ans, i) in renderAnswers(question.answers)"
              :key="i"
              class="px-3 py-1.5 rounded-badge bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm font-medium"
            >
              {{ ans }}
            </span>
          </div>
        </div>
      </div>

      <!-- AI Result -->
      <div v-if="aiError" class="card mb-6 border-l-4 border-red-400">
        <div class="flex items-center gap-2 text-red-600 dark:text-red-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm font-medium">{{ aiError }}</span>
        </div>
      </div>

      <div v-if="aiResult" class="card mb-6 border-l-4" :class="currentAiStatus
        ? statusConfig[currentAiStatus].color === 'green' ? 'border-green-400'
          : statusConfig[currentAiStatus].color === 'yellow' ? 'border-yellow-400'
          : 'border-red-400'
        : answersMatch(aiResult.answer, renderAnswers(question.answers)) === false ? 'border-amber-400' : 'border-green-400'">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>
          </svg>
          <h3 class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">AI 分析结果</h3>
          <span v-if="aiResult.cached" class="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">已缓存</span>
          <span v-if="aiResult.provider" class="text-xs text-notion-muted dark:text-notion-muted-dark">· {{ aiResult.provider }} ({{ aiResult.model }})</span>
        </div>

        <!-- Analysis -->
        <div class="mb-4">
          <h4 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">解析</h4>
          <p class="text-sm text-notion-text dark:text-notion-text-dark leading-relaxed">{{ aiResult.analysis }}</p>
        </div>

        <!-- AI Answer -->
        <div class="mb-3">
          <div class="flex items-center justify-between mb-1">
            <h4 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark">AI 答案</h4>
            <div class="flex items-center gap-2">
              <!-- 标记状态按钮（仅管理员可见） -->
              <div v-if="auth.isAdmin" class="relative" ref="statusMenuRef">
                <button
                  @click="showStatusMenu = !showStatusMenu"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded
                         transition-all duration-150"
                  :class="currentAiStatus
                    ? statusConfig[currentAiStatus].color === 'green'
                      ? 'bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                      : statusConfig[currentAiStatus].color === 'yellow'
                        ? 'bg-yellow-50 text-yellow-600 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
                        : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700'"
                >
                  <span v-if="currentAiStatus">{{ statusConfig[currentAiStatus].icon }}</span>
                  <span>{{ currentAiStatus ? statusConfig[currentAiStatus].label : '标记状态' }}</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                <!-- 下拉菜单 -->
                <Transition name="dropdown">
                  <div
                    v-if="showStatusMenu"
                    class="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-card shadow-lg border border-notion-border dark:border-notion-border-dark z-10"
                  >
                    <div class="py-1">
                      <button
                        v-for="(config, key) in statusConfig"
                        :key="key"
                        @click="handleUpdateAiStatus(key)"
                        class="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        :class="currentAiStatus === key ? 'bg-gray-50 dark:bg-gray-700' : ''"
                      >
                        <span :class="{
                          'text-green-500': config.color === 'green',
                          'text-yellow-500': config.color === 'yellow',
                          'text-red-500': config.color === 'red'
                        }">{{ config.icon }}</span>
                        <span class="text-notion-text dark:text-notion-text-dark">{{ config.label }}</span>
                        <svg v-if="currentAiStatus === key" class="w-4 h-4 ml-auto text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                      </button>
                      <div v-if="currentAiStatus" class="border-t border-notion-border dark:border-notion-border-dark">
                        <button
                          @click="handleClearAiStatus"
                          class="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          清除标记
                        </button>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- 使用此答案按钮（仅管理员可见） -->
              <button
                v-if="auth.isAdmin && answersMatch(aiResult.answer, renderAnswers(question.answers)) === false && currentAiStatus !== 'consistent' && currentAiStatus !== 'similar'"
                @click="handleReplaceWithAiAnswer"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded
                       bg-amber-50 text-amber-600 border border-amber-200
                       hover:bg-amber-100 hover:border-amber-300
                       dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800
                       dark:hover:bg-amber-900/30 dark:hover:border-amber-700
                       transition-all duration-150"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                使用此答案
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(ans, i) in normalizeAnswer(aiResult.answer, renderOptions(question.options))"
              :key="i"
              class="px-3 py-1.5 rounded-badge text-sm font-medium"
              :class="answersMatch(aiResult.answer, renderAnswers(question.answers))
                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
            >
              {{ ans }}
            </span>
          </div>
        </div>

        <!-- Match status -->
        <div v-if="currentAiStatus" class="flex items-center gap-2 text-sm mt-2"
          :class="{
            'text-green-600 dark:text-green-400': statusConfig[currentAiStatus].color === 'green',
            'text-yellow-600 dark:text-yellow-400': statusConfig[currentAiStatus].color === 'yellow',
            'text-red-600 dark:text-red-400': statusConfig[currentAiStatus].color === 'red'
          }"
        >
          <span class="font-medium">{{ statusConfig[currentAiStatus].icon }}</span>
          <span>已标记为「{{ statusConfig[currentAiStatus].label }}」</span>
        </div>
        <div v-else-if="answersMatch(aiResult.answer, renderAnswers(question.answers)) === true" class="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm mt-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          AI 答案与当前答案一致
        </div>
        <div v-else-if="answersMatch(aiResult.answer, renderAnswers(question.answers)) === false" class="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mt-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
          AI 答案与当前答案不同，请核实
        </div>
      </div>

      <!-- AI Raw Output -->
      <div v-if="aiResult?.rawResponse" class="card mb-6">
        <button
          @click="rawExpanded = !rawExpanded"
          class="w-full flex items-center justify-between text-sm text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark transition-colors"
        >
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
            </svg>
            <span class="font-medium">AI 原始输出</span>
          </div>
          <svg
            class="w-4 h-4 transition-transform duration-200"
            :class="rawExpanded ? 'rotate-180' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div v-if="rawExpanded" class="mt-3 pt-3 border-t border-notion-border dark:border-notion-border-dark">
          <pre class="text-xs font-mono bg-notion-surface dark:bg-notion-surface-dark p-4 rounded-btn overflow-x-auto whitespace-pre-wrap break-all leading-relaxed json-viewer" v-html="formatJson(aiResult.rawResponse)"></pre>
        </div>
      </div>

      <!-- Meta -->
      <div class="card">
        <h3 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider mb-3">元信息</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-notion-muted dark:text-notion-muted-dark">创建时间：</span>
            <span class="text-notion-text dark:text-notion-text-dark">{{ formatDateDisplay(question.created_at) }}</span>
          </div>
          <div>
            <span class="text-notion-muted dark:text-notion-muted-dark">更新时间：</span>
            <span class="text-notion-text dark:text-notion-text-dark">{{ formatDateDisplay(question.updated_at) }}</span>
          </div>
          <div>
            <span class="text-notion-muted dark:text-notion-muted-dark">MD5：</span>
            <span class="text-notion-text dark:text-notion-text-dark font-mono text-xs">{{ question.md5 || '-' }}</span>
          </div>
          <div>
            <span class="text-notion-muted dark:text-notion-muted-dark">分类：</span>
            <span class="badge badge-category">{{ question.category || '默认' }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit Modal -->
    <QuestionFormModal
      v-if="showEditForm"
      :question="question"
      :categories="categories"
      @close="showEditForm = false"
      @submit="handleEditSubmit"
    />

    <!-- AI Analyze Modal -->
    <AiAnalyzeModal
      v-if="showAiModal"
      :question="question"
      :cachedResult="aiStreamCache"
      @close="handleAiClose"
      @result="handleAiResult"
    />

    <!-- Replace Answer Dialog -->
    <ReplaceAnswerDialog
      v-if="showReplaceDialog"
      :currentAnswers="renderAnswers(question?.answers)"
      :aiAnswers="pendingAiAnswers"
      @confirm="handleReplaceConfirm"
      @cancel="handleReplaceCancel"
    />
  </div>
</template>

<style scoped>
/* 下拉菜单动画 */
.dropdown-enter-active {
  transition: all 0.2s ease-out;
}
.dropdown-leave-active {
  transition: all 0.15s ease-in;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
