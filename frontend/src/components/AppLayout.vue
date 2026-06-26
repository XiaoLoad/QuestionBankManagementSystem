<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import Sidebar from './Sidebar.vue'
import AnnouncementBanner from './AnnouncementBanner.vue'

const route = useRoute()
const sidebarOpen = ref(false)
const api = useApi()

// 登录页不显示侧边栏
const showSidebar = computed(() => route.path !== '/login')

// 页脚
const footerText = ref('')
const footerHitokoto = ref(false)
const hitokoto = ref({ hitokoto: '', from: '', from_who: '' })
let hitokotoTimer = null

async function loadFooter() {
  try {
    const data = await api.getSiteSettings()
    footerText.value = data.footer_text || ''
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
  <div class="h-screen flex overflow-hidden bg-notion-bg dark:bg-notion-bg-dark">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen && showSidebar"
      class="fixed inset-0 bg-black/40 z-40 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <Sidebar v-if="showSidebar" :open="sidebarOpen" @close="sidebarOpen = false" />

    <!-- Main content -->
    <div :class="['h-screen flex flex-col overflow-hidden', showSidebar ? 'flex-1 lg:ml-64' : 'flex-1']">
      <!-- Mobile header -->
      <header v-if="showSidebar" class="lg:hidden flex-shrink-0 sticky top-0 z-30 bg-notion-bg/80 dark:bg-notion-bg-dark/80 backdrop-blur-sm border-b border-notion-border dark:border-notion-border-dark px-4 py-3 flex items-center gap-3">
        <button @click="sidebarOpen = true" class="p-1.5 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <span class="text-lg font-semibold">题库管理</span>
      </header>

      <div class="flex-1 flex flex-col overflow-hidden">
        <main :class="['flex-1 overflow-y-auto', showSidebar ? 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full' : '']">
          <AnnouncementBanner />
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
