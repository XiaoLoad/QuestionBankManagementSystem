<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'

defineOptions({ name: 'SiteSettings' })

const api = useApi()
const toast = useToastStore()

const loading = ref(true)
const saving = ref(false)
const changesExpanded = ref(true)

// 暂存值（用户编辑只改这里，不触发接口）
const staged = reactive({
  site_name: '',
  site_description: '',
  announcement_modal: '',
  announcement_modal_enabled: false,
  announcement_banner: '',
  announcement_banner_enabled: false,
  app_version: 'v1.0.0',
  footer_text: '',
  footer_hitokoto: false,
  footer_hitokoto_types: 'a.b.c.d.e.f.g.h.i.j.k.l',
  footer_hitokoto_cache_minutes: 5,
})

// 服务端原始基线（保存成功或加载后更新）
const original = reactive({ ...staged })

// 一言类型配置
const hitokotoTypeOptions = [
  { key: 'a', label: '动画' }, { key: 'b', label: '漫画' }, { key: 'c', label: '游戏' },
  { key: 'd', label: '文学' }, { key: 'e', label: '原创' }, { key: 'f', label: '来自网络' },
  { key: 'g', label: '其他' }, { key: 'h', label: '影视' }, { key: 'i', label: '诗词' },
  { key: 'j', label: '网易云' }, { key: 'k', label: '哲学' }, { key: 'l', label: '抖机灵' },
]

// 字段中文名映射，用于未保存变更提示
const fieldLabels = {
  site_name: '网站名称',
  site_description: '网站副标题',
  announcement_modal: '弹窗内容',
  announcement_modal_enabled: '启用弹窗公告',
  announcement_banner: '横幅内容',
  announcement_banner_enabled: '启用横幅公告',
  app_version: '版本号',
  footer_text: '页脚版权文字',
  footer_hitokoto: '一言模式',
  footer_hitokoto_types: '一言句子类型',
  footer_hitokoto_cache_minutes: '一言缓存时长',
}

function isHitokotoTypeSelected(key) {
  return staged.footer_hitokoto_types.split('.').includes(key)
}

function toggleHitokotoType(key) {
  const types = staged.footer_hitokoto_types.split('.').filter(Boolean)
  const idx = types.indexOf(key)
  if (idx >= 0) {
    types.splice(idx, 1)
  } else {
    types.push(key)
  }
  staged.footer_hitokoto_types = types.join('.')
}

function selectAllHitokotoTypes() {
  staged.footer_hitokoto_types = hitokotoTypeOptions.map(t => t.key).join('.')
}

function clearAllHitokotoTypes() {
  staged.footer_hitokoto_types = ''
}

// 脏检测：逐字段对比暂存值与基线
const changedFields = computed(() => {
  const changed = []
  for (const key of Object.keys(staged)) {
    const cur = staged[key]
    const base = original[key]
    if (cur !== base && !(typeof cur === 'number' && cur === Number(base))) {
      changed.push(key)
    }
  }
  return changed
})

const hasUnsavedChanges = computed(() => changedFields.value.length > 0)

// 未保存变更明细（原始值 vs 当前值），用于提示区展示
const pendingChanges = computed(() => {
  return changedFields.value.map(key => ({
    key,
    label: fieldLabels[key] || key,
    from: formatValue(original[key]),
    to: formatValue(staged[key]),
  }))
})

function formatValue(v) {
  if (v === '' || v === null || v === undefined) return '（空）'
  if (typeof v === 'boolean') return v ? '开' : '关'
  if (typeof v === 'string' && v.includes('.') && /^[a-l](\.[a-l])*$/.test(v)) {
    return v.split('.').filter(Boolean).map(k => hitokotoTypeOptions.find(t => t.key === k)?.label || k).join('·')
  }
  const s = String(v)
  // 变更栏长文本截断，避免无边界撑开
  return s.length > 80 ? `${s.slice(0, 80)}…` : s
}

// 网站名称/副标题长度上限（标题不宜过长）
const SITE_NAME_MAX = 30
const SITE_DESC_MAX = 60

// 将接口数据写入暂存（布尔字段统一为布尔）
function applyToStaged(data) {
  staged.site_name = data.site_name || ''
  staged.site_description = data.site_description || ''
  staged.announcement_modal = data.announcement_modal || ''
  staged.announcement_modal_enabled = data.announcement_modal_enabled || false
  staged.announcement_banner = data.announcement_banner || ''
  staged.announcement_banner_enabled = data.announcement_banner_enabled || false
  staged.app_version = data.app_version || 'v1.0.0'
  staged.footer_text = data.footer_text || ''
  staged.footer_hitokoto = data.footer_hitokoto || false
  staged.footer_hitokoto_types = data.footer_hitokoto_types || 'a.b.c.d.e.f.g.h.i.j.k.l'
  staged.footer_hitokoto_cache_minutes = data.footer_hitokoto_cache_minutes || 5
}

onMounted(async () => {
  try {
    const data = await api.getSiteSettingsAll()
    applyToStaged(data)
    Object.assign(original, staged)
  } catch (e) {
    toast.error('加载设置失败，请刷新重试')
  } finally {
    loading.value = false
  }
})

// 保存：仅提交已变更字段（布尔转字符串），成功后更新基线
async function handleSave() {
  if (!hasUnsavedChanges.value || saving.value) return
  saving.value = true
  const patch = {}
  for (const key of changedFields.value) {
    let v = staged[key]
    if (key.endsWith('_enabled') || key === 'footer_hitokoto') {
      v = v ? '1' : '0'
    }
    if (key === 'footer_hitokoto_cache_minutes') {
      v = String(v)
    }
    patch[key] = v
  }
  try {
    await api.updateSiteSettings(patch)
    Object.assign(original, staged)
    toast.success('设置已保存')
  } catch (e) {
    toast.error('保存失败，请检查网络后重试')
  } finally {
    saving.value = false
  }
}

// 重置：所有暂存项恢复至基线
function handleReset() {
  Object.assign(staged, original)
}

// 离开页面守卫：存在未保存变更时二次确认
function beforeUnloadHandler(e) {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
})

// SPA 路由离开守卫（切换设置标签页/跳转其他页面）
onBeforeRouteLeave((to, from, next) => {
  if (hasUnsavedChanges.value) {
    const ok = window.confirm('当前有未保存的修改，离开页面将丢失这些更改。确定要离开吗？')
    if (ok) {
      next()
    } else {
      next(false)
    }
  } else {
    next()
  }
})
</script>

<template>
  <div>
    <div class="mb-6 sm:mb-8">
      <h1 class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark">网站设置</h1>
      <p class="text-xs sm:text-sm text-notion-muted dark:text-notion-muted-dark mt-1">配置网站基本信息和公告</p>
    </div>

    <!-- 未保存变更悬浮栏：置顶固定，变更列表 + 保存/重置操作同处 -->
    <Transition name="collapse">
      <div v-if="hasUnsavedChanges" class="sticky top-2 z-30 mb-5 sm:mb-6 rounded-btn border border-amber-300 dark:border-amber-700 bg-amber-50/95 dark:bg-amber-900/30 backdrop-blur-sm shadow-lg shadow-amber-900/5">
        <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-amber-200/70 dark:border-amber-700/60">
          <button type="button" @click="changesExpanded = !changesExpanded" class="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-300 min-w-0">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"/></svg>
            <span class="truncate">有 {{ pendingChanges.length }} 项未保存的更改</span>
            <svg :class="['w-3.5 h-3.5 flex-shrink-0 transition-transform', changesExpanded ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              type="button" @click="handleReset"
              :disabled="!hasUnsavedChanges"
              class="text-xs px-3 py-1.5 rounded-btn border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              重置变更
            </button>
            <button
              type="button" @click="handleSave"
              :disabled="!hasUnsavedChanges || saving"
              class="text-xs px-4 py-1.5 rounded-btn bg-amber-500 dark:bg-amber-600 text-white font-medium hover:bg-amber-600 dark:hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {{ saving ? '保存中...' : `保存修改（${changedFields.length}）` }}
            </button>
          </div>
        </div>
        <Transition name="collapse">
          <ul v-if="changesExpanded" class="px-4 py-2.5 space-y-1.5 max-h-[40vh] overflow-y-auto">
            <li v-for="c in pendingChanges" :key="c.key" class="text-[11px] sm:text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-baseline gap-x-2">
              <span class="font-medium">{{ c.label }}：</span>
              <span class="line-through text-amber-500 dark:text-amber-400/80">{{ c.from }}</span>
              <span class="text-amber-600 dark:text-amber-300">→</span>
              <span class="font-medium text-amber-900 dark:text-amber-100 break-all">{{ c.to }}</span>
            </li>
          </ul>
        </Transition>
      </div>
    </Transition>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
    </div>

    <template v-else>
      <div class="space-y-5 sm:space-y-6">

        <!-- 网站信息 -->
        <div class="card">
          <h3 class="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark mb-4">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
            网站信息
          </h3>
          <div class="space-y-4 pl-0 sm:pl-5">
            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">网站名称</label>
              <input v-model="staged.site_name" :maxlength="SITE_NAME_MAX" type="text" class="input-field w-full" placeholder="题库管理" />
              <p class="text-[10px] text-notion-muted dark:text-notion-muted-dark mt-1">{{ staged.site_name.length }}/{{ SITE_NAME_MAX }}</p>
            </div>
            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">网站副标题</label>
              <input v-model="staged.site_description" :maxlength="SITE_DESC_MAX" type="text" class="input-field w-full" placeholder="Question Bank" />
              <p class="text-[10px] text-notion-muted dark:text-notion-muted-dark mt-1">{{ staged.site_description.length }}/{{ SITE_DESC_MAX }}</p>
            </div>
          </div>
        </div>

        <!-- 弹窗公告 -->
        <div class="card">
          <h3 class="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark mb-4">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
            弹窗公告
          </h3>
          <div class="space-y-4 pl-0 sm:pl-5">
            <div class="flex items-start sm:items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark">启用弹窗公告</p>
                <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">用户登录或打开页面时弹出，内容更新后自动重新弹窗</p>
              </div>
              <button
                type="button"
                @click="staged.announcement_modal_enabled = !staged.announcement_modal_enabled"
                :class="[
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                  staged.announcement_modal_enabled ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-200 dark:bg-gray-700'
                ]"
              >
                <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', staged.announcement_modal_enabled ? 'translate-x-5' : 'translate-x-0']" />
              </button>
            </div>

            <!-- 版本号 -->
            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">版本号</label>
              <input v-model="staged.app_version" type="text" class="input-field w-full" placeholder="v1.0.0" />
            </div>

            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">弹窗内容</label>
              <textarea v-model="staged.announcement_modal" rows="6" class="input-field resize-y w-full" placeholder="输入弹窗公告内容，支持Markdown语法..." />
              <p class="text-[10px] text-notion-muted dark:text-notion-muted-dark mt-1">支持Markdown语法，如：标题(#)、列表(-)、粗体(**)、链接等</p>
            </div>
          </div>
        </div>

        <!-- 横幅公告 -->
        <div class="card">
          <h3 class="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark mb-4">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            横幅公告
          </h3>
          <div class="space-y-4 pl-0 sm:pl-5">
            <div class="flex items-start sm:items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark">启用横幅公告</p>
                <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">仪表盘顶部常驻显示，建议简短内容</p>
              </div>
              <button
                type="button"
                @click="staged.announcement_banner_enabled = !staged.announcement_banner_enabled"
                :class="[
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                  staged.announcement_banner_enabled ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-200 dark:bg-gray-700'
                ]"
              >
                <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', staged.announcement_banner_enabled ? 'translate-x-5' : 'translate-x-0']" />
              </button>
            </div>
            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">横幅内容</label>
              <textarea v-model="staged.announcement_banner" rows="2" class="input-field resize-y w-full" placeholder="简短提醒，如：系统维护中..." />
            </div>
          </div>
        </div>

        <!-- 页脚设置 -->
        <div class="card">
          <h3 class="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark mb-4">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            页脚设置
          </h3>
          <div class="space-y-4 pl-0 sm:pl-5">
            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">页脚版权文字</label>
              <input v-model="staged.footer_text" type="text" class="input-field w-full" placeholder="© 2024 Your Name. All rights reserved." />
              <p class="text-[10px] text-notion-muted dark:text-notion-muted-dark mt-1">开启一言模式后，版权文字将作为一言引用来源的前缀显示</p>
            </div>

            <!-- 一言模式 -->
            <div class="border-t border-notion-border dark:border-notion-border-dark pt-4">
              <div class="flex items-start sm:items-center justify-between gap-3 mb-3">
                <div class="flex-1 min-w-0">
                  <p class="text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark">一言模式</p>
                  <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">页脚显示来自 Hitokoto 的随机句子</p>
                </div>
                <button
                  type="button"
                  @click="staged.footer_hitokoto = !staged.footer_hitokoto"
                  :class="[
                    'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                    staged.footer_hitokoto ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-200 dark:bg-gray-700'
                  ]"
                >
                  <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', staged.footer_hitokoto ? 'translate-x-5' : 'translate-x-0']" />
                </button>
              </div>

              <!-- 一言类型选择 -->
              <div v-if="staged.footer_hitokoto" class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-medium text-notion-muted dark:text-notion-muted-dark">句子类型</label>
                  <div class="flex gap-2">
                    <button type="button" @click="selectAllHitokotoTypes" class="text-[10px] text-notion-accent dark:text-notion-accent-dark hover:underline">全选</button>
                    <button type="button" @click="clearAllHitokotoTypes" class="text-[10px] text-notion-muted dark:text-notion-muted-dark hover:underline">清空</button>
                  </div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="t in hitokotoTypeOptions"
                    :key="t.key"
                    type="button"
                    @click="toggleHitokotoType(t.key)"
                    :class="[
                      'px-2 py-1 rounded-btn text-xs font-medium border transition-colors',
                      isHitokotoTypeSelected(t.key)
                        ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark'
                        : 'border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark'
                    ]"
                  >
                    {{ t.label }}
                  </button>
                </div>
                <p v-if="!staged.footer_hitokoto_types" class="text-[10px] text-red-500">请至少选择一种类型</p>

                <!-- 缓存时长 -->
                <div class="flex flex-wrap items-center gap-3 pt-1">
                  <span class="text-xs text-notion-muted dark:text-notion-muted-dark">缓存时长</span>
                  <input
                    v-model.number="staged.footer_hitokoto_cache_minutes"
                    type="number"
                    min="1"
                    max="60"
                    class="input-field w-14 text-center text-xs py-1"
                  />
                  <span class="text-xs text-notion-muted dark:text-notion-muted-dark">分钟</span>
                </div>
                <p class="text-[10px] text-notion-muted dark:text-notion-muted-dark">所有用户共享同一条一言，到期后自动刷新。调小可加快更换频率，调大可减少对一言服务器的请求。</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作区已由顶部悬浮栏承载，此处留白 -->
      </div>
    </template>
  </div>
</template>
