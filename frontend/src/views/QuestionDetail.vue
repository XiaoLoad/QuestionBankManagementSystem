<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useConfirmStore } from '@/stores/confirm'
import { TYPE_COLORS } from '@/composables/constants'
import { formatDate, formatJson } from '@/composables/utils'
import { normalizeAnswer } from '@/composables/utils'
import QuestionFormModal from '@/components/QuestionFormModal.vue'

defineOptions({ name: 'QuestionDetail' })

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToastStore()
const confirm = useConfirmStore()

const question = ref(null)
const loading = ref(true)
const categories = ref([])
const showEditForm = ref(false)

// AI analyze state
const analyzing = ref(false)
const aiResult = ref(null)
const aiError = ref('')
const rawExpanded = ref(false)

onMounted(async () => {
  try {
    const [q, cats] = await Promise.all([
      api.getQuestion(route.params.id),
      api.getCategories(),
    ])
    question.value = q
    categories.value = cats
  } catch (e) {
    // handled
  } finally {
    loading.value = false
  }
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

async function handleAiAnalyze() {
  analyzing.value = true
  aiResult.value = null
  aiError.value = ''
  try {
    const result = await api.analyzeQuestion({
      type: question.value.type,
      content: question.value.content,
      options: renderOptions(question.value.options),
      // 不传 answers！
    })
    aiResult.value = result
  } catch (err) {
    aiError.value = err.data?.error || 'AI 分析失败'
  } finally {
    analyzing.value = false
  }
}

function formatDateDisplay(dateStr) {
  return formatDate(dateStr, 'datetime')
}

function renderOptions(options) {
  if (!options) return []
  if (Array.isArray(options)) return options
  try { return JSON.parse(options) } catch { return [options] }
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
            <button @click="handleAiAnalyze" :disabled="analyzing" class="btn-primary text-sm">
              <svg v-if="analyzing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>
              </svg>
              {{ analyzing ? 'AI 分析中...' : 'AI 校验答案' }}
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="mb-6">
          <h3 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider mb-2">题目内容</h3>
          <p class="text-notion-text dark:text-notion-text-dark leading-relaxed whitespace-pre-wrap">{{ question.content }}</p>
        </div>

        <!-- Options -->
        <div v-if="renderOptions(question.options).length" class="mb-6">
          <h3 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider mb-2">选项</h3>
          <div class="space-y-2">
            <div
              v-for="(opt, i) in renderOptions(question.options)"
              :key="i"
              class="flex items-start gap-3 p-3 rounded-btn bg-notion-surface dark:bg-notion-surface-dark"
            >
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark text-xs font-medium flex items-center justify-center">
                {{ String.fromCharCode(65 + i) }}
              </span>
              <span class="text-sm text-notion-text dark:text-notion-text-dark">{{ opt }}</span>
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

      <div v-if="aiResult" class="card mb-6 border-l-4" :class="answersMatch(aiResult.answer, renderAnswers(question.answers)) === false ? 'border-amber-400' : 'border-green-400'">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>
          </svg>
          <h3 class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">AI 分析结果</h3>
          <span class="text-xs text-notion-muted dark:text-notion-muted-dark">· {{ aiResult.provider }} ({{ aiResult.model }})</span>
        </div>

        <!-- Analysis -->
        <div class="mb-4">
          <h4 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">解析</h4>
          <p class="text-sm text-notion-text dark:text-notion-text-dark leading-relaxed">{{ aiResult.analysis }}</p>
        </div>

        <!-- AI Answer -->
        <div class="mb-3">
          <h4 class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">AI 答案</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(ans, i) in aiResult.answer"
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
        <div v-if="answersMatch(aiResult.answer, renderAnswers(question.answers)) === true" class="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          AI 答案与当前答案一致
        </div>
        <div v-else-if="answersMatch(aiResult.answer, renderAnswers(question.answers)) === false" class="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
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
  </div>
</template>
