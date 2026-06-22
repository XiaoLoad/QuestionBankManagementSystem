import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useQuizStore = defineStore('quiz', () => {
  // 从 localStorage 恢复
  const saved = JSON.parse(localStorage.getItem('quiz_progress') || 'null')

  const state = ref(saved?.state || 'setup')
  const questions = ref(saved?.questions || [])
  const currentIndex = ref(saved?.currentIndex || 0)
  const records = ref(saved?.records || [])
  const resultReported = ref(saved?.resultReported || false)
  const setupConfig = ref(saved?.setupConfig || {
    selectedCategory: '',
    selectedTypes: [],
    selectedMode: 'random',
    questionLimit: 20,
    autoAdvance: true,
    autoAdvanceDelay: 2,
    shuffleOptions: false,
  })

  const hasProgress = computed(() => {
    return state.value !== 'setup' && questions.value.length > 0
  })

  // 保存到 localStorage
  function saveProgress() {
    localStorage.setItem('quiz_progress', JSON.stringify({
      state: state.value,
      questions: questions.value,
      currentIndex: currentIndex.value,
      records: records.value,
      resultReported: resultReported.value,
      setupConfig: setupConfig.value,
    }))
  }

  // 清除进度
  function clearProgress() {
    localStorage.removeItem('quiz_progress')
    state.value = 'setup'
    questions.value = []
    currentIndex.value = 0
    records.value = []
    resultReported.value = false
  }

  // 恢复到刷题状态
  function restoreProgress() {
    const saved = JSON.parse(localStorage.getItem('quiz_progress') || 'null')
    if (saved && saved.questions && saved.questions.length > 0) {
      state.value = saved.state || 'quiz'
      questions.value = saved.questions
      currentIndex.value = saved.currentIndex || 0
      records.value = saved.records || []
      resultReported.value = saved.resultReported || false
      setupConfig.value = saved.setupConfig || setupConfig.value
      return true
    }
    return false
  }

  return {
    state,
    questions,
    currentIndex,
    records,
    resultReported,
    setupConfig,
    hasProgress,
    saveProgress,
    clearProgress,
    restoreProgress,
  }
})
