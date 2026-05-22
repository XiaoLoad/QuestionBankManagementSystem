<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'

defineOptions({ name: 'ExternalBanks' })

const api = useApi()
const toast = useToastStore()

// Config
const config = reactive({
  yatori_enabled: true,
  ocs_enabled: true,
  max_concurrent_ai: 5,
  ai_timeout: 30,
  auto_save: true,
})
const configLoading = ref(true)
const saving = ref(false)

// Stats
const stats = ref({
  today: '',
  yatori: { total: 0, local: 0, ai: 0, notFound: 0 },
  ocs: { total: 0, local: 0, ai: 0, notFound: 0 },
})

// Logs
const logs = ref([])
const logsLoading = ref(false)
const logFilter = reactive({ source: '', result: '' })

// Compute base URL
const baseUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:3000'
})

const yatoriUrl = computed(() => `${baseUrl.value}/api/external/yatori`)
const ocsUrl = computed(() => `${baseUrl.value}/api/external/ocs`)

// OCS config JSON for copy
const ocsConfigJson = computed(() => JSON.stringify([{
  name: '题库管理系统',
  url: ocsUrl.value,
  method: 'get',
  contentType: 'json',
  data: { title: '${title}', type: '${type}', options: '${options}' },
  handler: "return (res) => res.code === 1 ? [res.question, res.answer] : undefined"
}], null, 2))

// Yatori config YAML for copy
const yatoriConfigYaml = computed(() =>
`# 在 config.yml 的 apiQueSetting 下配置
apiQueSetting:
  url: "${yatoriUrl.value}"`
)

// ========== Actions ==========

async function loadConfig() {
  configLoading.value = true
  try {
    const data = await api.getExternalConfig()
    Object.assign(config, data)
  } catch {} finally {
    configLoading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await api.getExternalStats()
  } catch {}
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const params = { limit: 50 }
    if (logFilter.source) params.source = logFilter.source
    if (logFilter.result) params.result = logFilter.result
    logs.value = await api.getExternalLogs(params)
  } catch {} finally {
    logsLoading.value = false
  }
}

async function updateConfig(key, value) {
  saving.value = true
  try {
    config[key] = value
    await api.updateExternalConfig({ [key]: value })
    toast.success('配置已保存')
  } catch {
    // revert on error
    await loadConfig()
  } finally {
    saving.value = false
  }
}

async function updateNumberConfig(key, value) {
  const num = parseInt(value)
  if (isNaN(num) || num < 1) return
  await updateConfig(key, num)
}

async function clearLogs() {
  try {
    const result = await api.clearExternalLogs(30)
    toast.success(result.message || '日志已清理')
    await loadLogs()
  } catch {}
}

async function clearAllLogs() {
  if (!confirm('确定要清空所有查询日志吗？此操作不可恢复。')) return
  try {
    const result = await api.clearExternalLogs(0)
    toast.success(result.message || '日志已清空')
    await loadLogs()
  } catch {}
}

function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label}已复制到剪贴板`)
  }).catch(() => {
    toast.error('复制失败，请手动复制')
  })
}

function formatTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

function truncate(str, len = 30) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
}

const resultLabel = { local: '本地', ai: 'AI', not_found: '未找到', disabled: '已禁用' }
const resultColor = {
  local: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  ai: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  not_found: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  disabled: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
}

const sourceLabel = { yatori: 'Yatori', ocs: 'OCS' }

// ========== Lifecycle ==========

onMounted(async () => {
  await Promise.all([loadConfig(), loadStats(), loadLogs()])
  // Auto-refresh stats every 30s
  setInterval(loadStats, 30000)
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">题库对接</h1>
      <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">
        将本系统作为外部题库，供 Yatori、OCS 网课助手等工具调用
      </p>
    </div>

    <!-- Global Settings Card -->
    <div class="card mb-6">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-9 h-9 rounded-btn bg-notion-accent/10 dark:bg-notion-accent-dark/15 flex items-center justify-center">
          <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">全局设置</h2>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <!-- Max concurrent AI -->
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">最大并发 AI 请求数</label>
          <input
            type="number"
            :value="config.max_concurrent_ai"
            @change="updateNumberConfig('max_concurrent_ai', $event.target.value)"
            min="1" max="20"
            class="w-full px-3 py-2 text-sm rounded-btn border border-notion-border dark:border-notion-border-dark bg-notion-bg dark:bg-notion-bg-dark text-notion-text dark:text-notion-text-dark focus:outline-none focus:border-notion-accent dark:focus:border-notion-accent-dark"
          />
        </div>

        <!-- AI timeout -->
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">AI 请求超时（秒）</label>
          <input
            type="number"
            :value="config.ai_timeout"
            @change="updateNumberConfig('ai_timeout', $event.target.value)"
            min="10" max="300"
            class="w-full px-3 py-2 text-sm rounded-btn border border-notion-border dark:border-notion-border-dark bg-notion-bg dark:bg-notion-bg-dark text-notion-text dark:text-notion-text-dark focus:outline-none focus:border-notion-accent dark:focus:border-notion-accent-dark"
          />
        </div>

        <!-- Auto save toggle -->
        <div class="flex items-end">
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <button
              @click="updateConfig('auto_save', !config.auto_save)"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
                config.auto_save ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-300 dark:bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
                  config.auto_save ? 'translate-x-6' : 'translate-x-1'
                ]"
              />
            </button>
            <span class="text-sm text-notion-text dark:text-notion-text-dark">AI 答案自动存入本地题库</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Yatori Card -->
    <div class="card mb-6">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-btn bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">Yatori 对接</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">yatori-go-console 自动考试答题系统</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span :class="[
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            config.yatori_enabled
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          ]">
            <span :class="['w-1.5 h-1.5 rounded-full', config.yatori_enabled ? 'bg-emerald-500' : 'bg-gray-400']"></span>
            {{ config.yatori_enabled ? '已启用' : '已禁用' }}
          </span>
          <button
            @click="updateConfig('yatori_enabled', !config.yatori_enabled)"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
              config.yatori_enabled ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-300 dark:bg-gray-600'
            ]"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
                config.yatori_enabled ? 'translate-x-6' : 'translate-x-1'
              ]"
            />
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <!-- Endpoint URL -->
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">接入地址</label>
          <div class="flex gap-2">
            <input
              :value="yatoriUrl"
              readonly
              class="flex-1 px-3 py-2 text-sm font-mono rounded-btn border border-notion-border dark:border-notion-border-dark bg-gray-50 dark:bg-gray-800/50 text-notion-text dark:text-notion-text-dark select-all"
            />
            <button
              @click="copyToClipboard(yatoriUrl, 'Yatori 接入地址')"
              class="px-4 py-2 text-sm font-medium rounded-btn border border-notion-border dark:border-notion-border-dark text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >复制</button>
          </div>
        </div>

        <!-- Config Example -->
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">config.yml 配置示例</label>
          <div class="relative">
            <pre class="px-4 py-3 text-xs font-mono rounded-btn border border-notion-border dark:border-notion-border-dark bg-gray-50 dark:bg-gray-800/50 text-notion-text dark:text-notion-text-dark overflow-x-auto whitespace-pre-wrap select-all">{{ yatoriConfigYaml }}</pre>
            <button
              @click="copyToClipboard(yatoriConfigYaml, 'Yatori 配置')"
              class="absolute top-2 right-2 px-3 py-1 text-xs font-medium rounded-btn border border-notion-border dark:border-notion-border-dark bg-white dark:bg-gray-800 text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >复制</button>
          </div>
        </div>

        <!-- Stats -->
        <div class="flex flex-wrap gap-3 pt-2">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-gray-50 dark:bg-gray-800/50 text-sm">
            <span class="text-notion-muted dark:text-notion-muted-dark">今日查询</span>
            <span class="font-semibold text-notion-text dark:text-notion-text-dark">{{ stats.yatori.total }}</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-emerald-50 dark:bg-emerald-900/20 text-sm">
            <span class="text-emerald-600 dark:text-emerald-400">本地命中</span>
            <span class="font-semibold text-emerald-700 dark:text-emerald-300">{{ stats.yatori.local }}</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-blue-50 dark:bg-blue-900/20 text-sm">
            <span class="text-blue-600 dark:text-blue-400">AI 补充</span>
            <span class="font-semibold text-blue-700 dark:text-blue-300">{{ stats.yatori.ai }}</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-gray-50 dark:bg-gray-800/50 text-sm">
            <span class="text-notion-muted dark:text-notion-muted-dark">未找到</span>
            <span class="font-semibold text-notion-text dark:text-notion-text-dark">{{ stats.yatori.notFound }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- OCS Card -->
    <div class="card mb-6">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-btn bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">OCS 网课助手对接</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">OCS 网课助手在线搜题</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span :class="[
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            config.ocs_enabled
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          ]">
            <span :class="['w-1.5 h-1.5 rounded-full', config.ocs_enabled ? 'bg-emerald-500' : 'bg-gray-400']"></span>
            {{ config.ocs_enabled ? '已启用' : '已禁用' }}
          </span>
          <button
            @click="updateConfig('ocs_enabled', !config.ocs_enabled)"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
              config.ocs_enabled ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-300 dark:bg-gray-600'
            ]"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
                config.ocs_enabled ? 'translate-x-6' : 'translate-x-1'
              ]"
            />
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <!-- Endpoint URL -->
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">接入地址</label>
          <div class="flex gap-2">
            <input
              :value="ocsUrl"
              readonly
              class="flex-1 px-3 py-2 text-sm font-mono rounded-btn border border-notion-border dark:border-notion-border-dark bg-gray-50 dark:bg-gray-800/50 text-notion-text dark:text-notion-text-dark select-all"
            />
            <button
              @click="copyToClipboard(ocsUrl, 'OCS 接入地址')"
              class="px-4 py-2 text-sm font-medium rounded-btn border border-notion-border dark:border-notion-border-dark text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >复制</button>
          </div>
        </div>

        <!-- OCS Config JSON -->
        <div>
          <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1.5">OCS 题库配置（在 OCS 脚本中粘贴此 JSON）</label>
          <div class="relative">
            <pre class="px-4 py-3 text-xs font-mono rounded-btn border border-notion-border dark:border-notion-border-dark bg-gray-50 dark:bg-gray-800/50 text-notion-text dark:text-notion-text-dark overflow-x-auto whitespace-pre-wrap select-all">{{ ocsConfigJson }}</pre>
            <button
              @click="copyToClipboard(ocsConfigJson, 'OCS 题库配置')"
              class="absolute top-2 right-2 px-3 py-1 text-xs font-medium rounded-btn border border-notion-border dark:border-notion-border-dark bg-white dark:bg-gray-800 text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >复制</button>
          </div>
        </div>

        <!-- Stats -->
        <div class="flex flex-wrap gap-3 pt-2">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-gray-50 dark:bg-gray-800/50 text-sm">
            <span class="text-notion-muted dark:text-notion-muted-dark">今日查询</span>
            <span class="font-semibold text-notion-text dark:text-notion-text-dark">{{ stats.ocs.total }}</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-emerald-50 dark:bg-emerald-900/20 text-sm">
            <span class="text-emerald-600 dark:text-emerald-400">本地命中</span>
            <span class="font-semibold text-emerald-700 dark:text-emerald-300">{{ stats.ocs.local }}</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-blue-50 dark:bg-blue-900/20 text-sm">
            <span class="text-blue-600 dark:text-blue-400">AI 补充</span>
            <span class="font-semibold text-blue-700 dark:text-blue-300">{{ stats.ocs.ai }}</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-gray-50 dark:bg-gray-800/50 text-sm">
            <span class="text-notion-muted dark:text-notion-muted-dark">未找到</span>
            <span class="font-semibold text-notion-text dark:text-notion-text-dark">{{ stats.ocs.notFound }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Query Logs Card -->
    <div class="card">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-btn bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">查询日志</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">最近 50 条查询记录</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Filters -->
          <select
            v-model="logFilter.source"
            @change="loadLogs()"
            class="px-2 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark bg-notion-bg dark:bg-notion-bg-dark text-notion-text dark:text-notion-text-dark focus:outline-none"
          >
            <option value="">全部来源</option>
            <option value="yatori">Yatori</option>
            <option value="ocs">OCS</option>
          </select>
          <select
            v-model="logFilter.result"
            @change="loadLogs()"
            class="px-2 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark bg-notion-bg dark:bg-notion-bg-dark text-notion-text dark:text-notion-text-dark focus:outline-none"
          >
            <option value="">全部结果</option>
            <option value="local">本地命中</option>
            <option value="ai">AI 补充</option>
            <option value="not_found">未找到</option>
          </select>
          <button
            @click="loadLogs()"
            class="px-3 py-1.5 text-xs font-medium rounded-btn border border-notion-border dark:border-notion-border-dark text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <button
            @click="clearLogs()"
            class="px-3 py-1.5 text-xs font-medium rounded-btn border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >清理 30 天前</button>
          <button
            @click="clearAllLogs()"
            class="px-3 py-1.5 text-xs font-medium rounded-btn border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >清空日志</button>
        </div>
      </div>

      <!-- Log Table -->
      <div class="overflow-x-auto -mx-5 px-5">
        <div v-if="logsLoading" class="text-center py-8 text-sm text-notion-muted dark:text-notion-muted-dark">
          加载中...
        </div>
        <div v-else-if="logs.length === 0" class="text-center py-8 text-sm text-notion-muted dark:text-notion-muted-dark">
          暂无查询记录
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-notion-border dark:border-notion-border-dark">
              <th class="text-left py-2 px-3 font-medium text-notion-muted dark:text-notion-muted-dark text-xs">时间</th>
              <th class="text-left py-2 px-3 font-medium text-notion-muted dark:text-notion-muted-dark text-xs">来源</th>
              <th class="text-left py-2 px-3 font-medium text-notion-muted dark:text-notion-muted-dark text-xs">题目</th>
              <th class="text-left py-2 px-3 font-medium text-notion-muted dark:text-notion-muted-dark text-xs">题型</th>
              <th class="text-left py-2 px-3 font-medium text-notion-muted dark:text-notion-muted-dark text-xs">结果</th>
              <th class="text-left py-2 px-3 font-medium text-notion-muted dark:text-notion-muted-dark text-xs">答案</th>
              <th class="text-right py-2 px-3 font-medium text-notion-muted dark:text-notion-muted-dark text-xs">耗时</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="log in logs"
              :key="log.id"
              class="border-b border-notion-border/50 dark:border-notion-border-dark/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
            >
              <td class="py-2.5 px-3 text-notion-muted dark:text-notion-muted-dark whitespace-nowrap">
                <span class="text-xs">{{ formatDate(log.created_at) }}</span>
                <span class="text-xs ml-1 opacity-70">{{ formatTime(log.created_at) }}</span>
              </td>
              <td class="py-2.5 px-3">
                <span class="text-xs font-medium text-notion-text dark:text-notion-text-dark">{{ sourceLabel[log.source] || log.source }}</span>
              </td>
              <td class="py-2.5 px-3 max-w-[200px]">
                <span class="text-notion-text dark:text-notion-text-dark" :title="log.content">{{ truncate(log.content, 25) }}</span>
              </td>
              <td class="py-2.5 px-3 text-notion-muted dark:text-notion-muted-dark text-xs">{{ log.type || '-' }}</td>
              <td class="py-2.5 px-3">
                <span :class="['inline-block px-2 py-0.5 rounded text-xs font-medium', resultColor[log.result]]">
                  {{ resultLabel[log.result] || log.result }}
                </span>
              </td>
              <td class="py-2.5 px-3 max-w-[200px]">
                <span class="text-xs text-notion-text dark:text-notion-text-dark" :title="log.answer">{{ truncate(log.answer, 20) || '-' }}</span>
              </td>
              <td class="py-2.5 px-3 text-right whitespace-nowrap">
                <span :class="[
                  'text-xs',
                  log.cost_ms < 100 ? 'text-emerald-600 dark:text-emerald-400' :
                  log.cost_ms < 2000 ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                ]">
                  {{ log.cost_ms < 1000 ? log.cost_ms + 'ms' : (log.cost_ms / 1000).toFixed(1) + 's' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
