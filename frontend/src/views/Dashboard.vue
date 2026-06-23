<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useThemeStore } from '@/stores/theme'
import { TYPE_COLORS, TYPE_ICONS, TYPE_CARD_COLORS } from '@/composables/constants'
import Skeleton from '@/components/Skeleton.vue'
// FIX #5: Tree-shake Chart.js — import only what we need (line chart)
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js'

defineOptions({ name: 'Dashboard' })

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

const api = useApi()
const router = useRouter()
const toast = useToastStore()
const themeStore = useThemeStore()

const stats = ref(null)
const loading = ref(true)
const chartRef = ref(null)
let chartInstance = null

const trendDays = ref(30)
const trendOptions = [7, 30, 90]

// 弹窗公告
const modalContent = ref('')
const modalEnabled = ref(false)
const showModal = ref(false)

// Markdown 渲染
const renderedModalContent = computed(() => {
  if (!modalContent.value) return ''
  return marked.parse(modalContent.value)
})

// 横幅公告
const bannerContent = ref('')
const bannerEnabled = ref(false)
const bannerDismissed = ref(false)

const SEEN_KEY = 'seen_announcement_modal_at'
let modalUpdatedAt = ''

async function loadAnnouncement() {
  try {
    const data = await api.getSiteSettings()
    // 弹窗公告
    modalContent.value = data.announcement_modal || ''
    modalEnabled.value = data.announcement_modal_enabled || false
    modalUpdatedAt = data.announcement_modal_updated_at || ''
    if (modalEnabled.value && modalContent.value) {
      const lastSeen = localStorage.getItem(SEEN_KEY) || ''
      if (!lastSeen || modalUpdatedAt > lastSeen) {
        showModal.value = true
      }
    }
    // 横幅公告
    bannerContent.value = data.announcement_banner || ''
    bannerEnabled.value = data.announcement_banner_enabled || false
  } catch {}
}

function closeModal() {
  showModal.value = false
  try {
    localStorage.setItem(SEEN_KEY, modalUpdatedAt || new Date().toISOString())
  } catch {}
}

async function loadStats(days) {
  loading.value = true
  try {
    stats.value = await api.getStats(days)
  } catch (e) {
    // toast already shown
  } finally {
    loading.value = false
  }
}

function setTrendDays(days) {
  trendDays.value = days
  loadStats(days)
}

onMounted(() => {
  loadStats()
  loadAnnouncement()
})

// Watch for chartRef to become available (handles v-if timing)
watch(chartRef, (el) => {
  if (el && stats.value?.dailyTrend?.length) {
    nextTick(() => renderChart())
  }
})

// Also try after stats load
watch(stats, (val) => {
  if (val?.dailyTrend?.length) {
    nextTick(() => {
      if (chartRef.value) renderChart()
    })
  }
})

onBeforeUnmount(() => { if (chartInstance) { chartInstance.destroy(); chartInstance = null } })

function renderChart() {
  if (!chartRef.value || !stats.value?.dailyTrend?.length) return
  const isDark = document.documentElement.classList.contains('dark')
  const ctx = chartRef.value.getContext('2d')
  if (!ctx) return

  if (chartInstance) chartInstance.destroy()

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: stats.value.dailyTrend.map(d => d.date.slice(5)),
      datasets: [{
        label: '新增题目',
        data: stats.value.dailyTrend.map(d => d.cnt),
        borderColor: isDark ? '#7c6ef0' : '#5645d4',
        backgroundColor: isDark ? 'rgba(124,110,240,0.1)' : 'rgba(86,69,212,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: isDark ? '#7c6ef0' : '#5645d4',
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#333' : '#fff',
          titleColor: isDark ? '#e8e6e3' : '#37352f',
          bodyColor: isDark ? '#e8e6e3' : '#37352f',
          borderColor: isDark ? '#555' : '#e5e3df',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: isDark ? '#6b6b6b' : '#9b9a97',
            font: { size: 11 },
            maxRotation: 0,
            maxTicksLimit: 10,
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: isDark ? '#333' : '#f0f0f0' },
          ticks: {
            color: isDark ? '#6b6b6b' : '#9b9a97',
            font: { size: 11 },
            stepSize: 1,
          }
        }
      }
    }
  })
}

const totalIconColor = 'bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark'
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">仪表盘</h1>
      <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">题库数据概览</p>
    </div>

    <!-- 横幅公告 -->
    <div
      v-if="bannerEnabled && bannerContent && !bannerDismissed"
      class="mb-5 sm:mb-6 p-3 sm:p-4 rounded-card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-3"
    >
      <svg class="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">通知</p>
        <p class="text-sm text-blue-800 dark:text-blue-200 leading-relaxed line-clamp-2">{{ bannerContent }}</p>
      </div>
      <button @click="bannerDismissed = true" class="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors flex-shrink-0">
        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- 弹窗公告模态框 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showModal" class="fixed inset-0 z-[9997] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="closeModal" />
          <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark w-full max-w-lg h-[70vh] sm:h-[60vh] flex flex-col animate-fade-in-up">
            <!-- Header -->
            <div class="flex-shrink-0 px-5 sm:px-6 py-4 border-b border-notion-border dark:border-notion-border-dark flex items-center justify-between">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
                </svg>
                <h2 class="text-base sm:text-lg font-semibold text-notion-text dark:text-notion-text-dark">公告</h2>
              </div>
              <button @click="closeModal" class="p-1.5 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <svg class="w-5 h-5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <!-- Content -->
            <div class="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
              <div class="markdown-body text-sm sm:text-base text-notion-text dark:text-notion-text-dark" v-html="renderedModalContent"></div>
            </div>
            <!-- Footer -->
            <div class="flex-shrink-0 px-5 sm:px-6 py-3 border-t border-notion-border dark:border-notion-border-dark flex justify-end">
              <button @click="closeModal" class="btn-primary text-sm">我知道了</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Loading Skeleton -->
    <template v-if="loading">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
        <div v-for="i in 5" :key="i" class="card">
          <Skeleton width="36px" height="36px" rounded="8px" class="mb-3" />
          <Skeleton width="60%" height="10px" class="mb-2" />
          <Skeleton width="40%" height="28px" class="mb-1" />
          <Skeleton width="50%" height="10px" />
        </div>
      </div>
      <div class="card">
        <Skeleton width="30%" height="14px" class="mb-4" />
        <Skeleton width="100%" height="200px" />
      </div>
    </template>

    <template v-else-if="stats">
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
        <!-- Total -->
        <div class="card">
          <div class="flex items-center gap-3 mb-3">
            <div :class="['w-9 h-9 rounded-btn flex items-center justify-center', totalIconColor]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <p class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider">总计</p>
          </div>
          <p class="text-3xl font-bold text-notion-accent dark:text-notion-accent-dark">{{ stats.total }}</p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">道题目</p>
        </div>
        <!-- Trash count -->
        <div v-if="stats.trashCount > 0" class="card cursor-pointer hover:shadow-md transition-shadow" @click="router.push('/trash')">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-btn flex items-center justify-center bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <p class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider">回收站</p>
          </div>
          <p class="text-3xl font-bold text-red-500 dark:text-red-400">{{ stats.trashCount }}</p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">道待清理</p>
        </div>
        <!-- By type -->
        <div v-for="t in stats.byType" :key="t.type" class="card">
          <div class="flex items-center gap-3 mb-3">
            <div :class="['w-9 h-9 rounded-btn flex items-center justify-center', TYPE_CARD_COLORS[t.type] || 'bg-gray-50 text-gray-600']">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="TYPE_ICONS[t.type] || TYPE_ICONS['单选题']" />
              </svg>
            </div>
            <p class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark uppercase tracking-wider">{{ t.type }}</p>
          </div>
          <p class="text-3xl font-bold text-notion-text dark:text-notion-text-dark">{{ t.cnt }}</p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">道题目</p>
        </div>
      </div>

      <!-- Chart + Quick Actions -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <!-- Chart -->
        <div class="lg:col-span-2 card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">新增趋势</h2>
            <div class="flex items-center gap-1">
              <button
                v-for="opt in trendOptions"
                :key="opt"
                @click="setTrendDays(opt)"
                :class="[
                  'px-2.5 py-1 rounded-btn text-xs font-medium transition-colors',
                  trendDays === opt
                    ? 'bg-notion-accent text-white dark:bg-notion-accent-dark'
                    : 'text-notion-muted dark:text-notion-muted-dark hover:bg-gray-100 dark:hover:bg-gray-800'
                ]"
              >{{ opt }}天</button>
            </div>
          </div>
          <div class="h-64">
            <canvas v-if="stats.dailyTrend?.length" ref="chartRef" />
            <div v-else class="flex items-center justify-center h-full text-notion-muted dark:text-notion-muted-dark text-sm">
              暂无数据
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark mb-4">快捷操作</h2>
          <div class="space-y-3">
            <button @click="router.push('/questions')" class="w-full btn-primary justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              管理题目
            </button>
            <button @click="router.push('/categories')" class="w-full btn-secondary justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
              </svg>
              管理分类
            </button>
            <button @click="router.push('/data')" class="w-full btn-secondary justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              数据管理
            </button>
          </div>

          <!-- Category breakdown -->
          <div v-if="stats.byCategory?.length" class="mt-6 pt-4 border-t border-notion-border dark:border-notion-border-dark">
            <h3 class="text-sm font-medium text-notion-text dark:text-notion-text-dark mb-3">分类统计</h3>
            <div class="space-y-2 max-h-[132px] overflow-y-auto pr-1">
              <div v-for="c in stats.byCategory" :key="c.category" class="flex items-center justify-between text-sm">
                <span class="text-notion-muted dark:text-notion-muted-dark">{{ c.category }}</span>
                <span class="font-medium text-notion-text dark:text-notion-text-dark">{{ c.cnt }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
