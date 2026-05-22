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
  <div class="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full pointer-events-none">
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
.toast-enter-active { transition: all 0.3s ease-out; }
.toast-leave-active { transition: all 0.3s ease-in; }
.toast-enter-from { transform: translateX(100%); opacity: 0; }
.toast-leave-to { transform: translateX(100%); opacity: 0; }
</style>
