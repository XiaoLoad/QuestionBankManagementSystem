<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import gsap from 'gsap'
import { useAiTaskStore } from '@/stores/aiTask'

const props = defineProps({
  question: { type: Object, required: true },
  cachedResult: { type: Object, default: null },
  onClose: { type: Function, required: true },
  onResult: { type: Function, default: null }
})

const emit = defineEmits(['close', 'result'])
const aiTask = useAiTaskStore()

// Refs
const modalRef = ref(null)
const overlayRef = ref(null)
const contentRef = ref(null)
const promptRef = ref(null)
const responseRef = ref(null)

// Local state
const loading = ref(true)
const error = ref('')
const promptText = ref('')
const displayedText = ref('')
const isTyping = ref(false)
const isDone = ref(false)
const resultData = ref(null)
const isFromCache = ref(false)

// Typewriter
let typewriterTimer = null
let charQueue = []

// GSAP 入场动画
const enterAnimation = () => {
  const tl = gsap.timeline()

  tl.fromTo(overlayRef.value,
    { opacity: 0 },
    { opacity: 1, duration: 0.3, ease: 'power2.out' }
  )

  tl.fromTo(modalRef.value,
    { opacity: 0, scale: 0.9, y: 30 },
    { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' },
    '-=0.15'
  )

  tl.fromTo(contentRef.value,
    { opacity: 0, y: 15 },
    { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
    '-=0.2'
  )

  return tl
}

// GSAP 退场动画 - 简单关闭
const leaveAnimation = () => {
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve })

    tl.to(contentRef.value, {
      opacity: 0, y: -10, duration: 0.15, ease: 'power2.in'
    })

    tl.to(modalRef.value, {
      opacity: 0, scale: 0.95, y: 20, duration: 0.2, ease: 'power2.in'
    }, '-=0.1')

    tl.to(overlayRef.value, {
      opacity: 0, duration: 0.15, ease: 'power2.in'
    }, '-=0.1')
  })
}

// 打字机效果 - 批量处理提高速度
const processQueue = () => {
  if (charQueue.length === 0) {
    isTyping.value = false
    return
  }

  isTyping.value = true

  // 每次处理多个字符，提高速度
  const batchSize = 3
  const batch = charQueue.splice(0, batchSize)
  const text = batch.join('')
  displayedText.value += text
  aiTask.appendText(text)

  // 自动滚动到底部
  nextTick(() => {
    if (responseRef.value) {
      responseRef.value.scrollTop = responseRef.value.scrollHeight
    }
  })

  // 减少延迟到 10ms
  typewriterTimer = setTimeout(processQueue, 10)
}

const addToQueue = (text) => {
  charQueue.push(...text.split(''))
  if (!isTyping.value) {
    processQueue()
  }
}

// 同步全局任务状态到本地
const syncFromStore = () => {
  const task = aiTask.task
  if (!task) return

  loading.value = task.status === 'generating' && !task.promptText
  promptText.value = task.promptText || ''
  displayedText.value = task.displayedText || ''
  error.value = task.error || ''
  isDone.value = task.status === 'completed' || task.status === 'error'

  if (task.status === 'completed' && task.result) {
    resultData.value = task.result
  }
}

// 监听全局状态变化
watch(() => aiTask.task, (newTask) => {
  if (newTask) {
    syncFromStore()
  }
}, { deep: true })

// 开始流式请求
const startStream = async () => {
  // 如果已有任务在运行，同步状态即可
  if (aiTask.isGenerating && aiTask.task?.questionId === props.question.id) {
    syncFromStore()
    return
  }

  // 开始新任务
  const controller = aiTask.startTask(props.question)
  loading.value = true
  error.value = ''
  displayedText.value = ''
  promptText.value = ''
  charQueue = []
  isDone.value = false
  isFromCache.value = false
  resultData.value = null

  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/ai/analyze-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: props.question.type,
        content: props.question.content,
        options: props.question.options || []
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `请求失败: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'prompt') {
                promptText.value = data.content
                aiTask.setPromptText(data.content)
                loading.value = false
              } else if (data.type === 'chunk') {
                addToQueue(data.content)
              } else if (data.type === 'done') {
                resultData.value = data
                isDone.value = true
                aiTask.completeTask(data)
              } else if (data.type === 'error') {
                error.value = data.message
                loading.value = false
                aiTask.setError(data.message)
              }
            } catch (parseErr) {
              console.warn('SSE parse error:', parseErr)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      error.value = err.message || '请求失败，请检查网络连接'
      aiTask.setError(err.message)
      console.error('Stream error:', err)
    }
    loading.value = false
  }
}

// 停止生成（取消任务）
const stopGeneration = () => {
  aiTask.cancelTask()
  clearTimeout(typewriterTimer)
  isTyping.value = false
  isDone.value = true
}

// 关闭弹窗（不中断任务）
const handleClose = async () => {
  clearTimeout(typewriterTimer)
  isTyping.value = false

  // 如果任务还在运行，不要取消它
  // 只关闭弹窗，悬浮球会自动显示

  await leaveAnimation()

  if (resultData.value && props.onResult) {
    props.onResult(resultData.value)
  }

  emit('close')
}

// 格式化选项
const formatOptions = (options) => {
  if (!options) return []
  if (Array.isArray(options)) return options
  try { return JSON.parse(options) } catch { return [options] }
}

// 重新生成
const handleRegenerate = () => {
  displayedText.value = ''
  charQueue = []
  resultData.value = null
  isDone.value = false
  isFromCache.value = false
  startStream()
}

onMounted(async () => {
  await nextTick()
  enterAnimation()

  // 检查是否有正在运行的任务（当前题目）
  if (aiTask.task?.questionId === props.question.id) {
    // 同步已有任务状态（无论是否完成）
    syncFromStore()

    // 如果任务还在运行，监听后续更新
    if (aiTask.isGenerating) {
      // 任务已在运行，只需同步状态
    }
  } else if (props.cachedResult) {
    // 显示缓存结果
    promptText.value = '（已缓存的解析结果）'
    displayedText.value = props.cachedResult.analysis || ''
    resultData.value = props.cachedResult
    isDone.value = true
    isFromCache.value = true
    loading.value = false
  } else {
    // 开始新任务
    startStream()
  }
})

onBeforeUnmount(() => {
  // 只清理本地定时器，不取消全局任务
  clearTimeout(typewriterTimer)
  isTyping.value = false
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <!-- Overlay -->
      <div
        ref="overlayRef"
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        @click="handleClose"
      ></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-notion-border dark:border-notion-border-dark flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div class="flex-shrink-0 px-4 py-3 border-b border-notion-border dark:border-notion-border-dark flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            <h2 class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">AI 校验答案</h2>
          </div>
          <button
            @click="handleClose"
            class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg class="w-4 h-4 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div ref="contentRef" class="flex-1 overflow-y-auto">
          <!-- Loading -->
          <div v-if="loading" class="flex items-center justify-center py-16">
            <div class="text-center">
              <div class="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark">正在连接 AI...</p>
            </div>
          </div>

          <!-- Error -->
          <div v-else-if="error" class="flex items-center justify-center py-16">
            <div class="text-center">
              <svg class="w-10 h-10 mx-auto mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p class="text-sm text-red-600 dark:text-red-400 mb-3">{{ error }}</p>
              <button @click="startStream" class="btn-secondary text-xs">重试</button>
            </div>
          </div>

          <!-- Content -->
          <template v-else>
            <!-- User Prompt -->
            <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-notion-border dark:border-notion-border-dark">
              <div class="flex items-center gap-2 mb-1.5">
                <svg class="w-3.5 h-3.5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <span class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark">提问词</span>
              </div>
              <div ref="promptRef" class="text-xs text-notion-text dark:text-notion-text-dark leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                {{ promptText }}
              </div>
            </div>

            <!-- AI Response -->
            <div class="p-4">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                <span class="text-xs font-medium text-notion-text dark:text-notion-text-dark">AI 解析</span>
                <span v-if="isTyping" class="text-[10px] text-purple-500 dark:text-purple-400 animate-pulse">生成中...</span>
                <span v-else-if="isDone" class="text-[10px] text-green-600 dark:text-green-400">完成</span>
              </div>
              <div
                ref="responseRef"
                class="text-sm text-notion-text dark:text-notion-text-dark leading-relaxed whitespace-pre-wrap max-h-[50vh] overflow-y-auto"
              >
                <!-- 加载动画：等待 AI 开始输出 -->
                <div v-if="!displayedText && !isDone && !error" class="space-y-2 py-2">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style="animation-delay: 0ms"></div>
                    <div class="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style="animation-delay: 300ms"></div>
                    <span class="text-xs text-notion-muted dark:text-notion-muted-dark ml-1">AI 正在思考...</span>
                  </div>
                  <div class="space-y-1.5">
                    <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
                    <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                    <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-5/6"></div>
                  </div>
                </div>
                <!-- 正常内容 -->
                <template v-else>
                  {{ displayedText }}<span v-if="isTyping" class="inline-block w-0.5 h-3.5 bg-purple-500 dark:bg-purple-400 animate-pulse ml-0.5"></span>
                </template>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex-shrink-0 px-4 py-2.5 border-t border-notion-border dark:border-notion-border-dark flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              v-if="!isDone && !loading && !error"
              @click="stopGeneration"
              class="text-xs px-2.5 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-notion-muted dark:text-notion-muted-dark hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              停止生成
            </button>
            <button
              v-if="isDone && props.cachedResult"
              @click="handleRegenerate"
              class="text-xs px-2.5 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-notion-muted dark:text-notion-muted-dark hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              重新生成
            </button>
          </div>
          <button @click="handleClose" class="text-xs px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors">
            {{ isDone ? '完成' : '关闭' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
