<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useAiTaskStore } from '@/stores/aiTask'
import gsap from 'gsap'

const emit = defineEmits(['click'])
const aiTask = useAiTaskStore()

const ballRef = ref(null)
const visible = ref(false)
const pulseRef = ref(null)
let pulseAnimation = null
let autoHideTimer = null

// 入场动画 - 简单弹出
const enterAnimation = () => {
  if (!ballRef.value) return
  gsap.fromTo(ballRef.value,
    { scale: 0, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
  )
}

// 退场动画
const leaveAnimation = () => {
  return new Promise((resolve) => {
    if (!ballRef.value) { resolve(); return }
    gsap.to(ballRef.value, {
      scale: 0, opacity: 0, y: 20,
      duration: 0.3, ease: 'power2.in',
      onComplete: resolve
    })
  })
}

// 脉冲动画
const startPulse = () => {
  if (!pulseRef.value) return
  pulseAnimation = gsap.to(pulseRef.value, {
    scale: 1.5, opacity: 0,
    duration: 1.5, repeat: -1, ease: 'power1.out'
  })
}

const stopPulse = () => {
  if (pulseAnimation) {
    pulseAnimation.kill()
    pulseAnimation = null
  }
}

// 检查并显示悬浮球
const checkAndShow = async () => {
  const task = aiTask.task
  // 只在弹窗关闭且有任务时显示
  if (!task || aiTask.modalOpen) {
    visible.value = false
    stopPulse()
    return
  }

  if (task.status === 'generating') {
    if (!visible.value) {
      visible.value = true
      await nextTick()
      enterAnimation()
    }
    startPulse()
  } else if (task.status === 'completed') {
    stopPulse()
    if (!visible.value) {
      visible.value = true
      await nextTick()
      enterAnimation()
    }
    // 3 秒后自动隐藏
    clearTimeout(autoHideTimer)
    autoHideTimer = setTimeout(async () => {
      await leaveAnimation()
      visible.value = false
      aiTask.clearTask()
    }, 3000)
  } else if (task.status === 'error') {
    stopPulse()
    if (!visible.value) {
      visible.value = true
      await nextTick()
      enterAnimation()
    }
    // 5 秒后自动隐藏
    clearTimeout(autoHideTimer)
    autoHideTimer = setTimeout(async () => {
      await leaveAnimation()
      visible.value = false
      aiTask.clearTask()
    }, 5000)
  }
}

// 监听任务状态变化
watch(() => aiTask.task, checkAndShow, { deep: true })

// 监听弹窗状态变化
watch(() => aiTask.modalOpen, (isOpen) => {
  if (!isOpen && aiTask.hasTask) {
    // 弹窗关闭且有任务，显示悬浮球
    nextTick(() => checkAndShow())
  } else if (isOpen) {
    // 弹窗打开，隐藏悬浮球
    visible.value = false
    stopPulse()
  }
})

// 组件挂载时检查
onMounted(() => {
  if (aiTask.hasTask && !aiTask.modalOpen) {
    checkAndShow()
  }
})

// 点击球
const handleClick = () => {
  emit('click')
}

onBeforeUnmount(() => {
  stopPulse()
  clearTimeout(autoHideTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible && aiTask.task"
        ref="ballRef"
        @click="handleClick"
        class="fixed bottom-6 right-6 z-[9998] cursor-pointer group"
      >
        <!-- 脉冲效果 -->
        <div
          v-if="aiTask.isGenerating"
          ref="pulseRef"
          class="absolute inset-0 rounded-full bg-purple-500"
        ></div>

        <!-- 主球体 -->
        <div
          :class="[
            'relative w-14 h-14 rounded-full shadow-lg flex flex-col items-center justify-center transition-colors',
            aiTask.isGenerating ? 'bg-purple-600' : aiTask.isCompleted ? 'bg-green-500' : 'bg-red-500'
          ]"
        >
          <!-- 生成中：旋转图标 -->
          <template v-if="aiTask.isGenerating">
            <svg class="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span class="text-[10px] text-white/80 mt-0.5">AI</span>
          </template>

          <!-- 完成：勾号 -->
          <template v-else-if="aiTask.isCompleted">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </template>

          <!-- 错误：感叹号 -->
          <template v-else>
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01"/>
            </svg>
          </template>
        </div>

        <!-- Hover 提示 -->
        <div class="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {{ aiTask.isGenerating ? 'AI 生成中...' : aiTask.isCompleted ? '点击查看结果' : '生成失败，点击查看详情' }}
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
