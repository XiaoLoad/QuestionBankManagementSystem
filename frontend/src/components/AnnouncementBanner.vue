<script setup>
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import { useApi } from '@/composables/useApi'

defineOptions({ name: 'AnnouncementBanner' })

const api = useApi()

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
const bannerExpanded = ref(false)

// 分别追踪弹窗和横幅的已读状态
const MODAL_SEEN_KEY = 'seen_announcement_modal_at'
const BANNER_DISMISSED_KEY = 'dismissed_announcement_banner_at'
let modalUpdatedAt = ''
let bannerUpdatedAt = ''

async function loadAnnouncement() {
  try {
    const data = await api.getSiteSettings()

    // 弹窗公告 - 独立追踪
    modalContent.value = data.announcement_modal || ''
    modalEnabled.value = data.announcement_modal_enabled || false
    modalUpdatedAt = data.announcement_modal_updated_at || ''
    if (modalEnabled.value && modalContent.value) {
      const lastSeen = localStorage.getItem(MODAL_SEEN_KEY) || ''
      if (!lastSeen || modalUpdatedAt > lastSeen) {
        showModal.value = true
      }
    }

    // 横幅公告 - 独立追踪
    bannerContent.value = data.announcement_banner || ''
    bannerEnabled.value = data.announcement_banner_enabled || false
    bannerUpdatedAt = data.announcement_banner_updated_at || ''
    if (bannerEnabled.value && bannerContent.value) {
      const dismissedAt = localStorage.getItem(BANNER_DISMISSED_KEY) || ''
      // 如果用户从未关闭过，或者横幅有更新，则显示
      bannerDismissed.value = dismissedAt && bannerUpdatedAt && !(bannerUpdatedAt > dismissedAt)
    } else {
      bannerDismissed.value = true
    }
  } catch {}
}

function closeModal() {
  showModal.value = false
  try {
    localStorage.setItem(MODAL_SEEN_KEY, modalUpdatedAt || new Date().toISOString())
  } catch {}
}

function dismissBanner() {
  bannerDismissed.value = true
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY, bannerUpdatedAt || new Date().toISOString())
  } catch {}
}

onMounted(loadAnnouncement)
</script>

<template>
  <!-- 横幅公告 -->
  <div
    v-if="bannerEnabled && bannerContent && !bannerDismissed"
    class="mb-5 sm:mb-6 p-3 sm:p-4 rounded-card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
  >
    <div class="flex items-start gap-3">
      <svg class="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">通知</p>
        <p
          class="text-sm text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap break-words"
          :class="{ 'line-clamp-3': !bannerExpanded }"
        >{{ bannerContent }}</p>
        <button
          @click="bannerExpanded = !bannerExpanded"
          class="mt-1 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          {{ bannerExpanded ? '收起' : '展开全部' }}
        </button>
      </div>
      <button @click="dismissBanner" class="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors flex-shrink-0">
        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
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
</template>
