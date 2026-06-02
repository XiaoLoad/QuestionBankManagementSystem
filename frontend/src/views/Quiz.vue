<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { QUESTION_TYPES } from '@/composables/constants'
import SearchableSelect from '@/components/SearchableSelect.vue'

defineOptions({ name: 'Quiz' })

const api = useApi()
const toast = useToastStore()

// State: 'setup' | 'quiz' | 'result'
const state = ref('setup')
const loading = ref(false)

// Setup
const categories = ref([])
const selectedCategory = ref('')
const selectedTypes = ref([])
const selectedMode = ref('random')
const questionLimit = ref(20)
const autoAdvance = ref(true)

// Quiz
const questions = ref([])
const currentIndex = ref(0)
const userAnswer = ref(null)
const answered = ref(false)
const checkResult = ref(null)
const records = ref([]) // { id, correct, userAnswer, correctAnswer }
const countdown = ref(0)
let autoAdvanceTimer = null
let countdownTimer = null

onMounted(async () => {
  try { categories.value = await api.getCategories() } catch {}
})

const currentQuestion = computed(() => questions.value[currentIndex.value] || null)
const progress = computed(() => questions.value.length > 0 ? ((currentIndex.value + 1) / questions.value.length * 100).toFixed(0) : 0)
const correctCount = computed(() => records.value.filter(r => r.correct).length)
const accuracy = computed(() => records.value.length > 0 ? Math.round(correctCount.value / records.value.length * 100) : 0)
const wrongList = computed(() => records.value.filter(r => !r.correct))

async function startQuiz() {
  loading.value = true
  try {
    const res = await api.getQuizQuestions({
      category: selectedCategory.value,
      type: selectedTypes.value.length > 0 ? selectedTypes.value.join(',') : '',
      mode: selectedMode.value,
      limit: questionLimit.value,
    })
    if (res.items.length === 0) {
      toast.error('该分类下没有题目')
      return
    }
    questions.value = res.items
    currentIndex.value = 0
    records.value = []
    resetAnswer()
    state.value = 'quiz'
  } catch (e) {
    // handled
  } finally {
    loading.value = false
  }
}

function clearAutoAdvance() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
  countdown.value = 0
}

function resetAnswer() {
  clearAutoAdvance()
  answered.value = false
  checkResult.value = null
  const q = currentQuestion.value
  if (!q) return
  if (q.type === '多选题') {
    userAnswer.value = []
  } else {
    userAnswer.value = ''
  }
}

function selectOption(opt) {
  if (answered.value) return
  const q = currentQuestion.value
  if (q.type === '多选题') {
    const idx = userAnswer.value.indexOf(opt)
    if (idx >= 0) {
      userAnswer.value.splice(idx, 1)
    } else {
      userAnswer.value.push(opt)
    }
  } else {
    userAnswer.value = opt
    if (autoAdvance.value) submitAndAutoAdvance()
  }
}

function selectBool(val) {
  if (answered.value) return
  userAnswer.value = val
  if (autoAdvance.value) submitAndAutoAdvance()
}

async function submitAndAutoAdvance() {
  await submitAnswer(true)
}

async function submitAnswer(autoAdvance = false) {
  const q = currentQuestion.value
  if (!q) return

  // Validate
  if (q.type === '多选题') {
    if (userAnswer.value.length === 0) { toast.error('请选择答案'); return }
  } else if (q.type === '填空题' || q.type === '简答题') {
    if (!userAnswer.value || !userAnswer.value.trim()) { toast.error('请输入答案'); return }
  } else {
    if (!userAnswer.value && userAnswer.value !== 0) { toast.error('请选择答案'); return }
  }

  loading.value = true
  try {
    const res = await api.checkQuizAnswer(q.id, userAnswer.value)
    checkResult.value = res
    answered.value = true
    records.value.push({
      id: q.id,
      content: q.content,
      type: q.type,
      correct: res.correct,
      userAnswer: res.userAnswer,
      correctAnswer: res.correctAnswers,
    })
    if (autoAdvance) {
      countdown.value = 2
      countdownTimer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) { clearInterval(countdownTimer); countdownTimer = null }
      }, 1000)
      autoAdvanceTimer = setTimeout(() => {
        goNext()
      }, 2000)
    }
  } catch (e) {
    // handled
  } finally {
    loading.value = false
  }
}

function goNext() {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    resetAnswer()
  } else {
    state.value = 'result'
  }
}

function goPrev() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    // Don't allow re-answer, just view
    const rec = records.value.find(r => r.id === currentQuestion.value?.id)
    if (rec) {
      answered.value = true
      checkResult.value = { correct: rec.correct, correctAnswers: rec.correctAnswer, userAnswer: rec.userAnswer }
      userAnswer.value = rec.userAnswer
    } else {
      resetAnswer()
    }
  }
}

function jumpTo(idx) {
  currentIndex.value = idx
  const rec = records.value.find(r => r.id === currentQuestion.value?.id)
  if (rec) {
    answered.value = true
    checkResult.value = { correct: rec.correct, correctAnswers: rec.correctAnswer, userAnswer: rec.userAnswer }
    userAnswer.value = rec.userAnswer
  } else {
    resetAnswer()
  }
}

function endQuiz() {
  if (records.value.length === 0) {
    state.value = 'setup'
    return
  }
  state.value = 'result'
}

function restart() {
  state.value = 'setup'
  questions.value = []
  records.value = []
}

function retryWrong() {
  if (wrongList.value.length === 0) return
  // Re-fetch the wrong questions
  const wrongIds = wrongList.value.map(r => r.id)
  questions.value = questions.value.filter(q => wrongIds.includes(q.id))
  currentIndex.value = 0
  records.value = []
  resetAnswer()
  state.value = 'quiz'
}

function isOptionSelected(opt) {
  if (Array.isArray(userAnswer.value)) return userAnswer.value.includes(opt)
  return userAnswer.value === opt
}

function getOptionClass(opt) {
  if (!answered.value) {
    return isOptionSelected(opt)
      ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/5 dark:bg-notion-accent-dark/10'
      : 'border-notion-border dark:border-notion-border-dark hover:border-gray-300 dark:hover:border-gray-600'
  }
  const q = currentQuestion.value
  const isCorrect = checkResult.value?.correctAnswers?.includes(opt)
  const isUserSelected = isOptionSelected(opt)
  if (isCorrect) return 'border-green-400 bg-green-50 dark:bg-green-900/20'
  if (isUserSelected && !isCorrect) return 'border-red-400 bg-red-50 dark:bg-red-900/20'
  return 'border-notion-border dark:border-notion-border-dark opacity-50'
}

function getBoolClass(val) {
  if (!answered.value) {
    return userAnswer.value === val
      ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/5 dark:bg-notion-accent-dark/10'
      : 'border-notion-border dark:border-notion-border-dark hover:border-gray-300 dark:hover:border-gray-600'
  }
  const correctVal = checkResult.value?.correctAnswers?.[0]
  const normalizedCorrect = (correctVal === '对' || correctVal === '正确') ? '对' : '错'
  const isCorrect = val === normalizedCorrect
  const isUserSelected = userAnswer.value === val
  if (isCorrect) return 'border-green-400 bg-green-50 dark:bg-green-900/20'
  if (isUserSelected && !isCorrect) return 'border-red-400 bg-red-50 dark:bg-red-900/20'
  return 'border-notion-border dark:border-notion-border-dark opacity-50'
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex-shrink-0 mb-6">
      <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">刷题</h1>
      <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">选择分类，开始练习</p>
    </div>

    <!-- Setup -->
    <div v-if="state === 'setup'" class="card max-w-xl">
      <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark mb-4">刷题设置</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">选择分类</label>
          <SearchableSelect
            v-model="selectedCategory"
            :options="categories.map(c => ({ label: c.name + '（' + c.question_count + '题）', value: c.name }))"
            allLabel="全部分类"
            placeholder="全部分类"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">题型（可多选，不选则全部）</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="t in QUESTION_TYPES"
              :key="t"
              type="button"
              @click="selectedTypes.includes(t) ? selectedTypes.splice(selectedTypes.indexOf(t), 1) : selectedTypes.push(t)"
              :class="[
                'px-3 py-1.5 rounded-btn text-xs font-medium border transition-colors',
                selectedTypes.includes(t)
                  ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark'
                  : 'border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark hover:border-gray-300 dark:hover:border-gray-600'
              ]"
            >{{ t }}</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">出题顺序</label>
            <select v-model="selectedMode" class="select-field w-full">
              <option value="random">随机</option>
              <option value="sequential">顺序</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">题目数量</label>
            <input v-model.number="questionLimit" type="number" min="1" max="200" class="input-field w-full" />
          </div>
        </div>
        <label class="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            @click="autoAdvance = !autoAdvance"
            :class="[
              'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
              autoAdvance ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-200 dark:bg-gray-700'
            ]"
          >
            <span
              :class="[
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                autoAdvance ? 'translate-x-5' : 'translate-x-0'
              ]"
            />
          </button>
          <span class="text-sm text-notion-text dark:text-notion-text-dark">自动下一题</span>
          <span class="text-xs text-notion-muted dark:text-notion-muted-dark">单选/判断题答完自动跳转</span>
        </label>
        <button @click="startQuiz" :disabled="loading" class="btn-primary w-full justify-center">
          {{ loading ? '加载中...' : '开始刷题' }}
        </button>
      </div>
    </div>

    <!-- Quiz -->
    <template v-if="state === 'quiz' && currentQuestion">
      <!-- Progress bar -->
      <div class="flex-shrink-0 mb-4">
        <div class="flex items-center justify-between text-xs text-notion-muted dark:text-notion-muted-dark mb-1.5">
          <span>{{ currentIndex + 1 }} / {{ questions.length }}</span>
          <span>正确 {{ correctCount }} / 已答 {{ records.length }} ({{ accuracy }}%)</span>
        </div>
        <div class="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div class="h-full bg-notion-accent dark:bg-notion-accent-dark rounded-full transition-all duration-300" :style="{ width: progress + '%' }" />
        </div>
      </div>

      <!-- Question card -->
      <div class="card flex-1 min-h-0 flex flex-col overflow-hidden">
        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto pr-1">
          <div class="flex items-center gap-2 mb-4">
            <span class="badge badge-type">{{ currentQuestion.type }}</span>
            <span class="badge badge-category">{{ currentQuestion.category }}</span>
          </div>

          <p class="text-base text-notion-text dark:text-notion-text-dark leading-relaxed whitespace-pre-wrap mb-4">{{ currentQuestion.content }}</p>

          <!-- Images -->
          <div v-if="currentQuestion.images && currentQuestion.images.length > 0" class="mb-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <img
                v-for="(url, i) in currentQuestion.images"
                :key="i"
                :src="url"
                class="max-w-full rounded-btn border border-notion-border dark:border-notion-border-dark"
                loading="lazy"
                @error="(e) => e.target.style.display='none'"
              />
            </div>
          </div>

          <!-- Options: 单选 / 多选 -->
          <div v-if="['单选题', '多选题'].includes(currentQuestion.type) && currentQuestion.options" class="space-y-2 mb-4">
            <button
              v-for="(opt, i) in currentQuestion.options"
              :key="i"
              @click="selectOption(opt)"
              :class="['w-full text-left px-4 py-3 rounded-btn border-2 transition-all text-sm', getOptionClass(opt)]"
            >
              <span class="font-medium mr-2 text-notion-muted dark:text-notion-muted-dark">{{ String.fromCharCode(65 + i) }}.</span>
              {{ opt }}
            </button>
          </div>

          <!-- 判断题 -->
          <div v-if="currentQuestion.type === '判断题'" class="flex gap-4 mb-4">
            <button
              @click="selectBool('对')"
              :class="['flex-1 py-4 rounded-btn border-2 text-base font-medium text-center transition-all', getBoolClass('对')]"
            >对</button>
            <button
              @click="selectBool('错')"
              :class="['flex-1 py-4 rounded-btn border-2 text-base font-medium text-center transition-all', getBoolClass('错')]"
            >错</button>
          </div>

          <!-- 填空 / 简答 -->
          <div v-if="['填空题', '简答题'].includes(currentQuestion.type)" class="mb-4">
            <textarea
              v-model="userAnswer"
              rows="3"
              class="input-field w-full"
              placeholder="请输入你的答案..."
              :disabled="answered"
            />
          </div>

          <!-- Answer feedback -->
          <div v-if="answered && checkResult" class="mb-4 p-4 rounded-btn" :class="checkResult.correct ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'">
            <div class="flex items-center gap-2 mb-1">
              <span v-if="checkResult.correct" class="text-green-600 dark:text-green-400 font-medium text-sm">回答正确</span>
              <span v-else class="text-red-600 dark:text-red-400 font-medium text-sm">回答错误</span>
            </div>
            <div v-if="!checkResult.correct" class="text-sm text-notion-text dark:text-notion-text-dark">
              正确答案：<span class="font-medium text-green-600 dark:text-green-400">{{ checkResult.correctAnswers?.join('、') }}</span>
            </div>
            <div v-if="countdown > 0" class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">{{ countdown }} 秒后自动下一题</div>
          </div>
        </div>

        <!-- Actions (fixed at bottom) -->
        <div class="flex-shrink-0 flex items-center justify-between pt-4 border-t border-notion-border dark:border-notion-border-dark">
          <button @click="goPrev" :disabled="currentIndex === 0" class="btn-secondary" :class="currentIndex === 0 ? 'opacity-50' : ''">上一题</button>
          <template v-if="!answered">
            <button v-if="!autoAdvance || ['多选题', '填空题', '简答题'].includes(currentQuestion.type)" @click="submitAnswer()" :disabled="loading" class="btn-primary">
              {{ loading ? '提交中...' : '提交答案' }}
            </button>
            <span v-else class="text-xs text-notion-muted dark:text-notion-muted-dark">选择后自动判题</span>
          </template>
          <button v-else @click="goNext" class="btn-primary">
            {{ currentIndex < questions.length - 1 ? '下一题' : '查看结果' }}
          </button>
        </div>
      </div>

      <!-- Bottom: question navigator + end button -->
      <div class="flex-shrink-0 mt-4 flex items-center gap-3">
        <button @click="endQuiz" class="btn-danger text-xs py-1.5 px-3">结束刷题</button>
        <div class="flex-1 overflow-x-auto">
          <div class="flex gap-1.5">
            <button
              v-for="(q, i) in questions"
              :key="q.id"
              @click="jumpTo(i)"
              class="w-8 h-8 rounded text-xs font-medium flex-shrink-0 transition-colors"
              :class="i === currentIndex
                ? 'bg-notion-accent text-white'
                : records.find(r => r.id === q.id)
                  ? (records.find(r => r.id === q.id).correct ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')
                  : 'bg-gray-100 dark:bg-gray-800 text-notion-muted dark:text-notion-muted-dark'"
            >{{ i + 1 }}</button>
          </div>
        </div>
      </div>
    </template>

    <!-- Result -->
    <div v-if="state === 'result'" class="card max-w-2xl">
      <h2 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark mb-6">刷题结果</h2>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="text-center p-4 rounded-btn bg-notion-surface dark:bg-notion-surface-dark">
          <p class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">{{ questions.length }}</p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">总题数</p>
        </div>
        <div class="text-center p-4 rounded-btn bg-green-50 dark:bg-green-900/20">
          <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ correctCount }}</p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">正确</p>
        </div>
        <div class="text-center p-4 rounded-btn" :class="accuracy >= 60 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'">
          <p class="text-2xl font-bold" :class="accuracy >= 60 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">{{ accuracy }}%</p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">正确率</p>
        </div>
      </div>

      <!-- Wrong list -->
      <div v-if="wrongList.length > 0" class="mb-6">
        <h3 class="text-sm font-medium text-notion-text dark:text-notion-text-dark mb-3">错题列表（{{ wrongList.length }} 题）</h3>
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <div v-for="(r, i) in wrongList" :key="i" class="p-3 rounded-btn bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
            <div class="flex items-center gap-2 mb-1">
              <span class="badge badge-type text-xs">{{ r.type }}</span>
            </div>
            <p class="text-sm text-notion-text dark:text-notion-text-dark line-clamp-2">{{ r.content }}</p>
            <div class="text-xs mt-1">
              <span class="text-red-500">你的答案：{{ Array.isArray(r.userAnswer) ? r.userAnswer.join('、') : r.userAnswer }}</span>
              <span class="text-green-500 ml-3">正确答案：{{ r.correctAnswer?.join('、') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <button @click="restart" class="btn-secondary flex-1">返回设置</button>
        <button v-if="wrongList.length > 0" @click="retryWrong" class="btn-primary flex-1">错题重练 ({{ wrongList.length }})</button>
      </div>
    </div>
  </div>
</template>
