<template>
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <button @click="router.push('/users')" class="text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark">
            {{ userInfo.display_name || userInfo.username || '用户' }} 的活动日志
          </h1>
        </div>
        <p class="text-xs sm:text-sm text-notion-muted dark:text-notion-muted-dark ml-7">查看用户的登录和刷题记录</p>
      </div>
      <button v-if="logs.length > 0" @click="handleClearLogs" class="btn-danger text-sm flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        清空日志
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div class="card p-3 sm:p-4">
        <p class="text-xs text-notion-muted dark:text-notion-muted-dark">登录次数</p>
        <p class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark mt-1">{{ stats.totalLogins || 0 }}</p>
      </div>
      <div class="card p-3 sm:p-4">
        <p class="text-xs text-notion-muted dark:text-notion-muted-dark">刷题次数</p>
        <p class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark mt-1">{{ stats.totalQuizSessions || 0 }}</p>
      </div>
      <div class="card p-3 sm:p-4">
        <p class="text-xs text-notion-muted dark:text-notion-muted-dark">复习次数</p>
        <p class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark mt-1">{{ stats.totalReviewSessions || 0 }}</p>
      </div>
      <div class="card p-3 sm:p-4 col-span-2 sm:col-span-1">
        <p class="text-xs text-notion-muted dark:text-notion-muted-dark">常刷题库</p>
        <p class="text-sm sm:text-base font-medium text-notion-text dark:text-notion-text-dark mt-1 truncate">
          {{ stats.quizByCategory?.[0]?.category || '-' }}
        </p>
      </div>
    </div>

    <!-- Filters -->
    <div class="card p-3 sm:p-4 mb-3 sm:mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <button
          @click="filterAction = ''; loadLogs()"
          :class="['px-3 py-1.5 text-xs rounded-btn border transition-colors', filterAction === '' ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark' : 'border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark hover:bg-gray-100 dark:hover:bg-gray-800']"
        >全部</button>
        <button
          @click="filterAction = 'login'; loadLogs()"
          :class="['px-3 py-1.5 text-xs rounded-btn border transition-colors', filterAction === 'login' ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark' : 'border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark hover:bg-gray-100 dark:hover:bg-gray-800']"
        >登录</button>
        <button
          @click="filterAction = 'quiz_start'; loadLogs()"
          :class="['px-3 py-1.5 text-xs rounded-btn border transition-colors', filterAction === 'quiz_start' ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark' : 'border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark hover:bg-gray-100 dark:hover:bg-gray-800']"
        >刷题</button>
        <button
          @click="filterAction = 'review_start'; loadLogs()"
          :class="['px-3 py-1.5 text-xs rounded-btn border transition-colors', filterAction === 'review_start' ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark' : 'border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark hover:bg-gray-100 dark:hover:bg-gray-800']"
        >复习</button>
        <button
          @click="filterAction = 'quiz_end'; loadLogs()"
          :class="['px-3 py-1.5 text-xs rounded-btn border transition-colors', filterAction === 'quiz_end' ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark' : 'border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark hover:bg-gray-100 dark:hover:bg-gray-800']"
        >结果</button>
      </div>
    </div>

    <!-- Logs List -->
    <div class="card p-0 overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
      </div>

      <!-- Empty -->
      <div v-else-if="logs.length === 0" class="text-center py-12">
        <svg class="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-notion-muted dark:text-notion-muted-dark mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p class="text-sm text-notion-muted dark:text-notion-muted-dark">暂无活动记录</p>
      </div>

      <!-- Logs -->
      <div v-else class="divide-y divide-notion-border dark:divide-notion-border-dark">
        <div v-for="log in logs" :key="log.id" class="p-3 sm:p-4 hover:bg-notion-surface/50 dark:hover:bg-notion-surface-dark/50 transition-colors">
          <div class="flex items-start gap-3">
            <!-- Icon -->
            <div :class="['flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', log.action === 'login' ? 'bg-blue-100 dark:bg-blue-900/30' : log.action === 'quiz_end' ? 'bg-amber-100 dark:bg-amber-900/30' : log.action === 'review_start' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-green-100 dark:bg-green-900/30']">
              <svg v-if="log.action === 'login'" class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <svg v-else-if="log.action === 'quiz_end'" class="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <svg v-else-if="log.action === 'review_start'" class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-notion-text dark:text-notion-text-dark">
                  {{ log.action === 'login' ? '登录系统' : log.action === 'quiz_start' ? '开始刷题' : log.action === 'review_start' ? '开始复习' : '完成刷题' }}
                </span>
                <span class="text-[10px] text-notion-muted dark:text-notion-muted-dark">
                  {{ formatDate(log.created_at) }}
                </span>
              </div>
              <div v-if="log.detail" class="text-xs text-notion-muted dark:text-notion-muted-dark">
                <template v-if="log.action === 'quiz_start' || log.action === 'review_start'">
                  <span v-if="log.detail.category">题库：{{ log.detail.category }}</span>
                  <span v-if="log.detail.count" class="ml-2">题目：{{ log.detail.count }} 题</span>
                  <span v-if="log.detail.types" class="ml-2">题型：{{ log.detail.types.join('、') }}</span>
                </template>
                <template v-else-if="log.action === 'quiz_end'">
                  <span v-if="log.detail.category">题库：{{ log.detail.category }}</span>
                  <span v-if="log.detail.total" class="ml-2">{{ log.detail.correct }}/{{ log.detail.total }} 正确</span>
                  <span v-if="log.detail.accuracy !== undefined" class="ml-2" :class="log.detail.accuracy >= 60 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">正确率 {{ log.detail.accuracy }}%</span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between p-3 sm:p-4 border-t border-notion-border dark:border-notion-border-dark">
        <span class="text-xs text-notion-muted dark:text-notion-muted-dark">共 {{ total }} 条</span>
        <div class="flex items-center gap-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage <= 1"
            class="px-3 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >上一页</button>
          <span class="text-xs text-notion-muted dark:text-notion-muted-dark">{{ currentPage }} / {{ totalPages }}</span>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage >= totalPages"
            class="px-3 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToastStore } from '../stores/toast'
import { useConfirmStore } from '../stores/confirm'

defineOptions({ name: 'UserActivityLog' })

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const confirmStore = useConfirmStore()

const userId = route.params.id
const userInfo = ref({})
const stats = ref({})
const logs = ref([])
const loading = ref(false)
const filterAction = ref('')
const currentPage = ref(1)
const total = ref(0)
const totalPages = ref(0)

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function loadStats() {
  try {
    const res = await fetch(`/api/activity-logs/stats/${userId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (res.ok) {
      const data = await res.json()
      stats.value = data
      userInfo.value = data.user || {}
    }
  } catch (err) {
    console.error('获取统计失败:', err)
  }
}

async function loadLogs() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      user_id: userId,
      page: currentPage.value,
      pageSize: 20,
    })
    if (filterAction.value) {
      params.set('action', filterAction.value)
    }
    const res = await fetch(`/api/activity-logs?${params}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (res.ok) {
      const data = await res.json()
      logs.value = data.items
      total.value = data.total
      totalPages.value = data.totalPages
    }
  } catch (err) {
    console.error('获取日志失败:', err)
  } finally {
    loading.value = false
  }
}

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadLogs()
}

async function handleClearLogs() {
  const confirmed = await confirmStore.show({
    title: '清空日志',
    message: `确定要清空「${userInfo.value.display_name || userInfo.value.username}」的所有活动日志吗？此操作不可撤销。`,
    confirmText: '清空',
    cancelText: '取消'
  })
  if (!confirmed) return

  try {
    const res = await fetch(`/api/activity-logs/user/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (res.ok) {
      const data = await res.json()
      toastStore.success(data.message || '日志已清空')
      logs.value = []
      total.value = 0
      totalPages.value = 0
      loadStats()
    } else {
      const data = await res.json()
      toastStore.error(data.error || '清空失败')
    }
  } catch (err) {
    toastStore.error('清空失败: ' + err.message)
  }
}

onMounted(() => {
  loadStats()
  loadLogs()
})
</script>
