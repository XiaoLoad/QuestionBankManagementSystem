import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 全局加载状态管理（顶部进度条）
 *
 * 计数式设计：每次 show() 计数 +1，hide() 计数 -1，只有归零时才真正隐藏，
 * 因此并发的多个异步任务互不干扰，不会出现「提前隐藏」或「无法隐藏」。
 *
 * @example 组件内（script setup）
 * import { useLoaderStore } from '@/stores/loader'
 * const loader = useLoaderStore()
 *
 * loader.show()                      // 显示
 * loader.show('正在保存...')          // 显示并带文案
 * loader.hide()                      // 隐藏
 * await loader.track(api.getStats()) // 包裹 Promise，自动 show/hide
 * await loader.run(async () => { ... }, '导入中')
 *
 * @example 组件外 / 全局（无需 import，main.js 已挂载）
 * window.$loader.show()
 * window.$loader.hide()
 * await window.$loader.track(fetch('/api/stats'))
 *
 * @example Options API
 * this.$loader.show() / this.$loader.hide()
 */

const MIN_VISIBLE_MS = 400 // 最短展示时长，避免一闪而过造成的闪烁感
const HIDE_FADE_MS = 260 // 淡出时长，需与组件 CSS 保持一致

export const useLoaderStore = defineStore('loader', () => {
  const pending = ref(0) // 未完成的任务计数
  const progress = ref(0) // 0 ~ 100，仅用于视觉表现
  const label = ref('') // 可选文案
  const shown = ref(false) // 控制整体显隐（含淡出）

  let phase = 'idle' // 'idle' | 'active' | 'finishing'
  let rafId = null
  let shownAt = 0
  let finishTimer = null

  const active = computed(() => pending.value > 0)
  const visible = computed(() => shown.value)

  function loop() {
    if (phase === 'active') {
      // 渐进逼近 90% 并停住，让用户感觉「还有事在做」但进度不虚报
      if (progress.value < 90) {
        progress.value = Math.min(90, progress.value + (90 - progress.value) * 0.14 + 0.5)
      }
    } else if (phase === 'finishing') {
      progress.value = Math.min(100, progress.value + Math.max(2.5, (100 - progress.value) * 0.35))
      if (progress.value >= 100) {
        stopLoop()
        // 保持 100% 的静止帧完成淡出，避免视觉回缩
        finishTimer = setTimeout(() => {
          shown.value = false
          progress.value = 0
          label.value = ''
          phase = 'idle' // 回到初始态，后续 show() 可重新驱动动画
        }, HIDE_FADE_MS)
        return
      }
    }
    rafId = requestAnimationFrame(loop)
  }

  function startLoop() {
    if (rafId == null) rafId = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  /** 显示加载条（计数 +1） */
  function show(text = '') {
    if (text) label.value = text
    pending.value += 1
    if (phase === 'finishing') {
      // 淡出途中又有新任务，重新回到递进阶段
      phase = 'active'
      startLoop()
    } else if (phase === 'idle') {
      phase = 'active'
      progress.value = Math.max(progress.value, 6)
      shown.value = true
      shownAt = performance.now()
      startLoop()
    }
  }

  /** 隐藏加载条（计数 -1，归零后淡出） */
  function hide() {
    if (pending.value === 0) return
    pending.value -= 1
    if (pending.value > 0) return

    // 保证最短展示时长
    const elapsed = performance.now() - shownAt
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed)
    setTimeout(() => {
      if (pending.value > 0) return // 期间又有新任务，重新进入 active
      phase = 'finishing'
      startLoop()
    }, delay)
  }

  /** 包裹 Promise，动 show / hide */
  async function track(promise, text = '') {
    show(text)
    try {
      return await promise
    } finally {
      hide()
    }
  }

  /** 包裹异步函数，自动 show / hide */
  async function run(fn, text = '') {
    show(text)
    try {
      return await (typeof fn === 'function' ? fn() : fn)
    } finally {
      hide()
    }
  }

  return { pending, progress, label, active, visible, show, hide, track, run }
})
