<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import Skeleton from '@/components/Skeleton.vue'
// Tree-shake Chart.js — 只注册实际用到的图表类型
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  BarController,
  BarElement,
  Legend,
} from 'chart.js'

defineOptions({ name: 'Dashboard' })

Chart.register(
  LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler,
  BarController, BarElement, Legend
)

const api = useApi()
const router = useRouter()
const themeStore = useThemeStore()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.isAdmin)

const stats = ref(null)
const adminStats = ref(null)
// 首屏加载：整页骨架屏；切换区间/刷新：仅原地更新，不重建视图
const loading = ref(true)
const refreshing = ref(false)

const trendDays = ref(30)
const trendOptions = [7, 30, 90]

const chartRef = ref(null)
const activityChartRef = ref(null)
const levelBarRef = ref(null)
let chartInstance = null
let activityChartInstance = null
let levelBarInstance = null

// 题型配色：沿用项目 constants 的语义色，明暗两套都已适配
const TYPE_HEX = {
  '单选题': { light: '#2196f3', dark: '#42a5f5' },
  '判断题': { light: '#4caf50', dark: '#66bb6a' },
  '多选题': { light: '#9c27b0', dark: '#b07cc6' },
  '填空题': { light: '#ff9800', dark: '#ffb74d' },
  '简答题': { light: '#e91e63', dark: '#f06292' },
}

// 分类配色：按排名取固定色板，保证同一分每次刷新颜色稳定
// 注意：Canvas 的 backgroundColor 不析 var()，必须用字面色值
const CATEGORY_PALETTE = [
  '#5645d4', '#4caf50', '#2196f3', '#ff9800', '#e91e63',
  '#9c27b0', '#00bcd4', '#795548', '#607d8b',
]

// 两张卡统一高度：分类明细超出部分在卡内滚动，趋势图比例不被拉伸变形
const CARD_HEIGHT = 440

const accent = computed(() => (themeStore.isDark ? '#7c6ef0' : '#5645d4'))
const muted = computed(() => (themeStore.isDark ? '#6b6b6b' : '#9b9a97'))

// Canvas 不解析 CSS 变量与 color-mix，图表填充色需算成 rgba 字面量
function accentAlpha(alpha) {
  const [r, g, b] = themeStore.isDark ? [124, 110, 240] : [86, 69, 212]
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function typeColor(type) {
  return (TYPE_HEX[type] || TYPE_HEX['单选题'])[themeStore.isDark ? 'dark' : 'light']
}

// 题型构成：用于堆叠占比条与图例
const typeBreakdown = computed(() => {
  const list = (stats.value?.byType || []).slice()
  const total = list.reduce((s, t) => s + t.cnt, 0) || 1
  return list
    .map(t => ({
      type: t.type,
      cnt: t.cnt,
      percent: Math.round((t.cnt / total) * 1000) / 10,
      color: typeColor(t.type),
    }))
    .sort((a, b) => b.cnt - a.cnt)
})

// 分类明细：带占比与迷你条形，全量列出，卡片按内容高度撑开
const categoryRows = computed(() => {
  const list = stats.value?.byCategory || []
  const total = list.reduce((s, c) => s + c.cnt, 0) || 1
  return list.map((c, i) => ({
    name: c.category,
    cnt: c.cnt,
    percent: Math.round((c.cnt / total) * 1000) / 10,
    color: i === 0 ? accent.value : CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  }))
})

const categoryTotal = computed(() => (stats.value?.byCategory || []).length)

// 趋势衍生指标：区间新增 / 日均 / 峰值
const trendTotal = computed(() =>
  (stats.value?.dailyTrend || []).reduce((s, d) => s + d.cnt, 0)
)
const trendAvg = computed(() => {
  const days = stats.value?.dailyTrend?.length || 0
  return days ? Math.round((trendTotal.value / days) * 10) / 10 : 0
})
const trendPeak = computed(() =>
  (stats.value?.dailyTrend || []).reduce((m, d) => Math.max(m, d.cnt), 0)
)

// 用户正确率索引：把 accuracyRanking 结果挂到 id 上，供表格内联渲染
const accuracyMap = computed(() => {
  const map = {}
  for (const r of adminStats.value?.accuracyRanking || []) map[r.id] = r.accuracy
  return map
})

function accuracyOf(userId) {
  const v = accuracyMap.value[userId]
  return v === undefined ? null : v
}

// 用户活跃度分档：把连续的操作次数收敛为可读的四档
const activityLevels = computed(() => {
  const ranking = adminStats.value?.ranking || []
  const buckets = [
    { label: '高活跃', hint: '20 次以上', count: 0, color: accent.value },
    { label: '中活跃', hint: '5-20 次', count: 0, color: '#4caf50' },
    { label: '低活跃', hint: '1-5 次', count: 0, color: '#ff9800' },
    { label: '未活跃', hint: '近 30 天无操作', count: 0, color: muted.value },
  ]
  ranking.forEach(u => {
    if (u.actions > 20) buckets[0].count++
    else if (u.actions >= 5) buckets[1].count++
    else if (u.actions >= 1) buckets[2].count++
    else buckets[3].count++
  })
  return buckets
})

// 角色构成：管理员 / 普通用户占比
const roleSplit = computed(() => {
  const ranking = adminStats.value?.ranking || []
  const total = ranking.length || 1
  const admins = ranking.filter(u => u.role === 'admin').length
  return [
    { name: '管理员', cnt: admins, percent: Math.round((admins / total) * 1000) / 10 },
    { name: '普通用户', cnt: ranking.length - admins, percent: Math.round(((ranking.length - admins) / total) * 1000) / 10 },
  ]
})

async function loadStats(days) {
  // 已有数据时走「刷新」通道，避免整页闪屏
  if (stats.value) refreshing.value = true
  else loading.value = true
  try {
    stats.value = await api.getStats(days)
    if (isAdmin.value) {
      // 非管理员访问该接口会 403，静默降级为仅题库统计
      adminStats.value = await api.getAdminStats(days).catch(() => null)
    }
  } catch {
    // toast already shown
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function setTrendDays(days) {
  if (trendDays.value === days) return
  trendDays.value = days
  loadStats(days)
}

function goCategory(name) {
  router.push({ path: '/questions', query: { category: name } })
}

onMounted(() => loadStats())

watch(chartRef, (el) => {
  if (el && stats.value?.dailyTrend?.length) nextTick(() => renderChart())
})

watch(activityChartRef, (el) => {
  if (el && adminStats.value?.activityTrend?.length) nextTick(() => renderActivityChart())
})

watch(levelBarRef, (el) => {
  if (el && isAdmin.value) nextTick(() => renderLevelBar())
})

watch(stats, (val) => {
  if (val?.dailyTrend?.length && chartRef.value) nextTick(() => renderChart())
})

watch(adminStats, (val) => {
  if (!val) return
  if (val.activityTrend?.length && activityChartRef.value) nextTick(() => renderActivityChart())
  if (levelBarRef.value) nextTick(() => renderLevelBar())
})

// 主题切换后重绘：图表配色是硬编码色值，需跟随明暗
watch(() => themeStore.isDark, () => {
  nextTick(() => {
    renderChart()
    renderActivityChart()
    renderLevelBar()
  })
})

onBeforeUnmount(() => {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }
  if (activityChartInstance) { activityChartInstance.destroy(); activityChartInstance = null }
  if (levelBarInstance) { levelBarInstance.destroy(); levelBarInstance = null }
})

function tooltipTheme() {
  const dark = themeStore.isDark
  return {
    backgroundColor: dark ? '#333' : '#fff',
    titleColor: dark ? '#e8e6e3' : '#37352f',
    bodyColor: dark ? '#e8e6e3' : '#37352f',
    borderColor: dark ? '#555' : '#e5e3df',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
  }
}

function renderChart() {
  if (!chartRef.value || !stats.value?.dailyTrend?.length) return
  const ctx = chartRef.value.getContext('2d')
  if (!ctx) return

  const data = {
    labels: stats.value.dailyTrend.map(d => d.date.slice(5)),
    datasets: [{
      label: '新增题目',
      data: stats.value.dailyTrend.map(d => d.cnt),
      borderColor: accent.value,
      backgroundColor: accentAlpha(0.1),
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: accent.value,
      borderWidth: 2,
    }]
  }

  // 已有实例则原地更新，避免销毁重建造成的画布闪白
  if (chartInstance) {
    chartInstance.data = data
    chartInstance.update()
    return
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipTheme() },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: muted.value, font: { size: 11 }, maxRotation: 0, maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: themeStore.isDark ? '#333' : '#f0f0f0' },
          ticks: { color: muted.value, font: { size: 11 }, precision: 0 },
        }
      }
    }
  })
}

function renderActivityChart() {
  if (!activityChartRef.value || !adminStats.value?.activityTrend?.length) return
  const ctx = activityChartRef.value.getContext('2d')
  if (!ctx) return

  const green = themeStore.isDark ? '#66bb6a' : '#388e3c'
  const data = {
    labels: adminStats.value.activityTrend.map(d => d.date.slice(5)),
    datasets: [
      {
        label: '活跃用户',
        data: adminStats.value.activityTrend.map(d => d.users),
        borderColor: accent.value,
        backgroundColor: accentAlpha(0.1),
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
      },
      {
        label: '操作次数',
        data: adminStats.value.activityTrend.map(d => d.actions),
        borderColor: green,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        borderDash: [4, 3],
      },
    ]
  }

  if (activityChartInstance) {
    activityChartInstance.data = data
    activityChartInstance.update()
    return
  }

  activityChartInstance = new Chart(ctx, {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: muted.value, boxWidth: 12, font: { size: 11 } } },
        tooltip: tooltipTheme(),
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: muted.value, font: { size: 11 }, maxRotation: 0, maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: themeStore.isDark ? '#333' : '#f0f0f0' },
          ticks: { color: muted.value, font: { size: 11 }, precision: 0 },
        }
      }
    }
  })
}

function renderLevelBar() {
  if (!levelBarRef.value) return
  const ctx = levelBarRef.value.getContext('2d')
  if (!ctx) return

  const data = {
    labels: activityLevels.value.map(l => l.label),
    datasets: [{
      label: '用户数',
      data: activityLevels.value.map(l => l.count),
      backgroundColor: activityLevels.value.map(l => l.color),
      borderRadius: 6,
      borderSkipped: false,
      barPercentage: 0.62,
    }]
  }

  if (levelBarInstance) {
    levelBarInstance.data = data
    levelBarInstance.update()
    return
  }

  levelBarInstance = new Chart(ctx, {
    type: 'bar',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipTheme() },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: muted.value, font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: themeStore.isDark ? '#333' : '#f0f0f0' },
          ticks: { color: muted.value, font: { size: 11 }, precision: 0 },
        }
      }
    }
  })
}

// 格式化最后登录时间：今天显示时间，其余显示日期
function formatLastLogin(value) {
  if (!value) return '从未登录'
  const d = new Date(String(value).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(value)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
}

function reload() {
  loadStats(trendDays.value)
}
</script>

<template>
  <div>
    <div class="flex items-end justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">仪表盘</h1>
        <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">题库数据概览</p>
      </div>
      <button
        class="px-3 py-1.5 text-sm rounded-btn border border-notion-border dark:border-notion-border-dark text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        :disabled="refreshing"
        @click="reload"
      >
        <svg
          class="w-3.5 h-3.5"
          :class="refreshing && 'animate-spin'"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.06-3.06L4 8M4 15a8 8 0 0014.06 3.06L20 16"/>
        </svg>
        {{ refreshing ? '刷新中' : '刷新' }}
      </button>
    </div>

    <!-- 首屏骨架：结构与真实布局一一对应，避免加载完成时布局跳动 -->
    <template v-if="loading">
      <!-- 汇总行 -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-notion-border dark:border-notion-border-dark border border-notion-border dark:border-notion-border-dark rounded-card overflow-hidden mb-6">
        <div v-for="i in 5" :key="i" class="skeleton-stat">
          <Skeleton class="skeleton-stat-label" width="" height="" />
          <Skeleton class="skeleton-stat-value" width="" height="" />
          <Skeleton class="skeleton-stat-hint" width="" height="" />
        </div>
      </div>

      <!-- 题型构成 -->
      <div class="card mb-6">
        <div class="flex items-baseline justify-between mb-4">
          <Skeleton width="72px" height="16px" />
          <Skeleton width="64px" height="12px" />
        </div>
        <Skeleton width="100%" height="8px" rounded="999px" />
        <div class="flex gap-5 mt-3.5">
          <Skeleton v-for="i in 5" :key="i" width="56px" height="12px" />
        </div>
      </div>

      <!-- 分类明细 + 新增趋势 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch">
        <div class="card flex flex-col" :style="{ height: `${CARD_HEIGHT}px` }">
          <div class="flex items-baseline justify-between mb-1 flex-shrink-0">
            <Skeleton width="72px" height="16px" />
            <Skeleton width="120px" height="12px" />
          </div>
          <Skeleton width="180px" height="12px" class="mb-3 flex-shrink-0" />
          <div class="flex-1 min-h-0 space-y-3.5 overflow-hidden">
            <div v-for="i in 10" :key="i" class="flex items-center gap-2.5">
              <Skeleton width="8px" height="8px" rounded="2px" />
              <Skeleton :width="`${34 + (i % 4) * 9}%`" height="12px" />
              <Skeleton width="40px" height="12px" class="ml-auto" />
              <Skeleton width="36px" height="12px" />
            </div>
          </div>
        </div>

        <div class="card flex flex-col" :style="{ height: `${CARD_HEIGHT}px` }">
          <div class="flex items-start justify-between mb-4 flex-shrink-0">
            <div class="space-y-2">
              <Skeleton width="72px" height="16px" />
              <Skeleton width="120px" height="12px" />
            </div>
            <Skeleton width="132px" height="26px" rounded="8px" />
          </div>
          <Skeleton width="100%" height="100%" class="flex-1 min-h-0" />
          <div class="h-px bg-notion-border dark:border-notion-border-dark my-4 flex-shrink-0" />
          <div class="grid grid-cols-3 gap-4 flex-shrink-0">
            <div v-for="i in 3" :key="i">
              <Skeleton width="56px" height="11px" />
              <Skeleton width="48px" height="22px" class="mt-1.5" />
            </div>
          </div>
        </div>
      </div>

      <!-- 管理员区块 -->
      <template v-if="isAdmin">
        <Skeleton width="88px" height="16px" class="mt-8 mb-4" />
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-notion-border dark:border-notion-border-dark border border-notion-border dark:border-notion-border-dark rounded-card overflow-hidden mb-6">
          <div v-for="i in 6" :key="i" class="skeleton-stat">
            <Skeleton class="skeleton-stat-label" width="" height="" />
            <Skeleton class="skeleton-stat-value" width="" height="" />
            <Skeleton class="skeleton-stat-hint" width="" height="" />
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="card lg:col-span-2">
            <Skeleton width="96px" height="16px" class="mb-1" />
            <Skeleton width="200px" height="12px" class="mb-4" />
            <Skeleton width="100%" height="224px" />
          </div>
          <div class="card">
            <Skeleton width="72px" height="16px" class="mb-1" />
            <Skeleton width="160px" height="12px" class="mb-4" />
            <Skeleton width="100%" height="160px" />
          </div>
        </div>
      </template>
    </template>

    <div
      v-else-if="stats"
      class="transition-opacity duration-200"
      :class="refreshing && 'opacity-60 pointer-events-none'"
    >
      <!-- 汇总行：1px 描边分隔 -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-notion-border dark:border-notion-border-dark border border-notion-border dark:border-notion-border-dark rounded-card overflow-hidden mb-6">
        <div class="bg-notion-surface dark:bg-notion-surface-dark px-4 py-4">
          <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">题目总数</p>
          <p class="text-2xl font-bold text-notion-text dark:text-notion-text-dark tabular-nums mt-2">{{ stats.total }}</p>
          <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-0.5">{{ categoryTotal }} 个分类</p>
        </div>
        <div
          v-for="t in typeBreakdown.slice(0, 4)"
          :key="t.type"
          class="bg-notion-surface dark:bg-notion-surface-dark px-4 py-4"
        >
          <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">{{ t.type }}</p>
          <p class="text-2xl font-bold text-notion-text dark:text-notion-text-dark tabular-nums mt-2">{{ t.cnt }}</p>
          <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-0.5">占比 {{ t.percent }}%</p>
        </div>
      </div>

      <!-- 题型构成：堆叠占比条 + 图例 -->
      <div class="card mb-6">
        <div class="flex items-baseline justify-between mb-4">
          <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">题型构成</h2>
          <span class="text-xs text-notion-muted dark:text-notion-muted-dark">按题型占比</span>
        </div>
        <div class="w-full h-2 rounded-full overflow-hidden flex bg-notion-muted/10">
          <div
            v-for="t in typeBreakdown"
            :key="t.type"
            class="h-full transition-all duration-300"
            :style="{ width: `${t.percent}%`, backgroundColor: t.color }"
            :title="`${t.type}：${t.cnt} 道（${t.percent}%）`"
          />
        </div>
        <div class="flex gap-4 sm:gap-5 flex-wrap mt-3.5 text-xs text-notion-muted dark:text-notion-muted-dark">
          <span v-for="t in typeBreakdown" :key="t.type" class="inline-flex items-center gap-1.5">
            <i class="inline-block w-2 h-2 rounded-sm" :style="{ backgroundColor: t.color }" />
            {{ t.type }} {{ t.cnt }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch">
        <!-- 分类明细：等高卡片 + 卡内滚动，表头固定 -->
        <div class="card flex flex-col" :style="{ height: `${CARD_HEIGHT}px` }">
          <div class="flex items-baseline justify-between mb-1 flex-shrink-0">
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">分类明细</h2>
            <span class="text-xs text-notion-muted dark:text-notion-muted-dark tabular-nums">
              共 {{ categoryTotal }} 个分类 · {{ stats.total }} 道题
            </span>
          </div>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark mb-3 flex-shrink-0">点击任意行可跳转到该分类的题目列表</p>

          <div class="flex-1 min-h-0 -mx-2 overflow-y-auto">
            <table class="w-full">
              <thead class="sticky top-0 z-10">
                <tr class="bg-notion-surface dark:bg-notion-surface-dark">
                  <th class="text-left text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark py-2 px-2.5">分类</th>
                  <th class="text-right text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark py-2 px-2.5 w-20">题目数</th>
                  <th class="text-right text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark py-2 px-2.5 w-16">占比</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in categoryRows"
                  :key="c.name"
                  class="cursor-pointer transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
                  @click="goCategory(c.name)"
                >
                  <td class="py-2 px-2.5 text-sm text-notion-text dark:text-notion-text-dark">
                    <i class="inline-block w-2 h-2 rounded-sm mr-2 align-middle" :style="{ backgroundColor: c.color }" />{{ c.name }}
                  </td>
                  <td class="py-2 px-2.5 text-sm text-right tabular-nums text-notion-text dark:text-notion-text-dark">{{ c.cnt }}</td>
                  <td class="py-2 px-2.5 text-sm text-right tabular-nums text-notion-muted dark:text-notion-muted-dark">{{ c.percent }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 新增趋势：与分类卡等高，图表填满中间区域 -->
        <div class="card flex flex-col" :style="{ height: `${CARD_HEIGHT}px` }">
          <div class="flex items-start justify-between mb-4 flex-shrink-0">
            <div>
              <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">新增趋势</h2>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">
                近 {{ trendDays }} 天 · 峰值 {{ trendPeak }} 道
              </p>
            </div>
            <div class="flex gap-0.5 p-0.5 rounded-btn bg-notion-muted/10 flex-shrink-0">
              <button
                v-for="opt in trendOptions"
                :key="opt"
                class="px-2.5 py-1 rounded-btn text-xs transition-colors duration-150"
                :class="trendDays === opt
                  ? 'bg-notion-surface dark:bg-notion-surface-dark text-notion-text dark:text-notion-text-dark font-medium shadow-sm'
                  : 'text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark'"
                @click="setTrendDays(opt)"
              >{{ opt }} 天</button>
            </div>
          </div>

          <!-- 图表区占据剩余高度，消除底部留白 -->
          <div class="flex-1 min-h-0">
            <canvas v-if="stats.dailyTrend?.length" ref="chartRef" />
            <div v-else class="flex items-center justify-center h-full text-notion-muted dark:text-notion-muted-dark text-sm">
              暂无数据
            </div>
          </div>

          <div class="h-px bg-notion-border dark:border-notion-border-dark my-4 flex-shrink-0" />

          <div class="grid grid-cols-3 gap-4 flex-shrink-0">
            <div>
              <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">区间新增</p>
              <p class="text-lg font-semibold text-notion-text dark:text-notion-text-dark tabular-nums mt-1.5">{{ trendTotal }}</p>
            </div>
            <div>
              <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">日均</p>
              <p class="text-lg font-semibold text-notion-text dark:text-notion-text-dark tabular-nums mt-1.5">{{ trendAvg }}</p>
            </div>
            <div>
              <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">峰值</p>
              <p class="text-lg font-semibold text-notion-text dark:text-notion-text-dark tabular-nums mt-1.5">{{ trendPeak }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 管理员：用户数据 -->
      <template v-if="isAdmin && adminStats">
        <div class="flex items-baseline justify-between mb-4 mt-8 flex-wrap gap-2">
          <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">用户数据</h2>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent-10 text-accent border border-accent-20">仅管理员</span>
            <span class="text-xs text-notion-muted dark:text-notion-muted-dark">近 {{ trendDays }} 天</span>
          </div>
        </div>

        <!-- 用户概览 -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-notion-border dark:border-notion-border-dark border border-notion-border dark:border-notion-border-dark rounded-card overflow-hidden mb-6">
          <div class="bg-notion-surface dark:bg-notion-surface-dark px-4 py-4">
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">用户总数</p>
            <p class="text-2xl font-bold text-notion-accent dark:text-notion-accent-dark tabular-nums mt-2">{{ adminStats.users.total }}</p>
            <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-0.5">{{ adminStats.users.admins }} 位管理员</p>
          </div>
          <div class="bg-notion-surface dark:bg-notion-surface-dark px-4 py-4">
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">启用中</p>
            <p class="text-2xl font-bold text-notion-text dark:text-notion-text-dark tabular-nums mt-2">{{ adminStats.users.active }}</p>
            <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-0.5">账号正常可用</p>
          </div>
          <div class="bg-notion-surface dark:bg-notion-surface-dark px-4 py-4">
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">7 天活跃</p>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums mt-2">{{ adminStats.users.active7d }}</p>
            <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-0.5">近 7 天有登录</p>
          </div>
          <div class="bg-notion-surface dark:bg-notion-surface-dark px-4 py-4">
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">本周新增</p>
            <p class="text-2xl font-bold text-notion-text dark:text-notion-text-dark tabular-nums mt-2">{{ adminStats.users.newThisWeek }}</p>
            <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-0.5">7 天内注册</p>
          </div>
          <div class="bg-notion-surface dark:bg-notion-surface-dark px-4 py-4">
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">锁定中</p>
            <p
              class="text-2xl font-bold tabular-nums mt-2"
              :class="adminStats.users.locked > 0 ? 'text-red-500 dark:text-red-400' : 'text-notion-text dark:text-notion-text-dark'"
            >{{ adminStats.users.locked }}</p>
            <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-0.5">登录失败锁定</p>
          </div>
          <div
            class="bg-notion-surface dark:bg-notion-surface-dark px-4 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            @click="router.push('/users')"
          >
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark">管理入口</p>
            <p class="text-base font-semibold text-notion-accent dark:text-notion-accent-dark mt-2">用户管理 →</p>
            <p class="text-[11px] text-notion-muted dark:text-notion-muted-dark mt-0.5">权限与分类可见性</p>
          </div>
        </div>

        <!-- 可视化：活跃趋势 + 活跃度分档 + 角色构成 -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="card lg:col-span-2">
            <h3 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">用户活跃趋势</h3>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1 mb-4">每日去重活跃用户数与操作总次数</p>
            <div class="h-56">
              <canvas v-if="adminStats.activityTrend?.length" ref="activityChartRef" />
              <div v-else class="flex items-center justify-center h-full text-notion-muted dark:text-notion-muted-dark text-sm">
                暂无活跃记录
              </div>
            </div>
          </div>

          <div class="card">
            <h3 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">活跃度分档</h3>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1 mb-4">按操作次数划分的用户分布</p>
            <div class="h-40">
              <canvas ref="levelBarRef" />
            </div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-4 pt-4 border-t border-notion-border dark:border-notion-border-dark">
              <div v-for="l in activityLevels" :key="l.label" class="flex items-center gap-2 text-xs">
                <i class="inline-block w-2 h-2 rounded-sm flex-shrink-0" :style="{ backgroundColor: l.color }" />
                <span class="text-notion-text dark:text-notion-text-dark">{{ l.label }}</span>
                <span class="text-notion-muted dark:text-notion-muted-dark">{{ l.hint }}</span>
                <span class="ml-auto tabular-nums font-medium text-notion-text dark:text-notion-text-dark">{{ l.count }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 角色构成 + 排行榜 -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="card">
            <h3 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">角色构成</h3>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1 mb-5">按账号角色划分</p>
            <div class="w-full h-2 rounded-full overflow-hidden flex bg-notion-muted/10 mb-4">
              <div
                v-for="(r, i) in roleSplit"
                :key="r.name"
                class="h-full transition-all duration-300"
                :style="{ width: `${r.percent}%`, backgroundColor: i === 0 ? 'var(--theme-accent)' : 'var(--theme-muted)' }"
                :title="`${r.name}：${r.cnt} 人（${r.percent}%）`"
              />
            </div>
            <div class="space-y-2.5">
              <div v-for="(r, i) in roleSplit" :key="r.name" class="flex items-center gap-2.5 text-sm">
                <i class="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" :style="{ backgroundColor: i === 0 ? 'var(--theme-accent)' : 'var(--theme-muted)' }" />
                <span class="text-notion-text dark:text-notion-text-dark">{{ r.name }}</span>
                <span class="ml-auto text-notion-muted dark:text-notion-muted-dark tabular-nums text-xs">{{ r.percent }}%</span>
                <span class="tabular-nums font-semibold text-notion-text dark:text-notion-text-dark w-8 text-right">{{ r.cnt }}</span>
              </div>
            </div>
          </div>

          <div class="card lg:col-span-2">
            <h3 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">用户明细</h3>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1 mb-4">按操作次数排序 · 点击行查看该用户活动日志</p>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr>
                    <th class="text-left text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark pb-2.5 px-2.5 w-10">#</th>
                    <th class="text-left text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark pb-2.5 px-2.5">用户</th>
                    <th class="text-left text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark pb-2.5 px-2.5 w-20">角色</th>
                    <th class="text-left text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark pb-2.5 px-2.5">最后登录</th>
                    <th class="text-right text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark pb-2.5 px-2.5 w-20">操作</th>
                    <th class="text-right text-[10.5px] font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark pb-2.5 px-2.5 w-24">正确率</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(u, i) in adminStats.ranking"
                    :key="u.id"
                    class="cursor-pointer transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
                    @click="router.push(`/users/${u.id}/logs`)"
                  >
                    <td class="py-2.5 px-2.5 text-sm text-notion-muted dark:text-notion-muted-dark tabular-nums">{{ i + 1 }}</td>
                    <td class="py-2.5 px-2.5 text-sm text-notion-text dark:text-notion-text-dark">
                      <span class="truncate">{{ u.display_name || u.username }}</span>
                      <span
                        v-if="!u.is_active"
                        class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      >已禁用</span>
                    </td>
                    <td class="py-2.5 px-2.5">
                      <span
                        v-if="u.role === 'admin'"
                        class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-10 text-accent border border-accent-20"
                      >管理员</span>
                      <span v-else class="text-[11px] text-notion-muted dark:text-notion-muted-dark">普通用户</span>
                    </td>
                    <td class="py-2.5 px-2.5 text-sm text-notion-muted dark:text-notion-muted-dark">{{ formatLastLogin(u.last_login_at) }}</td>
                    <td class="py-2.5 px-2.5 text-sm text-right tabular-nums text-notion-text dark:text-notion-text-dark">{{ u.actions }}</td>
                    <td class="py-2.5 px-2.5 text-right tabular-nums">
                      <template v-if="accuracyOf(u.id) !== null">
                        <span class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">{{ accuracyOf(u.id) }}%</span>
                      </template>
                      <span v-else class="text-notion-muted dark:text-notion-muted-dark">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 刷题正确率排行 -->
        <div v-if="adminStats.accuracyRanking?.length" class="card">
          <h3 class="text-base font-semibold text-notion-text dark:text-notion-text-dark mb-1">刷题正确率排行</h3>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark mb-5">近 {{ trendDays }} 天 · 答对题数 ÷ 总作答题数</p>
          <div class="space-y-3">
            <div v-for="(u, i) in adminStats.accuracyRanking" :key="u.id" class="flex items-center gap-3">
              <span
                class="w-6 h-6 rounded-btn flex items-center justify-center text-xs font-bold flex-shrink-0"
                :class="i < 3 ? 'bg-green-500 text-white' : 'bg-notion-muted/20 text-notion-muted dark:text-notion-muted-dark'"
              >{{ i + 1 }}</span>
              <span class="text-sm text-notion-text dark:text-notion-text-dark w-24 truncate">{{ u.display_name || u.username }}</span>
              <div class="flex-1 h-2 rounded-full bg-notion-muted/15 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :style="{ width: `${Math.min(100, u.accuracy)}%`, backgroundColor: u.accuracy >= 60 ? '#4caf50' : u.accuracy >= 30 ? '#ff9800' : '#e91e63' }"
                />
              </div>
              <span class="text-xs text-notion-muted dark:text-notion-muted-dark tabular-nums w-28 text-right">{{ u.correct }} / {{ u.total }} 题</span>
              <span class="text-sm font-semibold text-notion-text dark:text-notion-text-dark tabular-nums w-14 text-right">{{ u.accuracy }}%</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
