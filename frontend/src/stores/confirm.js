import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConfirmStore = defineStore('confirm', () => {
  const visible = ref(false)
  const title = ref('')
  const message = ref('')
  const confirmText = ref('确认')
  const cancelText = ref('取消')
  const danger = ref(false)
  let resolveFn = null

  function show(opts = {}) {
    title.value = opts.title || '确认操作'
    message.value = opts.message || '确定要执行此操作吗？'
    confirmText.value = opts.confirmText || '确认'
    cancelText.value = opts.cancelText || '取消'
    danger.value = opts.danger || false
    visible.value = true
    return new Promise((resolve) => {
      resolveFn = resolve
    })
  }

  function confirm() {
    visible.value = false
    if (resolveFn) resolveFn(true)
    resolveFn = null
  }

  function cancel() {
    visible.value = false
    if (resolveFn) resolveFn(false)
    resolveFn = null
  }

  return { visible, title, message, confirmText, cancelText, danger, show, confirm, cancel }
})
