<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useConfirmStore } from '@/stores/confirm'

defineOptions({ name: 'AiSettings' })

const api = useApi()
const authStore = useAuthStore()
const toast = useToastStore()
const confirm = useConfirmStore()

const isAdmin = ref(authStore.isAdmin)
const providers = ref([])
const presets = ref([])
const loading = ref(true)
const showForm = ref(false)
const editingProvider = ref(null)
const showPresetMenu = ref(false)
const testingId = ref(null)
const loadingModelsId = ref(null)

// 用户被授权使用管理员 AI 时的配置信息
const adminConfig = ref({ authorized: false, providers: [] })

// 提示词管理
const prompts = ref({})
const defaultPrompts = ref({})
const showPromptEditor = ref(false)
const editingPromptKey = ref('')
const editingPrompt = ref({ system_prompt: '', user_prompt: '' })
const editingIsDefault = ref(false) // 是否编辑的是管理员默认提示词
const promptLabels = {
  analyze: { name: 'AI 校验答案', desc: '用于题目详情页和刷题页的 AI 校验功能' }
}

// AI timeout setting (seconds)
const aiTimeout = ref(parseInt(localStorage.getItem('ai_timeout') || '120'))

function saveTimeout() {
  const v = Math.max(10, Math.min(600, parseInt(aiTimeout.value) || 120))
  aiTimeout.value = v
  localStorage.setItem('ai_timeout', String(v))
  toast.success(`AI 超时已设为 ${v} 秒`)
}

const form = reactive({
  name: '',
  base_url: '',
  api_key: '',
  model: '',
  is_default: false,
})

onMounted(async () => {
  if (isAdmin.value) {
    await Promise.all([loadProviders(), loadPresets(), loadDefaultPrompts()])
  } else {
    await Promise.all([loadUserProviders(), loadPresets(), loadAdminConfig()])
  }
  await loadPrompts()
  loading.value = false
})

async function loadProviders() {
  try { providers.value = await api.getAiProviders() } catch {}
}

async function loadUserProviders() {
  try { providers.value = await api.getUserAiProviders() } catch {}
}

async function loadAdminConfig() {
  try { adminConfig.value = await api.getUserAiAdminConfig() } catch {}
}

async function loadPrompts() {
  try { prompts.value = await api.getUserAiPrompts() } catch {}
}

async function loadDefaultPrompts() {
  try { defaultPrompts.value = await api.getDefaultPrompts() } catch {}
}

function openPromptEditor(key, isDefault = false) {
  editingPromptKey.value = key
  editingIsDefault.value = isDefault
  if (isDefault) {
    editingPrompt.value = {
      system_prompt: defaultPrompts.value[key]?.system_prompt || '',
      user_prompt: defaultPrompts.value[key]?.user_prompt || ''
    }
  } else {
    editingPrompt.value = {
      system_prompt: prompts.value[key]?.system_prompt || '',
      user_prompt: prompts.value[key]?.user_prompt || ''
    }
  }
  showPromptEditor.value = true
}

function closePromptEditor() {
  showPromptEditor.value = false
  editingPromptKey.value = ''
  editingIsDefault.value = false
}

async function savePrompt() {
  try {
    if (editingIsDefault.value) {
      await api.updateDefaultPrompt(editingPromptKey.value, editingPrompt.value)
      toast.success('默认提示词已更新')
      await loadDefaultPrompts()
    } else {
      await api.updateUserAiPrompt(editingPromptKey.value, editingPrompt.value)
      toast.success('提示词已保存')
    }
    closePromptEditor()
    await loadPrompts()
  } catch {}
}

async function resetPrompt(key, isDefault = false) {
  try {
    if (isDefault) {
      await api.resetDefaultPrompt(key)
      toast.success('已恢复系统内置提示词')
      await loadDefaultPrompts()
    } else {
      await api.resetUserAiPrompt(key)
      toast.success('已恢复默认提示词')
    }
    await loadPrompts()
  } catch {}
}

async function loadPresets() {
  try { presets.value = await api.getAiPresets() } catch {}
}

function openAddForm(preset = null) {
  editingProvider.value = null
  form.name = preset?.name || ''
  form.base_url = preset?.base_url || ''
  form.api_key = ''
  form.model = ''
  form.is_default = providers.value.length === 0 // first one is default
  showForm.value = true
}

function openEditForm(p) {
  editingProvider.value = p
  form.name = p.name
  form.base_url = p.base_url
  form.api_key = p.api_key // full key from server
  form.model = p.model || ''
  form.is_default = !!p.is_default
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingProvider.value = null
}

async function submitForm() {
  if (!form.name.trim() || !form.base_url.trim() || !form.api_key.trim()) {
    toast.error('请填写必填项')
    return
  }
  try {
    if (isAdmin.value) {
      if (editingProvider.value) {
        await api.updateAiProvider(editingProvider.value.id, { ...form })
      } else {
        await api.createAiProvider({ ...form })
      }
    } else {
      if (editingProvider.value) {
        await api.updateUserAiProvider(editingProvider.value.id, { ...form })
      } else {
        await api.createUserAiProvider({ ...form })
      }
    }
    toast.success(editingProvider.value ? '更新成功' : '添加成功')
    closeForm()
    isAdmin.value ? loadProviders() : loadUserProviders()
  } catch {}
}

async function deleteProvider(p) {
  const ok = await confirm.show({
    title: '删除服务商',
    message: `确定删除「${p.name}」吗？`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return
  try {
    if (isAdmin.value) {
      await api.deleteAiProvider(p.id)
    } else {
      await api.deleteUserAiProvider(p.id)
    }
    toast.success('已删除')
    isAdmin.value ? loadProviders() : loadUserProviders()
  } catch {}
}

async function setDefault(p) {
  try {
    if (isAdmin.value) {
      await api.updateAiProvider(p.id, { is_default: true })
    } else {
      await api.updateUserAiProvider(p.id, { is_default: true })
    }
    toast.success(`已将「${p.name}」设为默认`)
    isAdmin.value ? loadProviders() : loadUserProviders()
  } catch {}
}

async function testConnection(p) {
  testingId.value = p.id
  try {
    const result = isAdmin.value
      ? await api.testAiProvider(p.id)
      : await api.testUserAiProvider(p.id)
    if (result.ok) {
      toast.success(`${p.name} 连接成功`)
    } else {
      toast.error(`连接失败：${result.error}`)
    }
  } catch {} finally {
    testingId.value = null
  }
}

async function fetchModels(p) {
  loadingModelsId.value = p.id
  try {
    const result = isAdmin.value
      ? await api.getAiModels(p.id)
      : await api.getUserAiModels(p.id)
    if (result.models && result.models.length > 0) {
      // Show model selection dialog
      const model = await showModelPicker(result.models, p.model)
      if (model !== null) {
        if (isAdmin.value) {
          await api.updateAiProvider(p.id, { model })
        } else {
          await api.updateUserAiProvider(p.id, { model })
        }
        toast.success(`模型已设为 ${model}`)
        isAdmin.value ? loadProviders() : loadUserProviders()
      }
    } else {
      toast.info('未获取到可用模型')
    }
  } catch {} finally {
    loadingModelsId.value = null
  }
}

async function toggleEnabled(p) {
  try {
    const newEnabled = !p.enabled
    if (isAdmin.value) {
      await api.updateAiProvider(p.id, { enabled: newEnabled })
    } else {
      await api.updateUserAiProvider(p.id, { enabled: newEnabled })
    }
    toast.success(newEnabled ? `${p.name} 已启用` : `${p.name} 已停用`)
    isAdmin.value ? loadProviders() : loadUserProviders()
  } catch {}
}

// Model picker state
const showModelPickerDialog = ref(false)
const modelPickerList = ref([])
const modelPickerCurrent = ref('')
const modelPickerResolve = ref(null)

function showModelPicker(models, current) {
  modelPickerList.value = models
  modelPickerCurrent.value = current || ''
  showModelPickerDialog.value = true
  return new Promise(resolve => {
    modelPickerResolve.value = resolve
  })
}

function pickModel(model) {
  showModelPickerDialog.value = false
  modelPickerResolve.value?.(model)
}

function cancelModelPicker() {
  showModelPickerDialog.value = false
  modelPickerResolve.value?.(null)
}
</script>

<template>
  <div @click="showPresetMenu = false">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark">AI 设置</h1>
        <p class="text-xs sm:text-sm text-notion-muted dark:text-notion-muted-dark mt-1">
          {{ isAdmin ? '管理 AI 服务商，用于题目答案校验' : '配置你的 AI 服务商，用于题目答案校验' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative">
          <button @click.stop="showPresetMenu = !showPresetMenu" class="btn-secondary text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            添加服务商
            <svg class="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div v-if="showPresetMenu" class="absolute right-0 sm:left-auto top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-card shadow-lg border border-notion-border dark:border-notion-border-dark py-1 z-10 max-h-60 overflow-y-auto">
            <button
              @click="openAddForm(); showPresetMenu = false"
              class="w-full text-left px-4 py-2 text-sm text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              自定义服务商
            </button>
            <div class="border-t border-notion-border dark:border-notion-border-dark my-1" />
            <button
              v-for="preset in presets"
              :key="preset.name"
              @click="openAddForm(preset); showPresetMenu = false"
              class="w-full text-left px-4 py-2 text-sm text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full bg-notion-accent dark:bg-notion-accent-dark" />
              {{ preset.name }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 管理员 AI 配置展示（仅普通用户且被授权时显示） -->
    <div v-if="!isAdmin && adminConfig.authorized" class="card mb-6 border-l-4 border-blue-400">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-8 h-8 rounded-btn flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
          <svg class="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">管理员 AI 配置（已授权使用）</h3>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">您已被授权使用管理员的 AI 配置，如需使用自己的配置请在下方添加</p>
        </div>
      </div>
      <div v-if="adminConfig.providers.length > 0" class="space-y-2">
        <div
          v-for="p in adminConfig.providers"
          :key="p.name"
          class="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-800/50"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-notion-text dark:text-notion-text-dark">{{ p.name }}</span>
              <span v-if="p.is_default" class="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">默认</span>
            </div>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark font-mono">{{ p.base_url }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark">模型</p>
            <p class="text-sm font-mono text-notion-text dark:text-notion-text-dark">{{ p.model || '未选择' }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark">API Key</p>
            <p class="text-sm font-mono text-notion-text dark:text-notion-text-dark">****</p>
          </div>
        </div>
      </div>
      <div v-else class="text-sm text-notion-muted dark:text-notion-muted-dark">
        管理员暂未配置 AI 服务商
      </div>
    </div>

    <!-- 未授权提示（仅普通用户且未被授权时显示） -->
    <div v-if="!isAdmin && !adminConfig.authorized" class="card mb-6 border-l-4 border-amber-400">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-btn flex items-center justify-center bg-amber-50 dark:bg-amber-900/20">
          <svg class="w-4 h-4 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm text-notion-text dark:text-notion-text-dark">您尚未被授权使用管理员的 AI 配置</p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">请添加自己的 AI 服务商以使用 AI 校验功能</p>
        </div>
      </div>
    </div>

    <!-- Timeout setting -->
    <div class="card mb-6">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-8 h-8 rounded-btn flex items-center justify-center bg-gray-100 dark:bg-gray-700">
          <svg class="w-4 h-4 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">AI 请求超时</h3>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">单次 AI 分析请求的最大等待时间</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <input
          v-model.number="aiTimeout"
          type="number"
          min="10"
          max="600"
          step="10"
          class="input-field w-24 text-center"
          @blur="saveTimeout"
          @keyup.enter="saveTimeout"
        />
        <span class="text-sm text-notion-muted dark:text-notion-muted-dark">秒</span>
        <span class="text-xs text-notion-muted dark:text-notion-muted-dark ml-2">
          推荐 60-300 秒，当前 {{ aiTimeout }} 秒
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
    </div>

    <!-- Empty state -->
    <div v-else-if="providers.length === 0" class="card text-center py-16">
      <svg class="w-16 h-16 mx-auto text-notion-muted dark:text-notion-muted-dark mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>
      </svg>
      <h3 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark mb-2">还没有配置 AI 服务商</h3>
      <p class="text-sm text-notion-muted dark:text-notion-muted-dark mb-6">添加一个 AI 服务商，即可在题目详情中使用 AI 校验答案</p>
      <button @click="openAddForm()" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        添加第一个服务商
      </button>
    </div>

    <!-- Provider list -->
    <div v-else class="space-y-4">
      <div
        v-for="p in providers"
        :key="p.id"
        class="card"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-btn flex items-center justify-center"
              :class="p.is_default ? 'bg-notion-accent/10 dark:bg-notion-accent-dark/15' : 'bg-gray-100 dark:bg-gray-700'"
            >
              <svg class="w-5 h-5" :class="p.is_default ? 'text-notion-accent dark:text-notion-accent-dark' : 'text-notion-muted dark:text-notion-muted-dark'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">{{ p.name }}</h3>
                <span v-if="p.is_default" class="badge bg-notion-accent/10 text-notion-accent dark:bg-notion-accent-dark/15 dark:text-notion-accent-dark text-[10px]">默认</span>
                <span v-if="!p.enabled" class="badge bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 text-[10px]">已停用</span>
              </div>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5 font-mono">{{ p.base_url }}</p>
            </div>
          </div>
          <!-- 启用/停用开关 -->
          <button
            @click="toggleEnabled(p)"
            :class="[
              'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
              p.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            ]"
            :title="p.enabled ? '点击停用' : '点击启用'"
          >
            <span
              :class="[
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                p.enabled ? 'translate-x-5' : 'translate-x-0'
              ]"
            />
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">API Key</label>
            <p class="text-sm text-notion-text dark:text-notion-text-dark font-mono">{{ p.api_key_masked }}</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-notion-muted dark:text-notion-muted-dark mb-1">当前模型</label>
            <p class="text-sm text-notion-text dark:text-notion-text-dark">
              <span v-if="p.model" class="font-mono">{{ p.model }}</span>
              <span v-else class="text-notion-muted dark:text-notion-muted-dark italic">未选择</span>
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button @click="testConnection(p)" :disabled="testingId === p.id" class="btn-secondary text-xs py-1.5 px-2 sm:px-3">
            <svg v-if="testingId === p.id" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ testingId === p.id ? '测试中...' : '测试' }}
          </button>
          <button @click="fetchModels(p)" :disabled="loadingModelsId === p.id" class="btn-secondary text-xs py-1.5 px-2 sm:px-3">
            <svg v-if="loadingModelsId === p.id" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ loadingModelsId === p.id ? '获取中...' : '模型列表' }}
          </button>
          <button v-if="!p.is_default" @click="setDefault(p)" class="btn-secondary text-xs py-1.5 px-2 sm:px-3">
            设为默认
          </button>
          <button @click="openEditForm(p)" class="btn-secondary text-xs py-1.5 px-2 sm:px-3">
            编辑
          </button>
          <button @click="deleteProvider(p)" class="btn-secondary text-xs py-1.5 px-2 sm:px-3 text-red-500 hover:text-red-600">
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- 提示词管理 -->
    <div class="mt-8">
      <h2 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark mb-4">提示词管理</h2>

      <!-- 管理员：默认提示词配置 -->
      <div v-if="isAdmin" class="mb-6">
        <h3 class="text-sm font-medium text-notion-muted dark:text-notion-muted-dark mb-3">全局默认提示词</h3>
        <p class="text-xs text-notion-muted dark:text-notion-muted-dark mb-3">修改后将影响所有未自定义提示词的用户</p>
        <div class="space-y-3">
          <div
            v-for="(info, key) in promptLabels"
            :key="'default-' + key"
            class="card border-l-4 border-blue-400"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">{{ info.name }}</h4>
                </div>
                <p class="text-xs text-notion-muted dark:text-notion-muted-dark line-clamp-1">
                  {{ defaultPrompts[key]?.user_prompt?.substring(0, 80) }}...
                </p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button @click="openPromptEditor(key, true)" class="btn-secondary text-xs py-1 px-2">
                  编辑
                </button>
                <button @click="resetPrompt(key, true)" class="btn-secondary text-xs py-1 px-2">
                  恢复内置
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 用户：个人提示词配置 -->
      <div>
        <h3 v-if="isAdmin" class="text-sm font-medium text-notion-muted dark:text-notion-muted-dark mb-3">我的提示词</h3>
        <p v-if="isAdmin" class="text-xs text-notion-muted dark:text-notion-muted-dark mb-3">自定义您个人的提示词，优先级高于全局默认</p>
        <div class="space-y-3">
          <div
            v-for="(info, key) in promptLabels"
            :key="'user-' + key"
            class="card"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">{{ info.name }}</h4>
                  <span v-if="prompts[key]?.is_custom" class="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[10px]">已自定义</span>
                  <span v-else class="badge bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 text-[10px]">使用默认</span>
                </div>
                <p class="text-xs text-notion-muted dark:text-notion-muted-dark">{{ info.desc }}</p>
                <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1 line-clamp-1">
                  {{ prompts[key]?.user_prompt?.substring(0, 80) }}...
                </p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button @click="openPromptEditor(key, false)" class="btn-secondary text-xs py-1 px-2">
                  编辑
                </button>
                <button
                  v-if="prompts[key]?.is_custom"
                  @click="resetPrompt(key, false)"
                  class="btn-secondary text-xs py-1 px-2"
                >
                  恢复默认
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-[9997] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="closeForm" />
        <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div class="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-notion-border dark:border-notion-border-dark flex items-center justify-between">
            <h2 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark">
              {{ editingProvider ? '编辑服务商' : '添加服务商' }}
            </h2>
            <button @click="closeForm" class="p-1 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg class="w-5 h-5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <form @submit.prevent="submitForm" class="p-6 space-y-5">
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">名称 <span class="text-red-500">*</span></label>
              <input v-model="form.name" type="text" class="input-field w-full" placeholder="如：DeepSeek" required />
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">API 地址 <span class="text-red-500">*</span></label>
              <input v-model="form.base_url" type="text" class="input-field w-full font-mono text-xs" placeholder="https://api.deepseek.com/v1" required />
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">OpenAI 兼容格式，以 /v1 结尾</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">API Key <span class="text-red-500">*</span></label>
              <input v-model="form.api_key" type="password" class="input-field w-full font-mono text-xs" placeholder="sk-..." required />
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">模型</label>
              <input v-model="form.model" type="text" class="input-field w-full font-mono text-xs" placeholder="添加后可点击「获取模型列表」自动填充" />
            </div>
            <div class="flex items-center gap-2">
              <input v-model="form.is_default" type="checkbox" id="is_default" class="rounded accent-notion-accent dark:accent-notion-accent-dark" />
              <label for="is_default" class="text-sm text-notion-text dark:text-notion-text-dark">设为默认服务商</label>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="closeForm" class="btn-secondary">取消</button>
              <button type="submit" class="btn-primary">{{ editingProvider ? '更新' : '添加' }}</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Model Picker Modal -->
    <Teleport to="body">
      <div v-if="showModelPickerDialog" class="fixed inset-0 z-[9998] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="cancelModelPicker" />
        <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark max-w-md w-full max-h-[70vh] flex flex-col">
          <div class="px-6 py-4 border-b border-notion-border dark:border-notion-border-dark">
            <h2 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark">选择模型</h2>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">共 {{ modelPickerList.length }} 个可用模型</p>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <button
              v-for="m in modelPickerList"
              :key="m"
              @click="pickModel(m)"
              class="w-full text-left px-4 py-2.5 rounded-btn text-sm transition-colors flex items-center justify-between"
              :class="m === modelPickerCurrent
                ? 'bg-notion-accent/10 text-notion-accent dark:bg-notion-accent-dark/15 dark:text-notion-accent-dark'
                : 'text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-700'"
            >
              <span class="font-mono">{{ m }}</span>
              <svg v-if="m === modelPickerCurrent" class="w-4 h-4 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
          </div>
          <div class="px-6 py-3 border-t border-notion-border dark:border-notion-border-dark flex justify-end">
            <button @click="cancelModelPicker" class="btn-secondary text-sm">取消</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Prompt Editor Modal -->
    <Teleport to="body">
      <div v-if="showPromptEditor" class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="closePromptEditor" />
        <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark w-full max-w-2xl max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex-shrink-0 px-6 py-4 border-b border-notion-border dark:border-notion-border-dark flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark">
                {{ editingIsDefault ? '编辑默认提示词' : '编辑我的提示词' }} - {{ promptLabels[editingPromptKey]?.name }}
              </h2>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">
                {{ editingIsDefault ? '修改后将影响所有未自定义提示词的用户' : '自定义您个人的 AI 提示词' }}
              </p>
            </div>
            <button @click="closePromptEditor" class="p-1 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg class="w-5 h-5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">系统提示词</label>
              <textarea
                v-model="editingPrompt.system_prompt"
                rows="3"
                class="input-field w-full font-mono text-xs"
                placeholder="系统提示词..."
              ></textarea>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">定义 AI 的角色和基本行为</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">用户提示词</label>
              <textarea
                v-model="editingPrompt.user_prompt"
                rows="10"
                class="input-field w-full font-mono text-xs"
                placeholder="用户提示词..."
              ></textarea>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">实际发送给 AI 的提示词模板</p>
            </div>
            <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p class="text-xs font-medium text-notion-text dark:text-notion-text-dark mb-2">💡 可用变量：</p>
              <div class="flex flex-wrap gap-2">
                <code class="px-2 py-1 rounded bg-white dark:bg-gray-700 text-xs font-mono text-purple-600 dark:text-purple-400">{type}</code>
                <code class="px-2 py-1 rounded bg-white dark:bg-gray-700 text-xs font-mono text-purple-600 dark:text-purple-400">{content}</code>
                <code class="px-2 py-1 rounded bg-white dark:bg-gray-700 text-xs font-mono text-purple-600 dark:text-purple-400">{options}</code>
                <code class="px-2 py-1 rounded bg-white dark:bg-gray-700 text-xs font-mono text-purple-600 dark:text-purple-400">{category}</code>
              </div>
            </div>
          </div>
          <!-- Footer -->
          <div class="flex-shrink-0 px-6 py-4 border-t border-notion-border dark:border-notion-border-dark flex justify-between">
            <button @click="resetPrompt(editingPromptKey, editingIsDefault); closePromptEditor()" class="btn-secondary text-sm">
              {{ editingIsDefault ? '恢复系统内置' : '恢复默认' }}
            </button>
            <div class="flex gap-3">
              <button @click="closePromptEditor" class="btn-secondary text-sm">取消</button>
              <button @click="savePrompt" class="btn-primary text-sm">保存</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
