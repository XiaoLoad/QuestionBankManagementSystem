<script setup>
import { ref, watch, computed } from 'vue'
import SearchableSelect from '@/components/SearchableSelect.vue'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  localCategories: { type: Array, default: () => [] },
  totalQuestions: { type: Number, default: 0 },
})
const emit = defineEmits(['confirm', 'cancel'])

const edits = ref([])

const localCategoryOptions = computed(() =>
  props.localCategories.map(c => ({ label: c.name, value: c.name }))
)

const localNameSet = computed(() =>
  new Set(props.localCategories.map(c => c.name))
)

watch(() => props.categories, (cats) => {
  edits.value = cats.map(c => ({
    originalName: c.name,
    name: c.name,
    existing: c.existing,
    currentScore: c.currentScore,
    score: c.currentScore !== null && c.currentScore !== undefined ? String(c.currentScore) : '',
  }))
}, { immediate: true })

function applyMapping(cat, value) {
  if (value) cat.name = value
}

function onConfirm() {
  const categoryScores = edits.value.map(e => ({
    originalName: e.originalName,
    name: e.name.trim() || e.originalName,
    score: e.score === '' ? null : Math.floor(Number(e.score)),
  }))
  emit('confirm', categoryScores)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9997] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50" @click="emit('cancel')" />
      <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark max-w-2xl w-full max-h-[85vh] flex flex-col">
        <!-- Header -->
        <div class="flex-shrink-0 px-6 py-4 border-b border-notion-border dark:border-notion-border-dark">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark flex items-center gap-2">
                <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
                导入分类确认
              </h2>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">
                共 {{ totalQuestions }} 条题目，涉及 {{ categories.length }} 个分类。请确认分类名称和分数。
              </p>
            </div>
            <button @click="emit('cancel')" class="p-1 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg class="w-5 h-5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-4 pb-24">
          <div class="space-y-3">
            <div
              v-for="cat in edits"
              :key="cat.originalName"
              class="border border-notion-border dark:border-notion-border-dark rounded-card p-4 relative"
            >
              <div class="flex items-center gap-3 mb-3">
                <span class="badge badge-category">{{ cat.originalName }}</span>
                <span
                  v-if="cat.existing"
                  class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 font-medium"
                >已存在于本地</span>
                <span
                  v-else
                  class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium"
                >将新建分类</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="sm:col-span-2">
                  <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">存入分类</label>
                  <div class="flex gap-2">
                    <div class="flex-1">
                      <SearchableSelect
                        :modelValue="localNameSet.has(cat.name) ? cat.name : ''"
                        @update:modelValue="(v) => applyMapping(cat, v)"
                        :options="localCategoryOptions"
                        placeholder="选择已有分类..."
                      />
                    </div>
                    <span class="flex items-center text-xs text-notion-muted dark:text-notion-muted-dark">或</span>
                    <input
                      v-model="cat.name"
                      type="text"
                      class="input-field flex-1"
                      :placeholder="cat.originalName"
                    />
                  </div>
                  <p v-if="localNameSet.has(cat.name)" class="text-xs text-green-600 dark:text-green-400 mt-1">
                    将存入已有分类「{{ cat.name }}」
                  </p>
                  <p v-else-if="cat.name !== cat.originalName" class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    将新建分类「{{ cat.name }}」
                  </p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">分数（可选）</label>
                  <input
                    v-model="cat.score"
                    type="number"
                    min="0"
                    class="input-field w-full"
                    placeholder="留空不设置"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex-shrink-0 px-6 py-4 border-t border-notion-border dark:border-notion-border-dark flex items-center justify-end gap-3">
          <button @click="emit('cancel')" class="btn-secondary text-sm">取消</button>
          <button @click="onConfirm" class="btn-primary text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            确认导入
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
