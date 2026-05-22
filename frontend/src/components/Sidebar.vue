<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useApi } from '@/composables/useApi'
import { useTrashStore } from '@/stores/trash'

defineProps({
  open: Boolean
})
const emit = defineEmits(['close'])

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()
const api = useApi()
const trashStore = useTrashStore()

const navItems = [
  { path: '/', name: '仪表盘', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/questions', name: '题目管理', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { path: '/categories', name: '分类管理', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  { path: '/data', name: '数据管理', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
  { path: '/ai-settings', name: 'AI 设置', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5' },
  { path: '/external', name: '题库对接', icon: 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z' },
  { path: '/trash', name: '回收站', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', badge: true },
  { path: '/about', name: '关于', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
]

async function loadTrashCount() {
  try {
    const data = await api.getTrashCount()
    trashStore.setCount(data.count || 0)
  } catch {}
}

onMounted(loadTrashCount)

// Expose for parent to refresh


function navigate(path) {
  router.push(path)
  emit('close')
}

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <aside
    :class="[
      'fixed top-0 left-0 z-50 h-full w-64 bg-notion-bg dark:bg-notion-bg-dark border-r border-notion-border dark:border-notion-border-dark flex flex-col transition-transform duration-200 lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <!-- Logo -->
    <div class="px-5 py-5 border-b border-notion-border dark:border-notion-border-dark">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-btn bg-notion-accent dark:bg-notion-accent-dark flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
        </div>
        <div>
          <h1 class="text-base font-bold text-notion-text dark:text-notion-text-dark">题库管理</h1>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">Question Bank</p>
        </div>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="navigate(item.path)"
        :class="[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-colors duration-150',
          isActive(item.path)
            ? 'bg-notion-accent/10 text-notion-accent dark:bg-notion-accent-dark/15 dark:text-notion-accent-dark'
            : 'text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-800'
        ]"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="item.icon"/>
        </svg>
        <span class="flex-1 text-left">{{ item.name }}</span>
        <span
          v-if="item.badge && trashStore.count > 0"
          class="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center"
        >
          {{ trashStore.count > 99 ? '99+' : trashStore.count }}
        </span>
      </button>
    </nav>

    <!-- Footer -->
    <div class="px-3 py-4 border-t border-notion-border dark:border-notion-border-dark space-y-2">
      <button
        @click="theme.toggle()"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium text-notion-text dark:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <svg v-if="theme.isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>
        {{ theme.isDark ? '切换亮色' : '切换暗色' }}
      </button>
    </div>
  </aside>
</template>
