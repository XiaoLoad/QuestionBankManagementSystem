<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useQuizStore } from '@/stores/quiz'
import Sidebar from './Sidebar.vue'
import AnnouncementBanner from './AnnouncementBanner.vue'

const route = useRoute()
const sidebarOpen = ref(false)
const api = useApi()
const quizStore = useQuizStore()

// 平板档（640–1023px）：侧栏折叠为图标条，内容区让出更多宽度
const isTablet = ref(false)
function updateViewport() {
  isTablet.value = window.innerWidth >= 640 && window.innerWidth < 1024
}
onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
})
onBeforeUnmount(() => window.removeEventListener('resize', updateViewport))

// 登录页不显示侧边栏
const showSidebar = computed(() => route.path !== '/login')

// 横幅公告显示条件：一级页面且非刷题进行中/结果页
const showBanner = computed(() => {
  // 路由标记为 hideBanner 的不显示
  if (route.meta.hideBanner) return false
  // 刷题进行中或结果页不显示
  if (route.path === '/quiz' && quizStore.state !== 'setup') return false
  return true
})

// 页脚
const footerText = ref('')
const siteName = ref('题库管理')
const footerHitokoto = ref(false)
const hitokoto = ref({ hitokoto: '', from: '', from_who: '' })
let hitokotoTimer = null

async function loadFooter() {
  try {
    const data = await api.getSiteSettings()
    footerText.value = data.footer_text || ''
    siteName.value = data.site_name || '题库管理'
    footerHitokoto.value = data.footer_hitokoto || false
    if (footerHitokoto.value) {
      await loadHitokoto()
      // 每 30 秒刷新一次一言
      hitokotoTimer = setInterval(loadHitokoto, 30000)
    }
  } catch {}
}

async function loadHitokoto() {
  try {
    const data = await api.getHitokoto()
    if (data.hitokoto) hitokoto.value = data
  } catch {}
}

onMounted(loadFooter)
</script>

<template>
  <!-- 手机档：侧栏为抽屉且已移出画布，根容器不做横向 flex 布局，让主列占满整宽 -->
  <div
    :class="[
      'lg:h-screen min-w-0 bg-notion-bg dark:bg-notion-bg-dark',
      isTablet ? 'flex lg:overflow-hidden' : 'block'
    ]"
  >
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen && showSidebar"
      class="fixed inset-0 bg-black/40 z-40 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <Sidebar v-if="showSidebar" :open="sidebarOpen" :collapsed="isTablet" @close="sidebarOpen = false" />

    <!-- Main content -->
    <div
      :class="[
        'lg:h-screen min-w-0 flex flex-col lg:overflow-hidden transition-[margin] duration-200 ease-out',
        showSidebar
          ? (isTablet ? 'flex-1 min-w-0 ml-16' : 'flex-1 min-w-0 w-full lg:w-auto lg:ml-64')
          : 'flex-1 min-w-0 w-full lg:w-auto'
      ]"
    >
      <!-- 手机端顶栏：平板与桌面已有常驻侧栏，无需汉堡 -->
      <header
        v-if="showSidebar && !isTablet"
        class="lg:hidden flex-shrink-0 sticky top-0 z-30 bg-notion-bg/80 dark:bg-notion-bg-dark/80 backdrop-blur-sm border-b border-notion-border dark:border-notion-border-dark px-4 py-3 flex items-center gap-3"
      >
        <button @click="sidebarOpen = true" class="p-1.5 min-w-[44px] min-h-[44px] -ml-1 flex items-center justify-center rounded-btn hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="打开导航菜单">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <span class="text-lg font-semibold truncate">{{ siteName }}</span>
      </header>

      <div class="flex-1 min-w-0 flex flex-col lg:min-h-0">
        <main :class="['lg:flex-1 lg:overflow-y-auto', showSidebar ? 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full' : '']">
          <AnnouncementBanner v-if="showBanner" />
          <slot />
        </main>
        <!-- 页脚 -->
        <footer v-if="footerText || footerHitokoto" class="flex-shrink-0 px-4 py-3 border-t border-notion-border dark:border-notion-border-dark">
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark text-center">
            <template v-if="footerHitokoto && hitokoto.hitokoto">
              <span v-if="footerText">{{ footerText }} — </span>
              <span class="italic">{{ hitokoto.hitokoto }}</span>
              <span v-if="hitokoto.from" class="opacity-60"> ——{{ hitokoto.from }}</span>
            </template>
            <template v-else>{{ footerText }}</template>
          </p>
        </footer>
      </div>
    </div>
  </div>
</template>
