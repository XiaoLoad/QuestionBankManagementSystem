<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useConfirmStore } from '@/stores/confirm'
import { QUESTION_TYPES } from '@/composables/constants'
import { useTrashStore } from '@/stores/trash'
import ImportResultDialog from '@/components/ImportResultDialog.vue'
import ImportCategoryDialog from '@/components/ImportCategoryDialog.vue'

defineOptions({ name: 'DataManagement' })

const api = useApi()
const toast = useToastStore()
const confirm = useConfirmStore()
const trashStore = useTrashStore()

// Categories for export filter & batch delete
const categories = ref([])
onMounted(async () => {
  try { categories.value = await api.getCategories() } catch {}
})

// Export filters
const exportFilters = reactive({
  type: '',
  category: '',
})

// Import
const importText = ref('')
const importing = ref(false)
const isDragging = ref(false)

// Import result dialog state
const showResultDialog = ref(false)
const resultDuplicates = ref([])
const resultConflicts = ref([])
const importSummary = ref({ imported: 0, skipped: 0 })

// Import category dialog state
const showCategoryDialog = ref(false)
const importCategories = ref([])
const pendingQuestions = ref(null)

// Batch delete
const batchFilters = reactive({
  before: '',
  after: '',
  type: '',
  category: '',
})

function downloadBackup() {
  api.downloadBackup()
  toast.success('数据库备份下载中...')
}

function exportJson() {
  const params = {}
  if (exportFilters.type) params.type = exportFilters.type
  if (exportFilters.category) params.category = exportFilters.category
  api.exportJson(params)
}

async function importJson() {
  if (!importText.value.trim()) {
    toast.error('请粘贴 JSON 数据')
    return
  }
  let questions
  try {
    questions = JSON.parse(importText.value)
    if (!Array.isArray(questions)) {
      toast.error('JSON 数据必须是数组格式')
      return
    }
  } catch (e) {
    toast.error('JSON 格式不正确')
    return
  }

  // Preview categories for score configuration
  try {
    const preview = await api.previewImport(questions)
    importCategories.value = preview.categories
    pendingQuestions.value = questions
    showCategoryDialog.value = true
  } catch (e) {
    // handled by useApi
  }
}

async function onCategoryConfirmed(categoryScores) {
  showCategoryDialog.value = false
  const questions = pendingQuestions.value
  pendingQuestions.value = null

  // Apply category name changes to questions
  const nameMap = {}
  for (const cs of categoryScores) {
    if (cs.name && cs.name !== cs.originalName) {
      nameMap[cs.originalName] = cs.name
    }
  }
  if (Object.keys(nameMap).length > 0) {
    for (const q of questions) {
      const cat = q.category || '默认'
      if (nameMap[cat]) {
        q.category = nameMap[cat]
      }
    }
  }

  const ok = await confirm.show({
    title: '导入数据',
    message: `即将导入 ${questions.length} 条题目数据。`,
    confirmText: '开始导入',
  })
  if (!ok) return

  importing.value = true
  try {
    const result = await api.importJson(questions, categoryScores)
    importSummary.value = { imported: result.imported, skipped: result.skipped }

    const dupes = result.duplicates || []
    const confs = result.conflicts || []

    if (confs.length > 0 || dupes.length > 0) {
      resultDuplicates.value = dupes
      resultConflicts.value = confs
      showResultDialog.value = true
      if (result.imported > 0) {
        toast.success(`已成功导入 ${result.imported} 条新题目`)
      }
    } else {
      toast.success(result.message)
      importText.value = ''
    }
  } catch (e) {
    // handled
  } finally {
    importing.value = false
  }
}

function onCategoryCancelled() {
  showCategoryDialog.value = false
  pendingQuestions.value = null
  importCategories.value = []
}

function closeResultDialog() {
  showResultDialog.value = false
  resultDuplicates.value = []
  resultConflicts.value = []
  importText.value = ''
}



function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  readFile(file)
  event.target.value = ''
}

function readFile(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    importText.value = e.target.result
  }
  reader.readAsText(file)
}

function onDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && file.name.endsWith('.json')) {
    readFile(file)
  } else {
    toast.error('请拖入 .json 文件')
  }
}

// ===== Database =====
const dbInfo = ref({ currentPath: '', recentPaths: [], fileSize: 0, questionCount: 0, trashCount: 0, categoryCount: 0 })
const dbLoading = ref(false)
const dbFileInput = ref(null)
const showAllRecent = ref(false)
const RECENT_SHOW_LIMIT = 5
const pendingDbFile = ref(null)
const showUploadDialog = ref(false)
const uploadCustomName = ref('')

async function loadDbInfo() {
  try {
    const data = await api.getDatabase()
    dbInfo.value = data
  } catch {}
}

onMounted(() => { loadDbInfo() })

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function getFileName(p) {
  if (!p) return ''
  return p.split('/').pop().split('\\').pop()
}

function getParentDir(p) {
  if (!p) return ''
  const parts = p.replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.join('/') || '/'
}

async function handleDbFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  if (!file.name.endsWith('.db')) {
    toast.error('请选择 .db 文件')
    event.target.value = ''
    return
  }
  event.target.value = ''

  // Pre-fill with original filename (without extension)
  const dotIdx = file.name.lastIndexOf('.')
  uploadCustomName.value = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name
  pendingDbFile.value = file
  showUploadDialog.value = true
}

async function confirmUpload() {
  const name = uploadCustomName.value.trim()
  if (!name) {
    toast.error('请输入数据库名称')
    return
  }
  const file = pendingDbFile.value
  if (!file) return

  showUploadDialog.value = false
  pendingDbFile.value = null

  const desiredName = name.endsWith('.db') ? name : `${name}.db`
  await doUploadDb(file, desiredName)
}

function cancelUpload() {
  showUploadDialog.value = false
  pendingDbFile.value = null
  uploadCustomName.value = ''
}

async function doUploadDb(file, desiredName) {
  dbLoading.value = true
  try {
    const result = await api.uploadDatabase(file, desiredName)
    toast.success(result.message || '上传并切换成功')
    dbInfo.value = {
      currentPath: result.currentPath,
      recentPaths: result.recentPaths || [],
      fileSize: result.fileSize || 0,
      questionCount: result.questionCount || 0,
      trashCount: result.trashCount || 0,
      categoryCount: result.categoryCount || 0,
    }
  } catch (e) {
    // handled
  } finally {
    dbLoading.value = false
  }
}


function triggerDbFileInput() {
  dbFileInput.value?.click()
}

async function switchToRecent(p) {
  if (p === dbInfo.value.currentPath) return
  dbLoading.value = true
  try {
    const result = await api.switchDatabase(p)
    toast.success(result.message || '切换成功')
    dbInfo.value = {
      currentPath: result.currentPath,
      recentPaths: result.recentPaths || [],
      fileSize: result.fileSize || 0,
      questionCount: result.questionCount || 0,
      trashCount: result.trashCount || 0,
      categoryCount: result.categoryCount || 0,
    }
  } catch (e) {
    // handled
  } finally {
    dbLoading.value = false
  }
}

async function resetDb() {
  const ok = await confirm.show({
    title: '切回默认数据库',
    message: '将从当前数据库切换回项目目录下的 default.db，当前数据库文件不会被删除。确定继续？',
    confirmText: '切回默认',
    danger: true,
  })
  if (!ok) return
  dbLoading.value = true
  try {
    const result = await api.resetDatabase()
    toast.success(result.message || '已切回默认数据库')
    dbInfo.value = {
      currentPath: result.currentPath,
      recentPaths: result.recentPaths || [],
      fileSize: result.fileSize || 0,
      questionCount: result.questionCount || 0,
      trashCount: result.trashCount || 0,
      categoryCount: result.categoryCount || 0,
    }
  } catch (e) {
    // handled
  } finally {
    dbLoading.value = false
  }
}

const displayedRecentPaths = computed(() => {
  const paths = dbInfo.value.recentPaths || []
  if (showAllRecent.value || paths.length <= RECENT_SHOW_LIMIT) return paths
  return paths.slice(0, RECENT_SHOW_LIMIT)
})

async function removeRecentPath(p, event) {
  event.stopPropagation()
  if (p === dbInfo.value.currentPath) {
    toast.error('不能移除当前正在使用的数据库')
    return
  }
  try {
    const result = await api.removeRecentDb(p)
    dbInfo.value.recentPaths = result.recentPaths || []
    toast.success('已从列表中移除')
  } catch (e) {
    // handled
  }
}

// ===== Deploy =====
const targetDir = ref('')
const targetDirStatus = ref('') // '' | 'valid' | 'invalid'
const targetDirLoading = ref(false)
const availableDbs = ref([])
const deploySource = ref('')
const deployFileName = ref('default.db')
const deployLoading = ref(false)

async function loadTargetDir() {
  try {
    const data = await api.getTargetDir()
    targetDir.value = data.targetDir || ''
    if (targetDir.value) {
      targetDirStatus.value = 'valid'
      await loadAvailableDbs()
    }
  } catch {}
}

async function loadAvailableDbs() {
  try {
    const data = await api.getAvailableDatabases()
    availableDbs.value = data.databases || []
    if (availableDbs.value.length > 0 && !deploySource.value) {
      deploySource.value = availableDbs.value[0].path
    }
  } catch {}
}

onMounted(() => { loadTargetDir() })

async function verifyTargetDir() {
  if (!targetDir.value.trim()) {
    toast.error('请输入目录路径')
    return
  }
  targetDirLoading.value = true
  try {
    const result = await api.setTargetDir(targetDir.value.trim())
    targetDir.value = result.targetDir
    targetDirStatus.value = 'valid'
    toast.success('目标目录已设置')
    await loadAvailableDbs()
  } catch (e) {
    targetDirStatus.value = 'invalid'
  } finally {
    targetDirLoading.value = false
  }
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

async function deployDb() {
  if (!deploySource.value) {
    toast.error('请选择要部署的数据库')
    return
  }
  if (!deployFileName.value.trim()) {
    toast.error('请输入文件名')
    return
  }
  deployLoading.value = true
  try {
    const result = await api.deployDatabase(deploySource.value, deployFileName.value.trim())
    toast.success(result.message || '部署成功')
  } catch (e) {
    if (e.status === 409 && e.data?.conflict) {
      const ok = await confirm.show({
        title: '文件已存在',
        message: `目标目录下已存在 ${deployFileName.value.trim()}，是否覆盖？`,
        confirmText: '覆盖',
        danger: true,
      })
      if (ok) {
        try {
          const result = await api.deployDatabase(deploySource.value, deployFileName.value.trim(), true)
          toast.success(result.message || '部署成功')
        } catch {}
      }
    }
  } finally {
    deployLoading.value = false
  }
}

// ===== Dedup =====
const dedupLoading = ref(false)
const dedupGroups = ref([])
const dedupTotalDuplicates = ref(0)
const dedupSelections = ref({})

async function scanDuplicates() {
  dedupLoading.value = true; dedupGroups.value = []; dedupTotalDuplicates.value = 0; dedupSelections.value = {}
  try {
    const r = await api.getDuplicates()
    dedupGroups.value = r.groups || []; dedupTotalDuplicates.value = r.totalDuplicates || 0
    const s = {}; r.groups.forEach((g, i) => { if (g.items.length) s[i] = g.items[0].id }); dedupSelections.value = s
    if (!r.groups.length) toast.info('未发现重复题目')
  } catch (e) {} finally { dedupLoading.value = false }
}
function selectDedupKeep(gi, id) { dedupSelections.value = { ...dedupSelections.value, [gi]: id } }
function selectNewestAll() { const s = {}; dedupGroups.value.forEach((g, i) => { if (g.items.length) s[i] = g.items[0].id }); dedupSelections.value = s }
function selectOldestAll() { const s = {}; dedupGroups.value.forEach((g, i) => { if (g.items.length) s[i] = g.items[g.items.length-1].id }); dedupSelections.value = s }
async function resolveDuplicates() {
  const groups = dedupGroups.value.map((g, i) => ({ type: g.type, content: g.content, keepId: dedupSelections.value[i] })).filter(g => g.keepId)
  if (!groups.length) { toast.error('请至少为一组选择要保留的题目'); return }
  const ok = await confirm.show({ title: '去重处理', message: `将保留每组选中的题目，其余 ${dedupTotalDuplicates.value} 条重复题目移至回收站。`, confirmText: '确认去重', danger: true })
  if (!ok) return
  dedupLoading.value = true
  try { const r = await api.resolveDuplicates({ groups }); toast.success(r.message || '去重完成'); trashStore.increment(r.trashed || 0); await scanDuplicates() }
  catch (e) {} finally { dedupLoading.value = false }
}
function formatDateShort(d) { return d ? d.slice(0,16).replace('T',' ') : '-' }

async function batchDeleteByDate() {
  if (!batchFilters.before && !batchFilters.after && !batchFilters.type && !batchFilters.category) {
    toast.error('请至少选择一个删除条件')
    return
  }
  const parts = []
  if (batchFilters.after) parts.push(`创建于 ${batchFilters.after} 之后`)
  if (batchFilters.before) parts.push(`创建于 ${batchFilters.before} 之前`)
  if (batchFilters.type) parts.push(`题型为 ${batchFilters.type}`)
  if (batchFilters.category) parts.push(`分类为 ${batchFilters.category}`)

  const ok = await confirm.show({
    title: '批量删除',
    message: `将删除${parts.join('且')}的题目，移至回收站。确定继续？`,
    confirmText: '确认删除',
    danger: true,
  })
  if (!ok) return

  try {
    const result = await api.batchDelete(batchFilters)
    if (result.deleted) trashStore.increment(result.deleted)
    toast.success(result.message || '已移至回收站')
    batchFilters.before = ''
    batchFilters.after = ''
    batchFilters.type = ''
    batchFilters.category = ''
  } catch (e) {
    // handled
  }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">数据管理</h1>
      <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">导入导出、备份与批量操作</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Database Settings -->
      <div class="card lg:col-span-2">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-btn bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">数据库设置</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark">切换数据库文件以管理不同的题库</p>
          </div>
        </div>

        <!-- Current DB Info -->
        <div class="bg-notion-surface dark:bg-notion-surface-dark rounded-card p-4 mb-4 border border-notion-border dark:border-notion-border-dark">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs text-notion-muted dark:text-notion-muted-dark">当前数据库</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium">使用中</span>
          </div>
          <div class="flex items-center gap-2 mb-3" :title="dbInfo.currentPath">
            <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            <span class="text-sm font-medium text-notion-text dark:text-notion-text-dark truncate">{{ getFileName(dbInfo.currentPath) }}</span>
          </div>
          <p class="text-[11px] font-mono text-notion-muted dark:text-notion-muted-dark truncate mb-3 pl-6" :title="dbInfo.currentPath">{{ getParentDir(dbInfo.currentPath) }}/</p>
          <div class="flex flex-wrap gap-x-6 gap-y-1.5 pl-6">
            <div class="flex items-center gap-1.5 text-xs text-notion-muted dark:text-notion-muted-dark">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <span>题目 <strong class="text-notion-text dark:text-notion-text-dark">{{ dbInfo.questionCount }}</strong></span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-notion-muted dark:text-notion-muted-dark">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>回收站 <strong class="text-notion-text dark:text-notion-text-dark">{{ dbInfo.trashCount }}</strong></span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-notion-muted dark:text-notion-muted-dark">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
              <span>分类 <strong class="text-notion-text dark:text-notion-text-dark">{{ dbInfo.categoryCount }}</strong></span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-notion-muted dark:text-notion-muted-dark">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4"/></svg>
              <span>大小 <strong class="text-notion-text dark:text-notion-text-dark">{{ formatFileSize(dbInfo.fileSize) }}</strong></span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <button @click="triggerDbFileInput" :disabled="dbLoading" class="btn-primary text-xs py-2 px-4">
            <svg v-if="dbLoading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
            {{ dbLoading ? '处理中...' : '选择数据库文件' }}
          </button>
          <input ref="dbFileInput" type="file" accept=".db" style="display:none" @change="handleDbFileSelect" />
          <button @click="resetDb" :disabled="dbLoading || dbInfo.currentPath === dbInfo.recentPaths?.[0] && dbInfo.recentPaths?.length <= 1" class="btn-secondary text-xs py-2 px-4">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            切回默认数据库
          </button>
        </div>

        <!-- Recent databases -->
        <div v-if="dbInfo.recentPaths && dbInfo.recentPaths.filter(p => p !== dbInfo.currentPath).length > 0">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark">最近使用的数据库</p>
            <span class="text-[11px] text-notion-muted dark:text-notion-muted-dark">{{ dbInfo.recentPaths.length }} 个</span>
          </div>
          <div class="space-y-1">
            <div
              v-for="p in displayedRecentPaths"
              :key="p"
              class="flex items-center gap-3 px-3 py-2.5 rounded-card text-xs cursor-pointer transition-colors group"
              :class="p === dbInfo.currentPath
                ? 'bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent'"
              @click="switchToRecent(p)"
            >
              <div class="w-7 h-7 rounded-btn flex items-center justify-center flex-shrink-0"
                :class="p === dbInfo.currentPath ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'">
                <svg class="w-3.5 h-3.5" :class="p === dbInfo.currentPath ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium truncate" :class="p === dbInfo.currentPath ? 'text-indigo-700 dark:text-indigo-300' : 'text-notion-text dark:text-notion-text-dark'">{{ getFileName(p) }}</span>
                  <span v-if="p === dbInfo.currentPath" class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium flex-shrink-0">当前</span>
                </div>
                <p class="text-[11px] font-mono truncate" :class="p === dbInfo.currentPath ? 'text-indigo-500/70 dark:text-indigo-400/50' : 'text-notion-muted dark:text-notion-muted-dark'" :title="p">{{ getParentDir(p) }}/</p>
              </div>
              <button
                v-if="p !== dbInfo.currentPath"
                @click="removeRecentPath(p, $event)"
                class="flex-shrink-0 p-1 rounded-btn opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                title="从列表中移除"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <button
            v-if="dbInfo.recentPaths.length > RECENT_SHOW_LIMIT"
            @click="showAllRecent = !showAllRecent"
            class="mt-2 text-xs text-notion-accent dark:text-notion-accent-dark hover:underline flex items-center gap-1"
          >
            <svg class="w-3 h-3 transition-transform" :class="showAllRecent ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
            {{ showAllRecent ? '收起' : `查看全部 ${dbInfo.recentPaths.length} 个` }}
          </button>
        </div>
      </div>

      <!-- Deploy Database -->
      <div class="card lg:col-span-2">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-btn bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">部署到刷课软件</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark">将题库数据库复制到刷课软件的数据库目录</p>
          </div>
        </div>

        <!-- Target directory input -->
        <div class="mb-4">
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">刷课软件数据库目录</label>
          <div class="flex gap-2">
            <input
              v-model="targetDir"
              type="text"
              class="input-field flex-1"
              placeholder="D:\English_App\yatori-go-console\...\db"
              @keyup.enter="verifyTargetDir"
            />
            <button @click="verifyTargetDir" :disabled="targetDirLoading" class="btn-secondary text-xs py-2 px-3 whitespace-nowrap">
              {{ targetDirLoading ? '验证中...' : '验证' }}
            </button>
          </div>
          <p v-if="targetDirStatus === 'valid'" class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">目录有效</p>
          <p v-if="targetDirStatus === 'invalid'" class="text-xs text-red-500 mt-1">目录不存在，请检查路径</p>
        </div>

        <template v-if="targetDirStatus === 'valid'">
          <!-- Available databases -->
          <div class="mb-4">
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-2">选择要部署的数据库</label>
            <div v-if="availableDbs.length === 0" class="text-xs text-notion-muted dark:text-notion-muted-dark py-2">暂无可用数据库</div>
            <div v-else class="space-y-1.5">
              <label
                v-for="db in availableDbs"
                :key="db.path"
                class="flex items-center gap-3 px-3 py-2 rounded-card text-xs cursor-pointer transition-colors border"
                :class="deploySource === db.path
                  ? 'bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'"
              >
                <input type="radio" v-model="deploySource" :value="db.path" class="accent-emerald-600 dark:accent-emerald-400" />
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-medium text-notion-text dark:text-notion-text-dark">{{ db.name }}</span>
                  <span class="ml-2 text-notion-muted dark:text-notion-muted-dark">{{ formatSize(db.size) }}</span>
                </div>
              </label>
            </div>
          </div>

          <!-- File name + deploy -->
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">保存为文件名</label>
              <input v-model="deployFileName" type="text" class="input-field w-full" placeholder="default.db" />
            </div>
            <button @click="deployDb" :disabled="deployLoading || !deploySource" class="btn-primary text-xs py-2 px-4 whitespace-nowrap">
              <svg v-if="deployLoading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ deployLoading ? '部署中...' : '部署' }}
            </button>
          </div>
        </template>
      </div>

      <!-- Database Backup -->
      <div class="card">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-btn bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">数据库备份</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark">下载完整的 SQLite 数据库文件</p>
          </div>
        </div>
        <button @click="downloadBackup" class="btn-primary w-full justify-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          下载数据库备份
        </button>
      </div>

      <!-- Export JSON -->
      <div class="card">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-btn bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">导出 JSON</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark">按条件导出题目为 JSON 文件</p>
          </div>
        </div>
        <div class="space-y-3 mb-4">
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">题型筛选</label>
            <select v-model="exportFilters.type" class="select-field w-full">
              <option value="">全部题型</option>
              <option v-for="t in QUESTION_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">分类筛选</label>
            <select v-model="exportFilters.category" class="select-field w-full">
              <option value="">全部分类</option>
              <option v-for="c in categories" :key="c.id" :value="c.name">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <button @click="exportJson" class="btn-primary w-full justify-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
          导出 JSON
        </button>
      </div>

      <!-- Import JSON -->
      <div class="card lg:col-span-2">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-btn bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">导入 JSON</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark">从 JSON 文件导入题目，重复和答案冲突会逐条展示</p>
          </div>
        </div>
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <label class="btn-secondary cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              选择文件
              <input type="file" accept=".json" @change="handleFileUpload" class="hidden" />
            </label>
            <span class="text-xs text-notion-muted dark:text-notion-muted-dark">或直接粘贴 JSON 数据</span>
          </div>
          <textarea
            v-model="importText"
            rows="8"
            class="input-field font-mono text-xs"
            :class="isDragging ? 'ring-2 ring-notion-accent/40 dark:ring-notion-accent-dark/40 border-notion-accent dark:border-notion-accent-dark' : ''"
            placeholder='[{"type":"单选题","content":"题目内容","options":["A","B","C","D"],"answers":["A"],"category":"默认"}]'
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
          />
          <div class="flex justify-end">
            <button @click="importJson" :disabled="importing || !importText.trim()" class="btn-primary">
              <svg v-if="importing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ importing ? '导入中...' : '开始导入' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Batch Delete -->
      <div class="card lg:col-span-2">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-btn bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">按条件批量删除</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark">按日期、题型或分类批量删除题目（至少选一个条件）</p>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">起始日期（之后）</label>
            <input v-model="batchFilters.after" type="date" class="input-field" />
          </div>
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">结束日期（之前）</label>
            <input v-model="batchFilters.before" type="date" class="input-field" />
          </div>
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">题型</label>
            <select v-model="batchFilters.type" class="select-field w-full">
              <option value="">全部</option>
              <option v-for="t in QUESTION_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">分类</label>
            <select v-model="batchFilters.category" class="select-field w-full">
              <option value="">全部</option>
              <option v-for="c in categories" :key="c.id" :value="c.name">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end">
          <button @click="batchDeleteByDate" class="btn-danger">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            批量删除
          </button>
        </div>
      </div>
    </div>

    <!-- Dedup Tool -->
    <div class="card lg:col-span-2">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-btn bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
          <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </div>
        <div>
          <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">题目去重</h2>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">扫描题型+内容完全相同的题目，选择保留哪条</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <button @click="scanDuplicates" :disabled="dedupLoading" class="btn-primary">
          {{ dedupLoading ? '扫描中...' : '扫描重复题目' }}
        </button>
        <template v-if="dedupGroups.length > 0">
          <span class="text-sm text-notion-muted dark:text-notion-muted-dark">发现 <strong>{{ dedupGroups.length }}</strong> 组重复，共 <strong class="text-amber-600 dark:text-amber-400">{{ dedupTotalDuplicates }}</strong> 条待清理</span>
          <button @click="selectNewestAll" class="btn-secondary text-xs py-1.5 px-3">全部保留最新</button>
          <button @click="selectOldestAll" class="btn-secondary text-xs py-1.5 px-3">全部保留最早</button>
          <button @click="resolveDuplicates" :disabled="dedupLoading" class="btn-danger text-xs py-1.5 px-3">去重处理（移除 {{ dedupTotalDuplicates }} 条）</button>
        </template>
      </div>
      <div v-if="dedupGroups.length > 0" class="space-y-4 max-h-[600px] overflow-y-auto">
        <div v-for="(group, gi) in dedupGroups" :key="gi" class="border border-notion-border dark:border-notion-border-dark rounded-card overflow-hidden">
          <div class="px-4 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-b border-notion-border dark:border-notion-border-dark flex items-center gap-3">
            <span class="badge badge-type">{{ group.type }}</span>
            <span class="badge badge-category">{{ group.items[0]?.category || '默认' }}</span>
            <span class="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400">{{ group.count }} 条相同</span>
          </div>
          <div class="px-4 py-2 border-b border-notion-border dark:border-notion-border-dark bg-gray-50/30 dark:bg-gray-800/30">
            <p class="text-sm text-notion-text dark:text-notion-text-dark line-clamp-2">{{ group.content }}</p>
          </div>
          <div class="divide-y divide-notion-border dark:divide-notion-border-dark">
            <div v-for="item in group.items" :key="item.id" class="px-4 py-3 flex items-center gap-3" :class="dedupSelections[gi] === item.id ? 'bg-green-50/50 dark:bg-green-900/10' : 'bg-red-50/30 dark:bg-red-900/5'">
              <input type="radio" :name="`dedup-g${gi}`" :checked="dedupSelections[gi]===item.id" @change="selectDedupKeep(gi, item.id)" class="accent-notion-accent dark:accent-notion-accent-dark" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs font-mono text-notion-muted dark:text-notion-muted-dark">ID: {{ item.id }}</span>
                  <span v-if="dedupSelections[gi]===item.id" class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">保留</span>
                  <span v-else class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">移除</span>
                </div>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-notion-muted dark:text-notion-muted-dark">
                  <span>创建: {{ formatDateShort(item.created_at) }}</span>
                  <span>更新: {{ formatDateShort(item.updated_at) }}</span>
                  <span v-if="item.answers">答案: {{ Array.isArray(item.answers) ? item.answers.join(', ') : item.answers }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="!dedupLoading" class="text-center py-8">
        <p class="text-sm text-notion-muted dark:text-notion-muted-dark">点击「扫描重复题目」开始检测</p>
      </div>
    </div>

    <!-- Import Category Dialog -->
    <ImportCategoryDialog
      v-if="showCategoryDialog"
      :categories="importCategories"
      :totalQuestions="pendingQuestions?.length || 0"
      @confirm="onCategoryConfirmed"
      @cancel="onCategoryCancelled"
    />

    <!-- Import Result Dialog -->
    <ImportResultDialog
      v-if="showResultDialog"
      :duplicates="resultDuplicates"
      :conflicts="resultConflicts"
      :importSummary="importSummary"
      @close="closeResultDialog"
      @resolved="closeResultDialog"
    />

    <!-- DB Upload Naming Dialog -->
    <div v-if="showUploadDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="cancelUpload">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-base font-semibold text-notion-text dark:text-notion-text-dark mb-2">上传数据库</h3>
        <p class="text-sm text-notion-muted dark:text-notion-muted-dark mb-4">
          文件：<strong class="text-notion-text dark:text-notion-text-dark">{{ pendingDbFile?.name }}</strong>
        </p>
        <div class="mb-5">
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">数据库名称</label>
          <input
            v-model="uploadCustomName"
            type="text"
            class="input-field w-full"
            placeholder="输入数据库名称"
            @keyup.enter="confirmUpload"
          />
          <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-1.5">将保存为 <code class="text-notion-accent dark:text-notion-accent-dark">{{ uploadCustomName || '...' }}.db</code></p>
        </div>
        <div class="flex gap-2 justify-end">
          <button @click="cancelUpload" class="btn-secondary">取消</button>
          <button @click="confirmUpload" class="btn-primary">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            上传
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
