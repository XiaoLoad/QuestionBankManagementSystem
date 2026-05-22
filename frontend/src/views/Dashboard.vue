<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useThemeStore } from '@/stores/theme'
import { TYPE_COLORS, TYPE_ICONS, TYPE_CARD_COLORS } from '@/composables/constants'
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

onMounted(() => loadStats())

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

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
    </div>

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
