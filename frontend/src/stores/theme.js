import { defineStore } from 'pinia'
import { ref } from 'vue'
import { applyTheme } from '@/themes'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)
  const themeColor = ref('purple')
  let isTransitioning = false

  function init() {
    // 初始化暗色模式
    const savedMode = localStorage.getItem('theme')
    if (savedMode === 'dark' || (!savedMode && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      isDark.value = true
    }
    document.documentElement.classList.toggle('dark', isDark.value)

    // 初始化主题色
    const savedColor = localStorage.getItem('themeColor')
    if (savedColor) {
      themeColor.value = savedColor
    }
    applyTheme(themeColor.value, isDark.value)
  }

  // 使用 requestAnimationFrame 确保过渡平滑
  function enableTransition() {
    if (isTransitioning) return
    isTransitioning = true
    document.documentElement.classList.add('theme-transitioning')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.documentElement.classList.remove('theme-transitioning')
          isTransitioning = false
        }, 300)
      })
    })
  }

  function toggle() {
    enableTransition()
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', isDark.value)
    applyTheme(themeColor.value, isDark.value)
  }

  function setThemeColor(color) {
    enableTransition()
    themeColor.value = color
    localStorage.setItem('themeColor', color)
    applyTheme(color, isDark.value)
  }

  return { isDark, themeColor, init, toggle, setThemeColor }
})
