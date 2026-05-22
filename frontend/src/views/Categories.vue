<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useConfirmStore } from '@/stores/confirm'
import { usePagination } from '@/composables/usePagination'
import PaginationBar from '@/components/PaginationBar.vue'

defineOptions({ name: 'Categories' })

const router = useRouter()
const api = useApi()
const toast = useToastStore()
const confirm = useConfirmStore()

const categories = ref([])
const loading = ref(true)
const newName = ref('')
const newScore = ref('')
const editingId = ref(null)
const editingName = ref('')
const editingScore = ref(null)

// Search & Pagination
const searchQuery = ref('')
const page = ref(1)
const pageSize = ref(10)

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await api.getCategories()
  } catch (e) {
    // handled
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)

// Filtered & Paginated
const filteredCategories = computed(() => {
  if (!searchQuery.value.trim()) return categories.value
  const q = searchQuery.value.trim().toLowerCase()
  return categories.value.filter(c => c.name.toLowerCase().includes(q))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredCategories.value.length / pageSize.value)))

const { paginationRange, goToPage } = usePagination(
  () => page.value,
  totalPages,
  (p) => { page.value = p }
)

const paginatedCategories = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredCategories.value.slice(start, start + pageSize.value)
})

// Reset page when search changes
function onSearchChange() {
  page.value = 1
}

async function addCategory() {
  const name = newName.value.trim()
  if (!name) {
    toast.error('分类名称不能为空')
    return
  }
  if (categories.value.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    toast.error('分类名称已存在')
    return
  }
  try {
    await api.createCategory(name, newScore.value === '' ? null : newScore.value)
    toast.success('添加成功')
    newName.value = ''
    newScore.value = ''
    loadCategories()
  } catch (e) {
    // handled
  }
}

function startEdit(cat) {
  editingId.value = cat.id
  editingName.value = cat.name
  editingScore.value = cat.score !== null && cat.score !== undefined ? String(cat.score) : ''
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
  editingScore.value = null
}

async function saveEdit() {
  const name = editingName.value.trim()
  if (!name) {
    toast.error('分类名称不能为空')
    return
  }
  try {
    await api.updateCategory(editingId.value, {
      name,
      score: editingScore.value === '' ? null : editingScore.value,
    })
    toast.success('更新成功')
    cancelEdit()
    loadCategories()
  } catch (e) {
    // handled
  }
}

function goToQuestions(cat) {
  router.push({ path: '/questions', query: { category: cat.name } })
}

async function deleteCategory(cat) {
  const ok = await confirm.show({
    title: '删除分类',
    message: `确定要删除「${cat.name}」吗？该分类下的 ${cat.question_count} 道题目将被移到"默认"分类。`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return
  try {
    await api.deleteCategory(cat.id)
    toast.success('删除成功')
    loadCategories()
  } catch (e) {
    // handled
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header (fixed) -->
    <div class="flex-shrink-0 mb-8">
      <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">分类管理</h1>
      <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">管理题目的分类标签</p>
    </div>

    <!-- Toolbar: search + add (fixed) -->
    <div class="flex-shrink-0 card mb-4">
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <!-- Search -->
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-notion-muted dark:text-notion-muted-dark pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            v-model="searchQuery"
            @input="onSearchChange"
            type="text"
            class="input-field pl-9 pr-8"
            placeholder="搜索分类..."
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''; onSearchChange()"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <!-- Count -->
        <span class="hidden sm:flex items-center text-xs text-notion-muted dark:text-notion-muted-dark flex-shrink-0 px-1">
          {{ searchQuery ? `${filteredCategories.length} / ${categories.length}` : `${categories.length} 个` }}
        </span>
        <!-- Divider -->
        <div class="hidden sm:block w-px h-6 bg-notion-border dark:bg-notion-border-dark"></div>
        <!-- Add form -->
        <form @submit.prevent="addCategory" class="flex gap-2 flex-shrink-0 items-center">
          <input
            v-model="newName"
            type="text"
            placeholder="新分类名称..."
            class="input-field w-44"
          />
          <input
            v-model="newScore"
            type="number"
            min="0"
            class="input-field w-20"
            placeholder="分数"
          />
          <button type="submit" class="btn-primary flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            添加
          </button>
        </form>
      </div>
    </div>

    <!-- List card (fills remaining space) -->
    <div class="flex-1 min-h-0 card p-0 overflow-hidden flex flex-col">
      <!-- Loading -->
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
      </div>

      <!-- Empty -->
      <div v-else-if="filteredCategories.length === 0" class="flex-1 flex flex-col items-center justify-center">
        <svg class="w-12 h-12 text-notion-muted dark:text-notion-muted-dark mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
        </svg>
        <p class="text-notion-muted dark:text-notion-muted-dark">{{ searchQuery ? '无匹配分类' : '暂无分类' }}</p>
      </div>

      <!-- Scrollable list -->
      <template v-else>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="(cat, idx) in paginatedCategories"
            :key="cat.id"
            :class="[
              'flex items-center justify-between px-5 py-4',
              idx < paginatedCategories.length - 1 ? 'border-b border-notion-border dark:border-notion-border-dark' : ''
            ]"
          >
            <!-- View mode -->
            <template v-if="editingId !== cat.id">
              <div class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" @click="goToQuestions(cat)">
                <div class="flex-shrink-0 w-10 h-10 rounded-btn bg-notion-accent/10 dark:bg-notion-accent-dark/15 flex items-center justify-center">
                  <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-notion-text dark:text-notion-text-dark truncate hover:text-notion-accent dark:hover:text-notion-accent-dark transition-colors">{{ cat.name }}</p>
                  <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">
                    {{ cat.question_count }} 道题目
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0 ml-3">
                <span
                  v-if="cat.score !== null && cat.score !== undefined"
                  class="inline-flex items-center px-2.5 py-1 rounded-badge bg-amber-50 dark:bg-amber-900/30 text-xs font-medium text-amber-600 dark:text-amber-400"
                >{{ cat.score }} 分</span>
                <span class="inline-flex items-center px-2.5 py-1 rounded-badge bg-notion-surface dark:bg-notion-surface-dark text-xs font-medium text-notion-text dark:text-notion-text-dark">
                  {{ cat.question_count }}
                </span>
                <button @click="startEdit(cat)" class="p-1.5 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-800 text-notion-muted dark:text-notion-muted-dark transition-colors" title="编辑">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button @click="deleteCategory(cat)" class="p-1.5 rounded-btn hover:bg-red-50 dark:hover:bg-red-900/20 text-notion-muted dark:text-notion-muted-dark hover:text-red-500 transition-colors" title="删除">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </template>

            <!-- Edit mode -->
            <template v-else>
              <form @submit.prevent="saveEdit" class="flex items-center gap-3 flex-1">
                <input v-model="editingName" type="text" class="input-field flex-1" autofocus />
                <input v-model="editingScore" type="number" min="0" class="input-field w-20" placeholder="分数" />
                <div class="flex gap-2 flex-shrink-0">
                  <button type="submit" class="btn-primary text-xs py-1.5 px-3">保存</button>
                  <button type="button" @click="cancelEdit" class="btn-secondary text-xs py-1.5 px-3">取消</button>
                </div>
              </form>
            </template>
          </div>
        </div>

        <!-- PaginationBar (always visible) -->
        <PaginationBar
          :page="page"
          :totalPages="totalPages"
          :total="filteredCategories.length"
          :pageSize="pageSize"
          :paginationRange="paginationRange"
          @goToPage="goToPage"
          @update:pageSize="(v) => { pageSize = v; page = 1 }"
        />
      </template>
    </div>
  </div>
</template>
