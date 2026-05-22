<script setup>
import { ref } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  paginationRange: { type: Array, required: true },
})
const emit = defineEmits(['update:page', 'update:pageSize', 'goToPage'])

const jumpPage = ref('')

function onPageSizeChange(e) {
  emit('update:pageSize', parseInt(e.target.value))
}

function handleJump() {
  const p = parseInt(jumpPage.value)
  if (!isNaN(p) && p >= 1 && p <= props.totalPages) {
    emit('goToPage', p)
  }
  jumpPage.value = ''
}
</script>

<template>
  <div class="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-notion-border dark:border-notion-border-dark bg-white dark:bg-gray-800">
    <div class="flex items-center gap-3 text-xs text-notion-muted dark:text-notion-muted-dark">
      <span>第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</span>
      <div v-if="totalPages > 5" class="flex items-center gap-1.5">
        <span>跳至</span>
        <input
          v-model="jumpPage"
          @keyup.enter="handleJump"
          type="number"
          :min="1"
          :max="totalPages"
          class="w-14 px-2 py-1 text-xs border border-notion-border dark:border-notion-border-dark rounded-btn bg-white dark:bg-notion-surface-dark text-notion-text dark:text-notion-text-dark text-center focus:outline-none focus:ring-1 focus:ring-notion-accent/30 focus:border-notion-accent dark:focus:ring-notion-accent-dark/30 dark:focus:border-notion-accent-dark"
          placeholder="页码"
        />
        <button @click="handleJump" class="px-2 py-1 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">GO</button>
      </div>
      <select :value="pageSize" @change="onPageSizeChange" class="select-field text-xs py-1 px-2">
        <option :value="10">10 条/页</option>
        <option :value="20">20 条/页</option>
        <option :value="50">50 条/页</option>
        <option :value="100">100 条/页</option>
      </select>
    </div>
    <div class="flex items-center gap-1">
      <button @click="emit('goToPage', 1)" :disabled="page <= 1" class="px-2 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="首页">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
      </button>
      <button @click="emit('goToPage', page - 1)" :disabled="page <= 1" class="px-2 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="上一页">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <template v-for="(p, i) in paginationRange" :key="i">
        <span v-if="p === '...'" class="px-2 py-1.5 text-xs text-notion-muted dark:text-notion-muted-dark">...</span>
        <button
          v-else
          @click="emit('goToPage', p)"
          :class="[
            'px-3 py-1.5 text-xs rounded-btn border transition-colors',
            p === page
              ? 'bg-notion-accent dark:bg-notion-accent-dark text-white border-notion-accent dark:border-notion-accent-dark'
              : 'border-notion-border dark:border-notion-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 text-notion-text dark:text-notion-text-dark'
          ]"
        >
          {{ p }}
        </button>
      </template>
      <button @click="emit('goToPage', page + 1)" :disabled="page >= totalPages" class="px-2 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="下一页">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>
      <button @click="emit('goToPage', totalPages)" :disabled="page >= totalPages" class="px-2 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="末页">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
      </button>
    </div>
  </div>
</template>
