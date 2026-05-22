import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useQuestionsPageStore = defineStore('questionsPage', () => {
  const saved = ref(null)

  function save(state) {
    saved.value = { ...state }
  }

  function restore() {
    const s = saved.value
    saved.value = null
    return s
  }

  function hasSaved() {
    return saved.value !== null
  }

  return { saved, save, restore, hasSaved }
})
