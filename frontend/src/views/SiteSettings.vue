<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'

defineOptions({ name: 'SiteSettings' })

const api = useApi()
const toast = useToastStore()

const loading = ref(true)
const saving = ref(false)
const resetting = ref(false)

const siteName = ref('')
const siteDescription = ref('')
const announcementModal = ref('')
const announcementModalEnabled = ref(false)
const isChangelog = ref(false)
const announcementBanner = ref('')
const announcementBannerEnabled = ref(false)
const appVersion = ref('v1.0.0')
const footerText = ref('')
const footerHitokoto = ref(false)
const footerHitokotoTypes = ref('a.b.c.d.e.f.g.h.i.j.k.l')
const footerHitokotoCacheMinutes = ref(5)

// 一言类型配置
const hitokotoTypeOptions = [
  { key: 'a', label: '动画' }, { key: 'b', label: '漫画' }, { key: 'c', label: '游戏' },
  { key: 'd', label: '文学' }, { key: 'e', label: '原创' }, { key: 'f', label: '来自网络' },
  { key: 'g', label: '其他' }, { key: 'h', label: '影视' }, { key: 'i', label: '诗词' },
  { key: 'j', label: '网易云' }, { key: 'k', label: '哲学' }, { key: 'l', label: '抖机灵' },
]

function isHitokotoTypeSelected(key) {
  return footerHitokotoTypes.value.split('.').includes(key)
}

function toggleHitokotoType(key) {
  const types = footerHitokotoTypes.value.split('.').filter(Boolean)
  const idx = types.indexOf(key)
  if (idx >= 0) {
    types.splice(idx, 1)
  } else {
    types.push(key)
  }
  footerHitokotoTypes.value = types.join('.')
}

function selectAllHitokotoTypes() {
  footerHitokotoTypes.value = hitokotoTypeOptions.map(t => t.key).join('.')
}

function clearAllHitokotoTypes() {
  footerHitokotoTypes.value = ''
}

onMounted(async () => {
  try {
    const data = await api.getSiteSettingsAll()
    siteName.value = data.site_name || ''
    siteDescription.value = data.site_description || ''
    announcementModal.value = data.announcement_modal || ''
    announcementModalEnabled.value = data.announcement_modal_enabled || false
    announcementBanner.value = data.announcement_banner || ''
    announcementBannerEnabled.value = data.announcement_banner_enabled || false
    appVersion.value = data.app_version || 'v1.0.0'
    footerText.value = data.footer_text || ''
    footerHitokoto.value = data.footer_hitokoto || false
    footerHitokotoTypes.value = data.footer_hitokoto_types || 'a.b.c.d.e.f.g.h.i.j.k.l'
    footerHitokotoCacheMinutes.value = data.footer_hitokoto_cache_minutes || 5
  } catch (e) {
    // handled
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  saving.value = true
  try {
    await api.updateSiteSettings({
      site_name: siteName.value,
      site_description: siteDescription.value,
      announcement_modal: announcementModal.value,
      announcement_modal_enabled: announcementModalEnabled.value ? '1' : '0',
      is_changelog: isChangelog.value,
      announcement_banner: announcementBanner.value,
      announcement_banner_enabled: announcementBannerEnabled.value ? '1' : '0',
      app_version: appVersion.value,
      footer_text: footerText.value,
      footer_hitokoto: footerHitokoto.value ? '1' : '0',
      footer_hitokoto_types: footerHitokotoTypes.value,
      footer_hitokoto_cache_minutes: String(footerHitokotoCacheMinutes.value),
    })
    toast.success('设置已保存')
    // 保存后重置更新日志开关
    isChangelog.value = false
  } catch (e) {
    // handled
  } finally {
    saving.value = false
  }
}

async function handleResetChangelog() {
  if (!confirm('确定要重置更新日志为初始内容吗？')) return
  resetting.value = true
  try {
    await api.resetChangelog()
    toast.success('更新日志已重置')
  } catch (e) {
    // handled
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 sm:mb-8">
      <h1 class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark">网站设置</h1>
      <p class="text-xs sm:text-sm text-notion-muted dark:text-notion-muted-dark mt-1">配置网站基本信息和公告</p>
    </div>

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
              <input v-model="siteName" type="text" class="input-field w-full" placeholder="题库管理" />
            </div>
            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">网站副标题</label>
              <input v-model="siteDescription" type="text" class="input-field w-full" placeholder="Question Bank" />
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
                @click="announcementModalEnabled = !announcementModalEnabled"
                :class="[
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                  announcementModalEnabled ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-200 dark:bg-gray-700'
                ]"
              >
                <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', announcementModalEnabled ? 'translate-x-5' : 'translate-x-0']" />
              </button>
            </div>

            <!-- 版本号和更新日志标记 -->
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="flex-1">
                <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">版本号</label>
                <input v-model="appVersion" type="text" class="input-field w-full" placeholder="v1.0.0" />
              </div>
              <div class="flex items-end">
                <div class="flex items-start sm:items-center justify-between gap-3 p-3 rounded-btn bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 w-full sm:w-auto">
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-amber-700 dark:text-amber-300">标记为更新日志</p>
                    <p class="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">开启后将记录到更新日志</p>
                  </div>
                  <button
                    type="button"
                    @click="isChangelog = !isChangelog"
                    :class="[
                      'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                      isChangelog ? 'bg-amber-500 dark:bg-amber-600' : 'bg-gray-200 dark:bg-gray-700'
                    ]"
                  >
                    <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', isChangelog ? 'translate-x-5' : 'translate-x-0']" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">弹窗内容</label>
              <textarea v-model="announcementModal" rows="6" class="input-field resize-y w-full" placeholder="输入弹窗公告内容，支持Markdown语法..." />
              <p class="text-[10px] text-notion-muted dark:text-notion-muted-dark mt-1">支持Markdown语法，如：标题(#)、列表(-)、粗体(**)、链接等</p>
            </div>
            <div class="flex justify-end">
              <button @click="handleResetChangelog" :disabled="resetting" class="btn-secondary text-xs">
                {{ resetting ? '重置中...' : '重置更新日志' }}
              </button>
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
                @click="announcementBannerEnabled = !announcementBannerEnabled"
                :class="[
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                  announcementBannerEnabled ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-200 dark:bg-gray-700'
                ]"
              >
                <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', announcementBannerEnabled ? 'translate-x-5' : 'translate-x-0']" />
              </button>
            </div>
            <div>
              <label class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">横幅内容</label>
              <textarea v-model="announcementBanner" rows="2" class="input-field resize-y w-full" placeholder="简短提醒，如：系统维护中..." />
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
              <input v-model="footerText" type="text" class="input-field w-full" placeholder="© 2024 Your Name. All rights reserved." />
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
                  @click="footerHitokoto = !footerHitokoto"
                  :class="[
                    'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                    footerHitokoto ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-200 dark:bg-gray-700'
                  ]"
                >
                  <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', footerHitokoto ? 'translate-x-5' : 'translate-x-0']" />
                </button>
              </div>

              <!-- 一言类型选择 -->
              <div v-if="footerHitokoto" class="space-y-2">
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
                <p v-if="!footerHitokotoTypes" class="text-[10px] text-red-500">请至少选择一种类型</p>

                <!-- 缓存时长 -->
                <div class="flex items-center gap-3 pt-1">
                  <span class="text-xs text-notion-muted dark:text-notion-muted-dark">缓存时长</span>
                  <input
                    v-model.number="footerHitokotoCacheMinutes"
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

        <!-- 保存按钮 -->
        <button @click="handleSave" :disabled="saving" class="btn-primary w-full sm:w-auto px-8 py-2.5">
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>
    </template>
  </div>
</template>
