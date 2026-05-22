import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTrashStore = defineStore('trash', () => {
  const count = ref(0)
  function setCount(n) { count.value = n }
  function decrement(n = 1) { count.value = Math.max(0, count.value - n) }
  function increment(n = 1) { count.value += n }
  function clear() { count.value = 0 }
  return { count, setCount, decrement, increment, clear }
})
