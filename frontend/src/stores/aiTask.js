import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useAiTaskStore = defineStore('aiTask', () => {
  // 活动任务状态
  const task = ref(null)
  // task: { questionId, question, status, result, error, progress }
  // status: 'generating' | 'completed' | 'error'

  // 弹窗是否打开（用于控制悬浮球显示）
  const modalOpen = ref(false)

  // AbortController for cancelling
  let abortController = null

  const isGenerating = computed(() => task.value?.status === 'generating')
  const isCompleted = computed(() => task.value?.status === 'completed')
  const isError = computed(() => task.value?.status === 'error')
  const hasTask = computed(() => task.value !== null)

  // 开始新任务
  function startTask(question) {
    // 如果已有任务在运行，先取消
    if (abortController) {
      abortController.abort()
    }

    abortController = new AbortController()

    task.value = {
      questionId: question.id,
      question,
      status: 'generating',
      result: null,
      error: null,
      progress: 0,
      promptText: '',
      displayedText: '',
    }

    return abortController
  }

  // 更新进度
  function updateProgress(progress) {
    if (task.value) {
      task.value.progress = progress
    }
  }

  // 更新提示词
  function setPromptText(text) {
    if (task.value) {
      task.value.promptText = text
    }
  }

  // 追加显示文本
  function appendText(text) {
    if (task.value) {
      task.value.displayedText += text
    }
  }

  // 完成任务
  function completeTask(result) {
    if (task.value) {
      task.value.status = 'completed'
      task.value.result = result
      task.value.progress = 100
    }
  }

  // 任务出错
  function setError(error) {
    if (task.value) {
      task.value.status = 'error'
      task.value.error = error
    }
  }

  // 取消任务
  function cancelTask() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    task.value = null
  }

  // 清除任务（完成后）
  function clearTask() {
    task.value = null
    abortController = null
  }

  // 获取 AbortSignal
  function getSignal() {
    return abortController?.signal
  }

  // 设置弹窗状态
  function setModalOpen(open) {
    modalOpen.value = open
  }

  return {
    task,
    modalOpen,
    isGenerating,
    isCompleted,
    isError,
    hasTask,
    startTask,
    updateProgress,
    setPromptText,
    appendText,
    completeTask,
    setError,
    cancelTask,
    clearTask,
    getSignal,
    setModalOpen,
  }
})
