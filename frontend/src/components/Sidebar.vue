<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import gsap from 'gsap'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { useTrashStore } from '@/stores/trash'
import { getAllThemes } from '@/themes'

defineProps({
  open: Boolean
})
const emit = defineEmits(['close'])

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()
const authStore = useAuthStore()
const api = useApi()
const trashStore = useTrashStore()

// 主题色选择
const themes = getAllThemes()

// 站点名称
const siteName = ref('题库管理')
const siteDesc = ref('Question Bank')

async function loadSiteSettings() {
  try {
    const data = await api.getSiteSettings()
    if (data.site_name) siteName.value = data.site_name
    if (data.site_description) siteDesc.value = data.site_description
  } catch {}
}

onMounted(loadSiteSettings)

// ========== 导航结构（两级树） ==========
// type: 'leaf' 直接跳转；'group' 可展开，children 为叶子
const navTree = [
  { type: 'leaf', path: '/', name: '仪表盘', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  {
    type: 'group', name: '题库管理', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    children: [
      { path: '/questions', name: '题目管理' },
      { path: '/categories', name: '分类管理' },
      { path: '/trash', name: '回收站', badge: true, adminOnly: true },
    ],
  },
  {
    type: 'group', name: '学习中心', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    children: [
      { path: '/quiz', name: '题库练习' },
      { path: '/ai-settings', name: 'AI 设置' },
    ],
  },
  {
    type: 'group', name: '数据与对接', icon: 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z',
    adminOnly: true,
    children: [
      { path: '/data', name: '数据管理', adminOnly: true },
      { path: '/external', name: '题库对接', adminOnly: true },
    ],
  },
  {
    type: 'group', name: '系统管理', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    children: [
      { path: '/users', name: '用户管理', adminOnly: true },
      { path: '/site-settings', name: '网站设置', adminOnly: true },
      { path: '/about', name: '关于' },
    ],
  },
  {
    type: 'group', name: '外观主题', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    children: [],
  },
]

// 根据角色过滤
const visibleTree = computed(() =>
  navTree
    .map(node => {
      if (node.type === 'leaf') return node.adminOnly && !authStore.isAdmin ? null : node
      const children = node.children.filter(c => !c.adminOnly || authStore.isAdmin)
      if (node.adminOnly && !authStore.isAdmin) return null
      return { ...node, children }
    })
    .filter(Boolean)
)

// ========== 展开状态 + GSAP 动画 ==========
const expanded = ref(new Set())

// 面板与箭头 DOM 引用
const panels = reactive({})
const chevrons = reactive({})
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function setPanelRef(name, el) {
  if (el) panels[name] = el
  else delete panels[name]
}

function setChevronRef(name, el) {
  if (el) chevrons[name] = el
  else delete chevrons[name]
}

function isExpanded(name) {
  return expanded.value.has(name)
}

// 展开动画：高度撑开 + 子项错峰淡入上移
function animateOpen(name) {
  const panel = panels[name]
  const chevron = chevrons[name]
  if (chevron) {
    gsap.to(chevron, { rotation: 90, duration: reduceMotion ? 0 : 0.32, ease: 'power2.out', overwrite: 'auto' })
  }
  if (!panel) return
  gsap.killTweensOf(panel)
  gsap.set(panel, { display: 'block' })
  if (reduceMotion) {
    gsap.set(panel, { height: 'auto', autoAlpha: 1 })
    return
  }
  const items = panel.querySelectorAll(':scope > *')
  gsap.fromTo(panel,
    { height: 0, autoAlpha: 0 },
    {
      height: 'auto',
      autoAlpha: 1,
      duration: 0.34,
      ease: 'power3.out',
      overwrite: 'auto',
      onComplete: () => gsap.set(panel, { clearProps: 'height,overflow' }),
    }
  )
  if (items.length) {
    gsap.fromTo(items,
      { y: -6, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.26, ease: 'power2.out', stagger: 0.035, delay: 0.04, overwrite: 'auto' }
    )
  }
}

// 收起动画：高度归零 + 整体淡出
function animateClose(name) {
  const panel = panels[name]
  const chevron = chevrons[name]
  if (chevron) {
    gsap.to(chevron, { rotation: 0, duration: reduceMotion ? 0 : 0.24, ease: 'power2.inOut', overwrite: 'auto' })
  }
  if (!panel) return
  gsap.killTweensOf(panel)
  if (reduceMotion) {
    gsap.set(panel, { display: 'none' })
    return
  }
  gsap.to(panel, {
    height: 0,
    autoAlpha: 0,
    duration: 0.24,
    ease: 'power2.inOut',
    overwrite: 'auto',
    onComplete: () => gsap.set(panel, { display: 'none', clearProps: 'height,overflow' }),
  })
}

function toggleGroup(name) {
  const next = new Set(expanded.value)
  if (next.has(name)) {
    next.delete(name)
    animateClose(name)
  } else {
    next.add(name)
    animateOpen(name)
  }
  expanded.value = next
}

// 无动画直接切换（用于路由自动展开与初始化）
function setExpanded(name, open) {
  const next = new Set(expanded.value)
  if (open) next.add(name)
  else next.delete(name)
  expanded.value = next

  const panel = panels[name]
  const chevron = chevrons[name]
  if (chevron) gsap.set(chevron, { rotation: open ? 90 : 0 })
  if (panel) {
    gsap.killTweensOf(panel)
    if (open) gsap.set(panel, { display: 'block', height: 'auto', autoAlpha: 1 })
    else gsap.set(panel, { display: 'none', height: 0, autoAlpha: 0 })
  }
}

// 当前路由所属分组
function isGroupActive(node) {
  return node.type === 'group' && node.children.some(c => isActive(c.path))
}

async function loadTrashCount() {
  if (!authStore.isAdmin) return
  try {
    const data = await api.getTrashCount()
    trashStore.setCount(data.count || 0)
  } catch {}
}

onMounted(loadTrashCount)

// 路由变化时自动展开当前页所属分组
watch(() => route.path, () => {
  for (const node of visibleTree.value) {
    if (node.type !== 'group' || !node.children.length) continue
    if (node.children.some(c => isActive(c.path) && c.path !== '/')) {
      if (!expanded.value.has(node.name)) {
        nextTick(() => setExpanded(node.name, true))
      }
      break
    }
  }
}, { immediate: true })

onBeforeUnmount(() => {
  Object.values(panels).forEach(el => gsap.killTweensOf(el))
  Object.values(chevrons).forEach(el => gsap.killTweensOf(el))
})

function navigate(path) {
  router.push(path)
  emit('close')
}

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
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
        <div class="min-w-0">
          <h1 class="text-base font-bold text-notion-text dark:text-notion-text-dark truncate">{{ siteName }}</h1>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark truncate">{{ siteDesc }}</p>
        </div>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 px-3 py-4 overflow-y-auto">
      <div class="space-y-1">
        <template v-for="node in visibleTree" :key="node.name || node.path">

          <!-- 叶子节点 -->
          <button
            v-if="node.type === 'leaf'"
            @click="navigate(node.path)"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-colors duration-150"
            :style="isActive(node.path)
              ? { backgroundColor: 'color-mix(in srgb, var(--theme-accent) 10%, transparent)', color: 'var(--theme-accent)' }
              : { color: 'var(--theme-text)' }"
            :class="!isActive(node.path) && 'hover:bg-gray-100 dark:hover:bg-gray-800'"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="node.icon"/>
            </svg>
            <span class="flex-1 text-left">{{ node.name }}</span>
          </button>

          <!-- 分组节点 -->
          <template v-else>
            <button
              @click="toggleGroup(node.name)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-colors duration-150"
              :style="isGroupActive(node)
                ? { color: 'var(--theme-accent)' }
                : { color: 'var(--theme-text)' }"
              :class="!isGroupActive(node) && 'hover:bg-gray-100 dark:hover:bg-gray-800'"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="node.icon"/>
              </svg>
              <span class="flex-1 text-left">{{ node.name }}</span>
              <svg
                :ref="el => setChevronRef(node.name, el)"
                class="w-4 h-4 flex-shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>

            <!-- 展开面板：子项 / 外观主题 / 系统管理子项 -->
            <div
              :ref="el => setPanelRef(node.name, el)"
              class="ml-5 pl-3 border-l border-notion-border dark:border-notion-border-dark overflow-hidden"
              style="display: none"
            >
              <!-- 普通子项 -->
              <div v-if="node.children.length" class="space-y-1 py-1">
                <button
                  v-for="child in node.children"
                  :key="child.path"
                  @click="navigate(child.path)"
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-btn text-sm transition-colors duration-150"
                  :style="isActive(child.path)
                    ? { backgroundColor: 'color-mix(in srgb, var(--theme-accent) 10%, transparent)', color: 'var(--theme-accent)', fontWeight: '500' }
                    : { color: 'var(--theme-muted)' }"
                  :class="!isActive(child.path) && 'hover:bg-gray-100 dark:hover:bg-gray-800'"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    :style="isActive(child.path) ? { backgroundColor: 'var(--theme-accent)' } : {}"
                  />
                  <span class="flex-1 text-left">{{ child.name }}</span>
                  <span
                    v-if="child.badge && trashStore.count > 0"
                    class="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center"
                  >
                    {{ trashStore.count > 99 ? '99+' : trashStore.count }}
                  </span>
                </button>
              </div>

              <!-- 外观主题面板 -->
              <div v-else class="py-1">
                <button
                  @click="theme.toggle()"
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-btn text-sm font-medium transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
                  style="color: var(--theme-text)"
                >
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path v-if="theme.isDark" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                    <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                  </svg>
                  <span class="flex-1 text-left">{{ theme.isDark ? '切换亮色' : '切换暗色' }}</span>
                </button>

                <div class="px-3 py-2">
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      v-for="t in themes"
                      :key="t.id"
                      @click="theme.setThemeColor(t.id)"
                      class="flex flex-col items-center gap-1 p-1.5 rounded-btn transition-transform duration-150 hover:scale-105"
                      :class="theme.themeColor === t.id ? 'bg-gray-100 dark:bg-gray-800 ring-2' : ''"
                      :style="theme.themeColor === t.id ? { borderColor: t.preview, '--tw-ring-color': t.preview } : {}"
                      :title="t.name"
                    >
                      <div
                        class="w-5 h-5 rounded-full shadow-sm"
                        :style="{ backgroundColor: t.preview }"
                      />
                      <span class="text-[10px] text-notion-muted dark:text-notion-muted-dark">{{ t.name }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

        </template>
      </div>
    </nav>

    <!-- Footer -->
    <div class="px-3 py-4 border-t border-notion-border dark:border-notion-border-dark">
      <!-- User Info + Logout -->
      <div class="flex items-center gap-3 px-3 py-2">
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
             :style="{ backgroundColor: 'color-mix(in srgb, var(--theme-accent) 10%, transparent)' }">
          <span class="text-sm font-medium" :style="{ color: 'var(--theme-accent)' }">
            {{ authStore.displayName ? authStore.displayName.charAt(0).toUpperCase() : 'U' }}
          </span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-notion-text dark:text-notion-text-dark truncate">
            {{ authStore.displayName || '用户' }}
          </p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">
            {{ authStore.isAdmin ? '管理员' : '普通用户' }}
          </p>
        </div>
        <button
          @click="handleLogout"
          class="flex-shrink-0 p-1.5 rounded-btn text-notion-muted dark:text-notion-muted-dark hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="退出登录"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>