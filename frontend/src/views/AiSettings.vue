<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useConfirmStore } from '@/stores/confirm'

defineOptions({ name: 'AiSettings' })

const api = useApi()
const toast = useToastStore()
const confirm = useConfirmStore()

const providers = ref([])
const presets = ref([])
const loading = ref(true)
const showForm = ref(false)
const editingProvider = ref(null)
const testingId = ref(null)
const loadingModelsId = ref(null)

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
  await Promise.all([loadProviders(), loadPresets()])
  loading.value = false
})

async function loadProviders() {
  try { providers.value = await api.getAiProviders() } catch {}
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
    if (editingProvider.value) {
      await api.updateAiProvider(editingProvider.value.id, { ...form })
      toast.success('更新成功')
    } else {
      await api.createAiProvider({ ...form })
      toast.success('添加成功')
    }
    closeForm()
    loadProviders()
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
    await api.deleteAiProvider(p.id)
    toast.success('已删除')
    loadProviders()
  } catch {}
}

async function setDefault(p) {
  try {
    await api.updateAiProvider(p.id, { is_default: true })
    toast.success(`已将「${p.name}」设为默认`)
    loadProviders()
  } catch {}
}

async function testConnection(p) {
  testingId.value = p.id
  try {
    const result = await api.testAiProvider(p.id)
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
    const result = await api.getAiModels(p.id)
    if (result.models && result.models.length > 0) {
      // Show model selection dialog
      const model = await showModelPicker(result.models, p.model)
      if (model !== null) {
        await api.updateAiProvider(p.id, { model })
        toast.success(`模型已设为 ${model}`)
        loadProviders()
      }
    } else {
      toast.info('未获取到可用模型')
    }
  } catch {} finally {
    loadingModelsId.value = null
  }
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
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">AI 设置</h1>
        <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">管理 AI 服务商，用于题目答案校验</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative group">
          <button class="btn-secondary">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            添加服务商
            <svg class="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div class="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-card shadow-lg border border-notion-border dark:border-notion-border-dark py-1 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <button
              @click="openAddForm()"
              class="w-full text-left px-4 py-2 text-sm text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              自定义服务商
            </button>
            <div class="border-t border-notion-border dark:border-notion-border-dark my-1" />
            <button
              v-for="preset in presets"
              :key="preset.name"
              @click="openAddForm(preset)"
              class="w-full text-left px-4 py-2 text-sm text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full bg-notion-accent dark:bg-notion-accent-dark" />
              {{ preset.name }}
            </button>
          </div>
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
              </div>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5 font-mono">{{ p.base_url }}</p>
            </div>
          </div>
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
          <button @click="testConnection(p)" :disabled="testingId === p.id" class="btn-secondary text-xs py-1.5 px-3">
            <svg v-if="testingId === p.id" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ testingId === p.id ? '测试中...' : '测试连通性' }}
          </button>
          <button @click="fetchModels(p)" :disabled="loadingModelsId === p.id" class="btn-secondary text-xs py-1.5 px-3">
            <svg v-if="loadingModelsId === p.id" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ loadingModelsId === p.id ? '获取中...' : '获取模型列表' }}
          </button>
          <button v-if="!p.is_default" @click="setDefault(p)" class="btn-secondary text-xs py-1.5 px-3">
            设为默认
          </button>
          <button @click="openEditForm(p)" class="btn-secondary text-xs py-1.5 px-3">
            编辑
          </button>
          <button @click="deleteProvider(p)" class="btn-secondary text-xs py-1.5 px-3 text-red-500 hover:text-red-600">
            删除
          </button>
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
  </div>
</template>
