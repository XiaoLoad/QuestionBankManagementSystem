<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentAnswers: { type: Array, default: () => [] },
  aiAnswers: { type: Array, default: () => [] },
})

const emit = defineEmits(['confirm', 'cancel'])

const hasLongText = computed(() => {
  return props.currentAnswers.some(a => a.length > 50) || props.aiAnswers.some(a => a.length > 50)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-overlay">
      <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="emit('cancel')" />
        <Transition name="modal-content" appear>
          <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark max-w-lg w-full">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-notion-border dark:border-notion-border-dark">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  <h3 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark">替换答案</h3>
                </div>
                <button @click="emit('cancel')" class="p-1 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <svg class="w-5 h-5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">
                确定要将当前答案替换为 AI 给出的答案吗？
              </p>
            </div>

            <!-- Body -->
            <div class="px-6 py-4 space-y-4" :class="{ 'max-h-[60vh] overflow-y-auto': hasLongText }">
              <!-- Current Answer -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="w-2 h-2 rounded-full bg-gray-400"></span>
                  <span class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider">当前答案</span>
                </div>
                <div class="rounded-btn border border-notion-border dark:border-notion-border-dark bg-gray-50 dark:bg-gray-900/50 p-3 space-y-2">
                  <div
                    v-for="(ans, i) in currentAnswers"
                    :key="i"
                    class="text-sm text-notion-text dark:text-notion-text-dark"
                    :class="{ 'whitespace-pre-wrap break-words': ans.length > 50 }"
                  >
                    <span v-if="currentAnswers.length > 1" class="text-xs text-notion-muted dark:text-notion-muted-dark mr-2">{{ i + 1 }}.</span>
                    {{ ans }}
                  </div>
                  <div v-if="!currentAnswers.length" class="text-sm text-notion-muted dark:text-notion-muted-dark italic">
                    （无答案）
                  </div>
                </div>
              </div>

              <!-- Arrow -->
              <div class="flex justify-center">
                <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                </svg>
              </div>

              <!-- AI Answer -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span class="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">AI 答案</span>
                </div>
                <div class="rounded-btn border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3 space-y-2">
                  <div
                    v-for="(ans, i) in aiAnswers"
                    :key="i"
                    class="text-sm text-notion-text dark:text-notion-text-dark"
                    :class="{ 'whitespace-pre-wrap break-words': ans.length > 50 }"
                  >
                    <span v-if="aiAnswers.length > 1" class="text-xs text-amber-600 dark:text-amber-400 mr-2">{{ i + 1 }}.</span>
                    {{ ans }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-notion-border dark:border-notion-border-dark flex justify-end gap-3">
              <button @click="emit('cancel')" class="btn-secondary text-sm">
                取消
              </button>
              <button @click="emit('confirm')" class="btn-primary text-sm bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                确认替换
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
