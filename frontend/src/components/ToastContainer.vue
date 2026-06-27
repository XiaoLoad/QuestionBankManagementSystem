<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const iconMap = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
}

const colorMap = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-notion-accent dark:bg-notion-accent-dark',
}
</script>

<template>
  <div class="fixed z-[9999] space-y-2 max-w-sm w-full pointer-events-none toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="t in toast.toasts"
        :key="t.id"
        class="pointer-events-auto flex items-start gap-3 bg-white dark:bg-gray-800 rounded-card shadow-lg border border-notion-border dark:border-notion-border-dark p-4 toast-enter"
      >
        <div :class="['flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center', colorMap[t.type]]">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" :d="iconMap[t.type]"/>
          </svg>
        </div>
        <p class="text-sm text-notion-text dark:text-notion-text-dark flex-1">{{ t.message }}</p>
        <button @click="toast.remove(t.id)" class="flex-shrink-0 text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Toast 入场动画 - 从右侧滑入 + 弹性效果 */
.toast-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Toast 退场动画 - 向右滑出 */
.toast-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  transform: translateX(100%) scale(0.9);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%) scale(0.9);
  opacity: 0;
}

/* Toast 移动动画 */
.toast-move {
  transition: transform 0.3s ease;
}

/* Toast容器样式 - PC端 */
.toast-container {
  top: 1rem;
  right: 1rem;
  max-width: 24rem;
}

/* 移动端适配 - 顶部通栏 */
@media screen and (max-width: 639px) {
  .toast-container.toast-container {
    top: 0;
    right: 0;
    left: 0;
    max-width: 100%;
    width: 100%;
    padding: max(0.75rem, env(safe-area-inset-top, 0px)) 0.75rem 0.75rem;
    background: transparent;
  }

  /* 移动端 Toast 从下方滑入 */
  .toast-enter-from {
    transform: translateY(100%) scale(0.9);
  }
  .toast-leave-to {
    transform: translateY(100%) scale(0.9);
  }
}

/* 无障碍支持 */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.1s ease;
  }
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
