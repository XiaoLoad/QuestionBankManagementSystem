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
import SearchableSelect from '@/components/SearchableSelect.vue'

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
const filtersExpanded = ref(false)

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

// 检查是否有活跃的筛选条件
const hasActiveFilters = computed(() => {
  return filters.type || filters.category
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header (fixed) -->
    <div class="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark">回收站</h1>
        <p class="text-xs sm:text-sm text-notion-muted dark:text-notion-muted-dark mt-1">共 {{ total }} 道已删除题目</p>
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

    <!-- Filters (fixed) -->
    <div class="flex-shrink-0 card mb-3 sm:mb-4 p-3 sm:p-6">
      <!-- 搜索框始终显示 -->
      <div class="flex items-center gap-2">
        <div class="flex-1">
          <SearchInput v-model="filters.search" />
        </div>
        <button
          @click="filtersExpanded = !filtersExpanded"
          class="sm:hidden p-2 rounded-btn border border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
          :class="hasActiveFilters ? 'border-notion-accent dark:border-notion-accent-dark' : ''"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span v-if="hasActiveFilters" class="absolute -top-1 -right-1 w-2 h-2 bg-notion-accent dark:bg-notion-accent-dark rounded-full"></span>
        </button>
      </div>

      <!-- 其他筛选条件：PC 端始终显示，移动端可折叠 -->
      <div :class="['mt-3', filtersExpanded ? 'block' : 'hidden sm:block']">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">题型</label>
            <select v-model="filters.type" @change="onFilterChange" class="select-field w-full text-sm">
              <option value="">全部</option>
              <option v-for="t in QUESTION_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">分类</label>
            <SearchableSelect
              :modelValue="filters.category"
              @update:modelValue="(v) => { filters.category = v; onFilterChange() }"
              :options="categories.map(c => ({ label: c.name, value: c.name }))"
              allLabel="全部"
              placeholder="全部"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">排序</label>
            <select v-model="filters.sort" @change="onFilterChange" class="select-field w-full text-sm">
              <option value="desc">最近删除</option>
              <option value="asc">最早删除</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Batch actions -->
    <div v-if="selectedIds.length > 0" class="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4 p-2.5 sm:p-3 bg-notion-accent/5 dark:bg-notion-accent-dark/10 rounded-card border border-notion-accent/20 dark:border-notion-accent-dark/20">
      <span class="text-xs sm:text-sm font-medium text-notion-accent dark:text-notion-accent-dark">
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

    <!-- Table / Card list (scrollable, fills remaining space) -->
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
        <!-- PC 端：表格布局 -->
        <div class="hidden sm:block flex-1 overflow-x-auto overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 bg-notion-surface dark:bg-notion-surface-dark">
              <tr class="border-b border-notion-border dark:border-notion-border-dark">
                <th class="w-10 px-4 py-3">
                  <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" class="rounded accent-notion-accent dark:accent-notion-accent-dark" />
                </th>
                <th class="w-14 text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">ID</th>
                <th class="w-20 text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark whitespace-nowrap">题型</th>
                <th class="text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">内容</th>
                <th class="w-20 text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark whitespace-nowrap">分类</th>
                <th class="w-28 text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark whitespace-nowrap">删除时间</th>
                <th class="w-20 text-right px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">操作</th>
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
                <td class="px-4 py-3 text-notion-muted dark:text-notion-muted-dark font-mono text-xs whitespace-nowrap">{{ q.id }}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span :class="['badge', TYPE_COLORS[q.type] || 'badge-type']">{{ q.type }}</span>
                </td>
                <td class="px-4 py-3">
                  <p class="text-notion-text dark:text-notion-text-dark line-clamp-2 break-words" v-html="highlight(q.content)"></p>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
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

        <!-- 移动端：卡片布局 -->
        <div class="sm:hidden flex-1 overflow-y-auto">
          <!-- 全选 -->
          <div class="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-notion-surface dark:bg-notion-surface-dark border-b border-notion-border dark:border-notion-border-dark">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="toggleSelectAll"
              class="accent-notion-accent dark:accent-notion-accent-dark"
            />
            <span class="text-xs text-notion-muted dark:text-notion-muted-dark">
              {{ allSelected ? '取消全选' : '全选' }}（{{ questions.length }} 题）
            </span>
          </div>
          <div class="divide-y divide-notion-border dark:divide-notion-border-dark">
            <div
              v-for="q in questions"
              :key="q.id"
              class="p-3 hover:bg-notion-surface/50 dark:hover:bg-notion-surface-dark/50 transition-colors"
            >
              <div class="flex items-start gap-3">
                <!-- Checkbox -->
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(q.id)"
                  @change="toggleSelect(q.id)"
                  class="mt-1 accent-notion-accent dark:accent-notion-accent-dark"
                />
                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-1.5">
                    <span :class="['badge text-[10px]', TYPE_COLORS[q.type] || 'badge-type']">{{ q.type }}</span>
                    <span class="badge badge-category text-[10px]">{{ q.category || '默认' }}</span>
                    <span class="text-[10px] text-notion-muted dark:text-notion-muted-dark ml-auto">#{{ q.id }}</span>
                  </div>
                  <p class="text-sm text-notion-text dark:text-notion-text-dark line-clamp-2" v-html="highlight(q.content)"></p>
                  <div class="flex items-center justify-between mt-2">
                    <div class="text-[10px] text-notion-muted dark:text-notion-muted-dark">
                      <span>{{ formatDateDisplay(q.deleted_at) }}</span>
                      <span class="ml-1 opacity-60">{{ daysSince(q.deleted_at) }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <button @click="restoreQuestion(q)" class="p-1.5 rounded-btn hover:bg-green-50 dark:hover:bg-green-900/20 text-notion-muted dark:text-notion-muted-dark hover:text-green-600 dark:hover:text-green-400 transition-colors" title="恢复">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                        </svg>
                      </button>
                      <button @click="permanentDelete(q)" class="p-1.5 rounded-btn hover:bg-red-50 dark:hover:bg-red-900/20 text-notion-muted dark:text-notion-muted-dark hover:text-red-500 transition-colors" title="永久删除">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
