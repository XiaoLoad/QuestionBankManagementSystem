<script setup>
import { ref, reactive, onMounted, onActivated, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useConfirmStore } from '@/stores/confirm'
import { useTrashStore } from '@/stores/trash'
import { QUESTION_TYPES, TYPE_COLORS } from '@/composables/constants'
import { formatDate, daysSince, highlightText } from '@/composables/utils'
import { usePagination } from '@/composables/usePagination'
import { useSelection } from '@/composables/useSelection'
import { useDebounceSearch } from '@/composables/useDebounceSearch'
import PaginationBar from '@/components/PaginationBar.vue'
import SearchInput from '@/components/SearchInput.vue'

defineOptions({ name: 'Trash' })

const api = useApi()
const toast = useToastStore()
const confirm = useConfirmStore()
const trashStore = useTrashStore()

// State
const questions = ref([])
const total = ref(0)
const totalPages = ref(0)
const loading = ref(true)
const batchRestoring = ref(false)
const batchDeleting = ref(false)
const emptying = ref(false)
const batchError = ref('')

const filters = reactive({
  search: '',
  type: '',
  category: '',
  sort: 'desc',
  page: 1,
  pageSize: 20,
})

const categories = ref([])
onMounted(async () => {
  loadTrash()
  try { categories.value = await api.getCategories() } catch {}
})

onActivated(() => {
  loadTrash()
  api.getCategories().then(v => { categories.value = v }).catch(() => {})
})

// FIX #8: Use array-based selection composable
const { selectedIds, allSelected: isAllSelected, toggleSelect, toggleSelectAll: doToggleSelectAll, clearSelection } = useSelection()

const allSelected = computed(() => isAllSelected(questions.value))

function toggleSelectAll() {
  doToggleSelectAll(questions.value)
}

// FIX #4: Use shared composables
const { paginationRange, goToPage } = usePagination(
  () => filters.page,
  totalPages,
  (p) => { filters.page = p; loadTrash() }
)

useDebounceSearch(filters, loadTrash)

// Load data
async function loadTrash() {
  loading.value = true
  try {
    const data = await api.getTrash(filters)
    questions.value = data.items
    total.value = data.total
    totalPages.value = data.totalPages
    trashStore.setCount(data.total)
    clearSelection()
  } catch (e) {
    // handled
  } finally {
    loading.value = false
  }
}

// Filter changes
function onFilterChange() {
  filters.page = 1
  loadTrash()
}

// Restore single
async function restoreQuestion(q) {
  try {
    await api.restoreTrash(q.id)
    trashStore.decrement(1)
    toast.success('已恢复')
    loadTrash()
  } catch (err) {
    if (err.status === 409 && err.data?.error === 'duplicate') {
      const ok = await confirm.show({
        title: '题目重复',
        message: '正常列表中已存在相同题目，是否强制恢复？',
        confirmText: '强制恢复',
        danger: true,
      })
      if (ok) {
        try {
          await api.restoreTrash(q.id, true)
          toast.success('已恢复')
          loadTrash()
        } catch (e) { /* handled */ }
      }
    }
  }
}

// Permanently delete single
async function permanentDelete(q) {
  const ok = await confirm.show({
    title: '永久删除',
    message: `确定要永久删除「${q.content.slice(0, 50)}」吗？此操作不可撤销。`,
    confirmText: '永久删除',
    danger: true,
  })
  if (!ok) return
  try {
    await api.permanentDeleteTrash(q.id)
    trashStore.decrement(1)
    toast.success('已永久删除')
    loadTrash()
  } catch (e) {
    // handled
  }
}

// Batch restore
async function batchRestore() {
  if (selectedIds.value.length === 0) {
    toast.error('请先选择要恢复的题目')
    return
  }
  batchRestoring.value = true
  try {
    const result = await api.batchRestoreTrash({ ids: selectedIds.value })
    trashStore.decrement(result.restored || selectedIds.value.length)
    toast.success(result.message || `已恢复 ${selectedIds.value.length} 道题目`)
    loadTrash()
  } catch (e) {
    // handled
  } finally {
    batchRestoring.value = false
  }
}

// Batch permanent delete
async function batchPermanentDelete() {
  if (selectedIds.value.length === 0) {
    toast.error('请先选择要删除的题目')
    return
  }
  const ok = await confirm.show({
    title: '永久删除',
    message: `确定要永久删除选中的 ${selectedIds.value.length} 道题目吗？此操作不可撤销。`,
    confirmText: '永久删除',
    danger: true,
  })
  if (!ok) return
  batchDeleting.value = true
  try {
    const _cnt = selectedIds.value.length
    await api.batchPermanentDeleteTrash({ ids: selectedIds.value })
    trashStore.decrement(_cnt)
    toast.success(`已永久删除 ${selectedIds.value.length} 道题目`)
    loadTrash()
  } catch (e) {
    batchError.value = '批量删除失败'
  } finally {
    batchDeleting.value = false
  }
}

// Empty trash
async function emptyTrash() {
  const ok = await confirm.show({
    title: '清空回收站',
    message: `确定要永久删除回收站中的全部 ${total.value} 道题目吗？此操作不可撤销。`,
    confirmText: '清空回收站',
    danger: true,
  })
  if (!ok) return
  emptying.value = true
  try {
    const result = await api.emptyTrash()
    trashStore.clear()
    toast.success(result.message)
    loadTrash()
  } catch (e) {
    batchError.value = '清空回收站失败'
  } finally {
    emptying.value = false
  }
}

// FIX #9: use shared utils
function highlight(text) {
  return highlightText(text, filters.search)
}

function formatDateDisplay(dateStr) {
  return formatDate(dateStr, 'datetime')
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div>
        <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">回收站</h1>
        <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">共 {{ total }} 道已删除题目</p>
      </div>
      <button
        v-if="total > 0"
        @click="emptyTrash"
        :disabled="emptying"
        class="btn-danger"
      >
        <svg v-if="emptying" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        {{ emptying ? '清空中...' : `清空回收站 (${total})` }}
      </button>
    </div>

    <!-- Filters -->
    <div class="flex-shrink-0 card mb-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="sm:col-span-2 lg:col-span-1">
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">搜索</label>
          <SearchInput v-model="filters.search" />
        </div>
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">题型</label>
          <select v-model="filters.type" @change="onFilterChange" class="select-field w-full">
            <option value="">全部</option>
            <option v-for="t in QUESTION_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">分类</label>
          <select v-model="filters.category" @change="onFilterChange" class="select-field w-full">
            <option value="">全部</option>
            <option v-for="c in categories" :key="c.id" :value="c.name">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">排序</label>
          <select v-model="filters.sort" @change="onFilterChange" class="select-field w-full">
            <option value="desc">最近删除</option>
            <option value="asc">最早删除</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Batch actions -->
    <div v-if="selectedIds.length > 0" class="flex-shrink-0 flex flex-wrap items-center gap-3 mb-4 p-3 bg-notion-accent/5 dark:bg-notion-accent-dark/10 rounded-card border border-notion-accent/20 dark:border-notion-accent-dark/20">
      <span class="text-sm font-medium text-notion-accent dark:text-notion-accent-dark">
        已选择 {{ selectedIds.length }} 项
      </span>
      <button @click="batchRestore" :disabled="batchRestoring" class="btn-secondary text-xs py-1.5 px-3">
        <svg v-if="batchRestoring" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
        </svg>
        {{ batchRestoring ? `恢复中 (${selectedIds.length})...` : '批量恢复' }}
      </button>
      <span v-if="batchError" class="text-xs text-red-500 dark:text-red-400">{{ batchError }}</span>
      <button @click="batchPermanentDelete" :disabled="batchDeleting" class="btn-danger text-xs py-1.5 px-3">
        <svg v-if="batchDeleting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        {{ batchDeleting ? `删除中 (${selectedIds.length})...` : '永久删除' }}
      </button>
    </div>

    <!-- Table -->
    <div class="flex-1 min-h-0 card p-0 overflow-hidden flex flex-col">
      <!-- Loading -->
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
      </div>

      <!-- Empty -->
      <div v-else-if="questions.length === 0" class="flex-1 flex flex-col items-center justify-center">
        <svg class="w-16 h-16 text-notion-muted/40 dark:text-notion-muted-dark/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        <p class="text-notion-muted dark:text-notion-muted-dark text-sm">回收站为空</p>
        <p class="text-notion-muted/60 dark:text-notion-muted-dark/60 text-xs mt-1">删除的题目会出现在这里</p>
      </div>

      <!-- Table content -->
      <template v-else>
        <div class="flex-1 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 bg-notion-surface dark:bg-notion-surface-dark">
              <tr class="border-b border-notion-border dark:border-notion-border-dark">
                <th class="w-10 px-4 py-3">
                  <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" class="rounded accent-notion-accent dark:accent-notion-accent-dark" />
                </th>
                <th class="text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">ID</th>
                <th class="text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">题型</th>
                <th class="text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">内容</th>
                <th class="text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">分类</th>
                <th class="text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">删除时间</th>
                <th class="text-right px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="q in questions"
                :key="q.id"
                class="border-b border-notion-border dark:border-notion-border-dark last:border-0 hover:bg-notion-surface/50 dark:hover:bg-notion-surface-dark/50 transition-colors"
              >
                <td class="px-4 py-3">
                  <input type="checkbox" :checked="selectedIds.includes(q.id)" @change="toggleSelect(q.id)" class="accent-notion-accent dark:accent-notion-accent-dark" />
                </td>
                <td class="px-4 py-3 text-notion-muted dark:text-notion-muted-dark font-mono text-xs">{{ q.id }}</td>
                <td class="px-4 py-3">
                  <span :class="['badge', TYPE_COLORS[q.type] || 'badge-type']">{{ q.type }}</span>
                </td>
                <td class="px-4 py-3 max-w-xs text-notion-text dark:text-notion-text-dark line-clamp-2" v-html="highlight(q.content)"></td>
                <td class="px-4 py-3">
                  <span class="badge badge-category">{{ q.category || '默认' }}</span>
                </td>
                <td class="px-4 py-3 text-notion-muted dark:text-notion-muted-dark whitespace-nowrap">
                  <div class="text-xs">{{ formatDateDisplay(q.deleted_at) }}</div>
                  <div class="text-xs text-notion-muted/60 dark:text-notion-muted-dark/60">{{ daysSince(q.deleted_at) }}</div>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button @click="restoreQuestion(q)" class="p-1.5 rounded-btn hover:bg-green-50 dark:hover:bg-green-900/20 text-notion-muted dark:text-notion-muted-dark hover:text-green-600 dark:hover:text-green-400 transition-colors" title="恢复">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                      </svg>
                    </button>
                    <button @click="permanentDelete(q)" class="p-1.5 rounded-btn hover:bg-red-50 dark:hover:bg-red-900/20 text-notion-muted dark:text-notion-muted-dark hover:text-red-500 transition-colors" title="永久删除">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <PaginationBar
          :page="filters.page"
          :totalPages="totalPages"
          :total="total"
          :pageSize="filters.pageSize"
          :paginationRange="paginationRange"
          @goToPage="goToPage"
          @update:pageSize="(v) => { filters.pageSize = v; onFilterChange() }"
        />
      </template>
    </div>
  </div>
</template>
