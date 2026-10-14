<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import gsap from 'gsap'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { useTrashStore } from '@/stores/trash'
import { getAllThemes } from '@/themes'

const props = defineProps({
  open: Boolean,
  // 平板档：仅显示图标条
  collapsed: Boolean,
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
      { path: '/questions', name: '题目管理', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      { path: '/categories', name: '分类管理', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
      { path: '/trash', name: '回收站', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', badge: true, adminOnly: true },
    ],
  },
  {
    type: 'group', name: '学习中心', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    children: [
      { path: '/quiz', name: '题库练习', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
      { path: '/ai-settings', name: 'AI 设置', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5' },
    ],
  },
  {
    type: 'group', name: '数据与对接', icon: 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z',
    adminOnly: true,
    children: [
      { path: '/data', name: '数据管理', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z', adminOnly: true },
      { path: '/external', name: '题库对接', icon: 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z', adminOnly: true },
    ],
  },
  {
    type: 'group', name: '系统管理', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    children: [
      { path: '/users', name: '用户管理', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', adminOnly: true },
      { path: '/site-settings', name: '网站设置', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', adminOnly: true },
      { path: '/about', name: '关于', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
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

// 平板图标条：分组拍平为叶子列表（外观主题单独转为亮暗切换）
const collapsedItems = computed(() => {
  const out = []
  for (const node of visibleTree.value) {
    if (node.type === 'leaf') { out.push(node); continue }
    if (!node.children.length) {
      out.push({ action: 'theme', name: theme.isDark ? '切换亮色' : '切换暗色', icon: theme.isDark
        ? 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'
        : 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' })
      continue
    }
    for (const child of node.children) {
      out.push({ path: child.path, name: child.name, icon: child.icon, badge: child.badge })
    }
  }
  return out
})

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
      'fixed top-0 left-0 z-50 h-full bg-notion-bg dark:bg-notion-bg-dark border-r border-notion-border dark:border-notion-border-dark flex flex-col transition-[transform,width] duration-200 ease-out lg:translate-x-0',
      collapsed ? 'w-16' : 'w-64',
      collapsed || open ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <!-- Logo -->
    <div
      class="border-b border-notion-border dark:border-notion-border-dark"
      :class="collapsed ? 'px-3 py-4 flex justify-center' : 'px-5 py-5'"
    >
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-btn bg-notion-accent dark:bg-notion-accent-dark flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
        </div>
        <div v-if="!collapsed" class="min-w-0">
          <h1 class="text-base font-bold text-notion-text dark:text-notion-text-dark truncate">{{ siteName }}</h1>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark truncate">{{ siteDesc }}</p>
        </div>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 py-4 overflow-y-auto" :class="collapsed ? 'px-2' : 'px-3'">
      <!-- 平板图标条：分组拍平 -->
      <div v-if="collapsed" class="space-y-1">
        <button
          v-for="(item, i) in collapsedItems"
          :key="item.path || `${item.action}-${i}`"
          @click="item.action === 'theme' ? theme.toggle() : navigate(item.path)"
          class="w-full flex items-center justify-center gap-2 px-2 py-2.5 rounded-btn min-h-[44px] transition-colors duration-150 relative group"
          :style="item.path && isActive(item.path)
            ? { backgroundColor: 'color-mix(in srgb, var(--theme-accent) 10%, transparent)', color: 'var(--theme-accent)' }
            : { color: 'var(--theme-text)' }"
          :class="item.path && !isActive(item.path) && 'hover:bg-gray-100 dark:hover:bg-gray-800'"
          :title="item.name"
          :aria-label="item.name"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="item.icon"/>
          </svg>
          <span
            v-if="item.badge && trashStore.count > 0"
            class="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center"
          >
            {{ trashStore.count > 99 ? '99+' : trashStore.count }}
          </span>
        </button>
      </div>

      <!-- 完整导航树 -->
      <div v-else class="space-y-1">
        <template v-for="node in visibleTree" :key="node.name || node.path">

          <!-- 叶子节点 -->
          <button
            v-if="node.type === 'leaf'"
            @click="navigate(node.path)"
            class="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-btn text-sm font-medium transition-colors duration-150"
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
              class="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-btn text-sm font-medium transition-colors duration-150"
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
                  class="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-btn text-sm transition-colors duration-150"
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
                  class="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-btn text-sm font-medium transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
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
    <div
      class="border-t border-notion-border dark:border-notion-border-dark"
      :class="collapsed ? 'px-2 py-3' : 'px-3 py-4'"
    >
      <!-- 平板图标条：仅保留退出（亮暗切换已在导航栏内） -->
      <div v-if="collapsed" class="space-y-1">
        <button
          @click="handleLogout"
          class="w-full flex items-center justify-center px-2 py-2.5 rounded-btn min-h-[44px] text-notion-muted dark:text-notion-muted-dark hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="退出登录"
          aria-label="退出登录"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>

      <!-- 完整导航树：用户信息 + 退出 -->
      <div v-else class="flex items-center gap-3 px-3 py-2">
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
          class="flex-shrink-0 p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-btn text-notion-muted dark:text-notion-muted-dark hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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