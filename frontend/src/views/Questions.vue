<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useConfirmStore } from '@/stores/confirm'
import { useTrashStore } from '@/stores/trash'
import { QUESTION_TYPES, TYPE_COLORS } from '@/composables/constants'
import { formatDate, highlightText } from '@/composables/utils'
import { usePagination } from '@/composables/usePagination'
import { useSelection } from '@/composables/useSelection'
import { useDebounceSearch } from '@/composables/useDebounceSearch'
import QuestionFormModal from '@/components/QuestionFormModal.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import SearchInput from '@/components/SearchInput.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useQuestionsPageStore } from '@/stores/questionsPage'

defineOptions({ name: 'Questions' })

const api = useApi()
const router = useRouter()
const route = useRoute()
const toast = useToastStore()
const confirm = useConfirmStore()
const trashStore = useTrashStore()
const questionsPageStore = useQuestionsPageStore()

// State
const questions = ref([])
const categories = ref([])
const total = ref(0)
const totalPages = ref(0)
const loading = ref(true)
const showForm = ref(false)
const editingQuestion = ref(null)
const batchDeleting = ref(false)
const batchCategoryLoading = ref(false)
const batchError = ref('')

const filters = reactive({
  search: '',
  type: '',
  category: '',
  sort: 'desc',
  dateFrom: '',
  dateTo: '',
  page: 1,
  pageSize: 20,
})

// FIX #8: Use array-based selection composable
const { selectedIds, allSelected: isAllSelected, toggleSelect, toggleSelectAll: doToggleSelectAll, clearSelection } = useSelection()

const allSelected = computed(() => isAllSelected(questions.value))

function toggleSelectAll() {
  doToggleSelectAll(questions.value)
}

// FIX #4: Use shared pagination composable
const { paginationRange, goToPage } = usePagination(
  () => filters.page,
  totalPages,
  (p) => { filters.page = p; loadQuestions() }
)

// FIX #4: Use shared debounce search composable
useDebounceSearch(filters, loadQuestions)

// Load data
async function loadQuestions() {
  loading.value = true
  try {
    const data = await api.getQuestions(filters)
    questions.value = data.items
    total.value = data.total
    totalPages.value = data.totalPages
    clearSelection()
  } catch (e) {
    // handled by useApi
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    categories.value = await api.getCategories()
  } catch (e) {
    // handled
  }
}

const categoryScoreMap = computed(() => {
  const map = {}
  for (const c of categories.value) {
    if (c.score !== null && c.score !== undefined) {
      map[c.name] = c.score
    }
  }
  return map
})

onMounted(() => {
  // Restore saved state if returning from detail page
  const saved = questionsPageStore.restore()
  if (saved) {
    Object.assign(filters, saved.filters)
  }
  // Apply category from route query (e.g. from Categories page click)
  if (route.query.category) {
    filters.category = route.query.category
  }
  loadQuestions()
  loadCategories()
})

// Refresh trash count on mount
api.getTrashCount().then(d => trashStore.setCount(d.count || 0)).catch(() => {})

// Filter changes
function onFilterChange() {
  filters.page = 1
  loadQuestions()
}

// CRUD
function addQuestion() {
  editingQuestion.value = null
  showForm.value = true
}

function editQuestion(q) {
  editingQuestion.value = { ...q }
  showForm.value = true
}

async function handleFormSubmit(formData) {
  try {
    if (editingQuestion.value) {
      await api.updateQuestion(editingQuestion.value.id, formData)
      toast.success('更新成功')
    } else {
      await api.createQuestion(formData)
      toast.success('添加成功')
    }
    showForm.value = false
    loadQuestions()
  } catch (err) {
    if (err.status === 409 && err.data?.error === 'duplicate') {
      const ok = await confirm.show({
        title: '题目重复',
        message: '该题目已存在，是否强制添加？',
        confirmText: '强制添加',
        danger: true,
      })
      if (ok) {
        try {
          if (editingQuestion.value) {
            await api.updateQuestion(editingQuestion.value.id, { ...formData, force: true })
            toast.success('更新成功')
          } else {
            await api.createQuestion({ ...formData, force: true })
            toast.success('添加成功')
          }
          showForm.value = false
          loadQuestions()
        } catch (e) {
          // handled
        }
      }
    }
  }
}

async function deleteQuestion(q) {
  const ok = await confirm.show({
    title: '删除题目',
    message: `确定要删除「${q.content.slice(0, 50)}」吗？将移至回收站，可在回收站恢复。`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return
  try {
    await api.deleteQuestion(q.id)
    trashStore.increment(1)
    toast.success('已移至回收站')
    loadQuestions()
  } catch (e) {
    // handled
  }
}

async function batchDelete() {
  if (selectedIds.value.length === 0) {
    toast.error('请先选择要删除的题目')
    return
  }
  const ok = await confirm.show({
    title: '批量删除',
    message: `确定要删除选中的 ${selectedIds.value.length} 道题目吗？将移至回收站，可在回收站恢复。`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return
  batchDeleting.value = true
  try {
    const _cnt = selectedIds.value.length
    await api.batchDelete({ ids: selectedIds.value })
    trashStore.increment(_cnt)
    toast.success(`已将 ${selectedIds.value.length} 道题目移至回收站`)
    loadQuestions()
  } catch (e) {
    batchError.value = '批量删除失败，请检查网络后重试'
  } finally {
    batchDeleting.value = false
  }
}

const batchCategoryValue = ref('')
async function batchUpdateCategory() {
  if (selectedIds.value.length === 0) {
    toast.error('请先选择要修改的题目')
    return
  }
  if (!batchCategoryValue.value) {
    toast.error('请选择分类')
    return
  }
  batchCategoryLoading.value = true
  try {
    await api.batchCategory({
      ids: selectedIds.value,
      category: batchCategoryValue.value,
    })
    toast.success('分类修改成功')
    loadQuestions()
  } catch (e) {
    batchError.value = '分类修改失败，请检查网络后重试'
  } finally {
    batchCategoryLoading.value = false
  }
}

// FIX #9: use shared formatDate
function formatDateDisplay(dateStr) {
  return formatDate(dateStr, 'datetime')
}

// FIX #9: use shared highlightText
function savePageState() {
  questionsPageStore.save({ filters: { ...filters } })
}

function highlight(text) {
  return highlightText(text, filters.search)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header (fixed) -->
    <div class="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div>
        <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">题目管理</h1>
        <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">共 {{ total }} 道题目</p>
      </div>
      <button @click="addQuestion" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        添加题目
      </button>
    </div>

    <!-- Filters (fixed) -->
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
          <select v-model="filters.sort" @change="onFilterChange" class="select-field w-full">
            <option value="desc">最新优先</option>
            <option value="asc">最早优先</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">起始日期</label>
          <input v-model="filters.dateFrom" @change="onFilterChange" type="date" class="input-field" />
        </div>
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">结束日期</label>
          <input v-model="filters.dateTo" @change="onFilterChange" type="date" class="input-field" />
        </div>
      </div>
    </div>

    <!-- Batch actions (fixed, conditional) -->
    <div v-if="selectedIds.length > 0" class="flex-shrink-0 flex flex-wrap items-center gap-3 mb-4 p-3 bg-notion-accent/5 dark:bg-notion-accent-dark/10 rounded-card border border-notion-accent/20 dark:border-notion-accent-dark/20">
      <span class="text-sm font-medium text-notion-accent dark:text-notion-accent-dark">
        已选择 {{ selectedIds.length }} 项
      </span>
      <div class="flex items-center gap-2">
        <div class="w-44">
          <SearchableSelect
            v-model="batchCategoryValue"
            :options="categories.map(c => ({ label: c.name, value: c.name }))"
            placeholder="选择分类"
          />
        </div>
        <button @click="batchUpdateCategory" :disabled="batchCategoryLoading" class="btn-secondary text-xs py-1.5 px-3">
          <svg v-if="batchCategoryLoading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {{ batchCategoryLoading ? `修改中 (${selectedIds.length})...` : '修改分类' }}
        </button>
      </div>
      <span v-if="batchError" class="text-xs text-red-500 dark:text-red-400">{{ batchError }}</span>
      <button @click="batchDelete" :disabled="batchDeleting" class="btn-danger text-xs py-1.5 px-3">
        <svg v-if="batchDeleting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        {{ batchDeleting ? `删除中 (${selectedIds.length})...` : '批量删除' }}
      </button>
    </div>

    <!-- Table (scrollable, fills remaining space) -->
    <div class="flex-1 min-h-0 card p-0 overflow-hidden flex flex-col">
      <!-- Loading -->
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
      </div>

      <!-- Empty -->
      <div v-else-if="questions.length === 0" class="flex-1 flex flex-col items-center justify-center">
        <svg class="w-12 h-12 text-notion-muted dark:text-notion-muted-dark mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <p class="text-notion-muted dark:text-notion-muted-dark">暂无题目</p>
        <button @click="addQuestion" class="btn-primary mt-4">添加第一道题</button>
      </div>

      <!-- Table content (scrollable area) -->
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
                <th class="text-left px-4 py-3 font-medium text-notion-muted dark:text-notion-muted-dark">创建时间</th>
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
                <td class="px-4 py-3 max-w-xs">
                  <router-link :to="`/questions/${q.id}`" @click="savePageState" class="text-notion-text dark:text-notion-text-dark hover:text-notion-accent dark:hover:text-notion-accent-dark line-clamp-2 transition-colors" v-html="highlight(q.content)">
                  </router-link>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5">
                    <span class="badge badge-category">{{ q.category || '默认' }}</span>
                    <span
                      v-if="categoryScoreMap[q.category] !== undefined"
                      class="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium"
                    >{{ categoryScoreMap[q.category] }}分</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-notion-muted dark:text-notion-muted-dark whitespace-nowrap">{{ formatDateDisplay(q.created_at) }}</td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button @click="savePageState(); router.push(`/questions/${q.id}`)" class="p-1.5 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-800 text-notion-muted dark:text-notion-muted-dark transition-colors" title="查看详情">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                    <button @click="editQuestion(q)" class="p-1.5 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-800 text-notion-muted dark:text-notion-muted-dark transition-colors" title="编辑">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button @click="deleteQuestion(q)" class="p-1.5 rounded-btn hover:bg-red-50 dark:hover:bg-red-900/20 text-notion-muted dark:text-notion-muted-dark hover:text-red-500 transition-colors" title="删除">
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

    <!-- Question Form Modal -->
    <QuestionFormModal
      v-if="showForm"
      :question="editingQuestion"
      :categories="categories"
      @close="showForm = false"
      @submit="handleFormSubmit"
    />
  </div>
</template>
