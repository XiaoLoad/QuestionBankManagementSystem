<script setup>
import { ref, onMounted, computed } from 'vue'
import { marked } from 'marked'
import avatarUrl from "@/assets/images/test.jpg";
import { useApi } from '@/composables/useApi'

defineOptions({ name: "About" })

const api = useApi()

const appVersion = ref('v1.0.0')
const changelog = ref('')
const loading = ref(true)
const showChangelog = ref(false)

const renderedChangelog = computed(() => {
  if (!changelog.value) return ''
  return marked.parse(changelog.value)
})

onMounted(async () => {
  try {
    const data = await api.getSiteSettings()
    appVersion.value = data.app_version || 'v1.0.0'
    changelog.value = data.changelog || ''
  } catch {} finally {
    loading.value = false
  }
})

const roles = ['独立开发者', '开源爱好者', '工具控']

const techStack = [
  { name: 'Vue 3', color: '#4FC08D', path: 'M24,1.61H14.06L12,5.16,9.94,1.61H0L12,22.39ZM12,14.08,5.16,2.23H9.59L12,6.41l2.41-4.18h4.43Z' },
  { name: 'Vite', color: '#646CFF', path: 'M12,1.55L3.06,18.13,4.58,18.72,12,5.4l7.42,13.32,1.52-.59ZM12,14.23,8.17,7.72H15.83Z' },
  { name: 'Node.js', color: '#339933', path: 'M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0l8.795-5.076c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072c-0.081-0.047-0.189-0.047-0.271,0L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.135,0.235l2.409,1.392c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253v10.021c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z' },
  { name: 'Express', color: '#000000', label: 'Ex' },
  { name: 'SQLite', color: '#003B57', path: 'M12.006,2.412c-2.17,0-4.007,0.726-5.264,1.797C5.485,5.281,4.74,6.753,4.74,8.288c0,2.008,1.215,3.596,3.14,4.655c0.605,0.332,1.08,0.613,1.412,0.867c0.224,0.171,0.338,0.301,0.387,0.409c0.048,0.106,0.067,0.268-0.022,0.514c-0.115,0.319-0.493,0.729-1.141,0.729c-0.283,0-0.603-0.059-0.966-0.185c-0.637-0.221-1.361-0.618-2.088-1.237c-0.253,1.695-0.432,3.182-0.432,4.227c0,1.665,0.454,2.532,1.224,2.532c0.55,0,1.082-0.396,1.591-1.183c0.528-0.816,1.073-1.972,1.691-3.466c0.649,1.547,1.379,2.726,2.078,3.525c0.478,0.541,0.928,0.809,1.336,0.809c0.379,0,0.692-0.195,0.91-0.565c0.073-0.125,0.134-0.274,0.184-0.445c0.05-0.173,0.085-0.38,0.107-0.617c0.063-0.725,0.024-1.688-0.123-2.866c-0.145-1.179-0.373-2.536-0.68-3.992c0.647-0.753,1.228-1.613,1.703-2.537C18.241,6.526,18.5,5.18,18.5,4.015c0-1.026-0.341-1.603-0.965-1.603c-0.343,0-0.742,0.183-1.18,0.547C15.856,3.355,15.118,3.7,14.312,3.7c-1.15,0-2.175-0.537-2.853-1.021C10.935,2.292,11.279,2.412,12.006,2.412z' },
  { name: 'TailwindCSS', color: '#06B6D4', path: 'M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C16.337,6.182,14.976,4.8,12.001,4.8zM6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C10.337,13.382,8.976,12,6.001,12z' },
  { name: 'Pinia', color: '#FFD859', path: 'M13.277.002c-.079-.01-.193.024-.31.09a2.346 2.346 0 0 0-.415.311c-.301.274-.65.68-.985 1.176-.672.99-1.31 2.356-1.485 3.785-.12.977-.154 1.849-.074 2.578a5.878 5.878 0 0 1 1.956-.338c.922 0 1.804.218 2.618.613.197-.637.34-1.395.445-2.246.175-1.429-.1-2.907-.499-4.028a6.695 6.695 0 0 0-.653-1.378 2.296 2.296 0 0 0-.321-.401c-.097-.092-.199-.153-.277-.162zm-6.81 2.965a.603.603 0 0 0-.288.117l-.013.011a.863.863 0 0 0-.177.327c-.051.15-.094.344-.126.565a8.205 8.205 0 0 0-.044 1.637c.08 1.222.397 2.665 1.079 3.769.093.15.193.296.294.442.726-.776 1.567-1.385 2.488-1.768-.1-.79-.06-1.714.066-2.744.038-.31.1-.616.176-.916a6.45 6.45 0 0 0-1.692-1.08 4.575 4.575 0 0 0-1.29-.366 1.805 1.805 0 0 0-.474.006zm11.751 1.789c-.21.003-.442.022-.687.06a5.974 5.974 0 0 0-2.132.76c-.009.146-.019.291-.036.437-.11.888-.258 1.684-.475 2.364.848.468 1.614 1.13 2.267 1.94.823-.85 1.43-2.05 1.787-3.13.187-.57.304-1.1.35-1.514.022-.207.027-.38.017-.51-.01-.133-.042-.206-.04-.202a.35.35 0 0 0-.114-.072 1.516 1.516 0 0 0-.375-.1 3.42 3.42 0 0 0-.562-.033zm-6.254 3.139c-2.014 0-3.83 1.087-5.147 2.834-1.316 1.748-2.131 4.16-2.131 6.807 0 2.65.806 4.258 2.131 5.218C8.132 23.707 9.96 24 11.964 24c2.004 0 3.831-.293 5.147-1.246 1.326-.96 2.133-2.568 2.133-5.218 0-2.647-.816-5.059-2.133-6.806-1.317-1.748-3.134-2.835-5.147-2.835zm-3.297 5.209a1.282 1.282 0 0 1 .292 2.518c.115.094.177.201.164.307-.032.265-.521.424-1.09.354-.571-.07-1.007-.342-.974-.607.024-.198.302-.336.678-.364a1.282 1.282 0 0 1 .93-2.208zm6.284.22a1.282 1.282 0 0 1 .726 2.303c.437.058.757.244.757.466 0 .267-.466.483-1.04.483-.574 0-1.04-.216-1.04-.483 0-.098.063-.189.17-.265a1.282 1.282 0 0 1 .427-2.505zm-6.318.215a.822.822 0 1 0 .028 1.645.822.822 0 0 0-.028-1.645zm6.284.22a.822.822 0 1 0 .027 1.644.822.822 0 0 0-.027-1.644zm-6.543.109a.338.338 0 1 1-.023.677.338.338 0 0 1 .023-.677zm6.284.22a.339.339 0 1 1-.018 0h.018zm-3.91 1.179c.17.252.432.404.808.447.372.043.694-.05.976-.28a.145.145 0 1 1 .183.226c-.344.28-.745.394-1.192.343-.445-.051-.79-.24-1.016-.574a.145.145 0 1 1 .24-.162z' },
  { name: 'Chart.js', color: '#FF6384', rect: true },
  { name: 'SQLite3', color: '#4A90D9', path: 'M12,2L4,5v6.09c0,5.05,3.41,9.76,8,10.91,4.59-1.15,8-5.86,8-10.91V5L12,2z M10.94,15.54l-3.54-3.54 1.41-1.41 2.12,2.12 4.24-4.24 1.41,1.41L10.94,15.54z' },
  { name: 'Git', color: '#F05032', path: 'M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L8.708 2.627l2.76 2.76c.645-.215 1.379-.07 1.889.441.516.515.658 1.258.438 1.9l2.66 2.66c.645-.222 1.387-.078 1.9.435.721.72.721 1.884 0 2.604-.72.719-1.886.719-2.604 0-.538-.536-.668-1.321-.4-1.978l-2.48-2.48v6.53c.175.087.339.197.482.338.72.72.72 1.884 0 2.604-.72.72-1.884.72-2.604 0-.72-.72-.72-1.884 0-2.604.18-.18.387-.316.604-.416V8.835c-.217-.1-.424-.236-.604-.416-.543-.54-.676-1.334-.396-1.992L7.576 3.75.45 10.881c-.6.605-.6 1.584 0 2.189l10.48 10.477c.604.604 1.582.604 2.186 0l10.43-10.43c.605-.603.605-1.582 0-2.187' },
  { name: 'Docker', color: '#2496ED', path: 'M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.186.186 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z' },
]

// 复制一份用于无缝滚动
const techStackLoop = [...techStack, ...techStack]

const features = [
  { title: '数据管理', desc: '仪表盘、题目CRUD、分类管理、多数据库切换、AI校验', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
  { title: '在线刷题', desc: '多分类多题型、顺序/随机出题、复习模式、错题重练', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { title: '用户系统', desc: '多用户登录、角色权限、分类可见性控制、外部题库对接', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
]

const friendLinks = [
  { name: 'Yatori 刷课程序', desc: '自动考试答题系统', url: 'https://github.com/yatori-dev', icon: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' },
  { name: '题库管理系统', desc: '当前项目开源地址', url: 'https://github.com/XiaoLoad/QuestionBankManagementSystem', icon: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' },
  { name: '个人博客', desc: 'lovex2095.top', url: 'https://lovex2095.top', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
]

const currentRoleIndex = ref(0)

onMounted(() => {
  setInterval(() => {
    currentRoleIndex.value = (currentRoleIndex.value + 1) % roles.length
  }, 2500)
})
</script>

<template>
  <div class="max-w-4xl mx-auto">

    <!-- ========== Hero 区域 ========== -->
    <div class="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-notion-accent/10 via-blue-50 to-purple-50 dark:from-notion-accent-dark/10 dark:via-blue-900/20 dark:to-purple-900/20 border border-notion-border dark:border-notion-border-dark">
      <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-notion-accent/5 dark:bg-notion-accent-dark/10 blur-3xl"></div>
      <div class="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-blue-400/5 dark:bg-blue-400/10 blur-3xl"></div>

      <div class="relative p-6 sm:p-10 flex flex-col items-center text-center">
        <img
          :src="avatarUrl"
          alt="头像"
          class="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white dark:ring-gray-800 shadow-xl mb-5"
        />
        <h1 class="text-2xl sm:text-3xl font-bold text-notion-text dark:text-notion-text-dark mb-3">
          派大星
        </h1>
        <p class="text-base text-notion-text dark:text-notion-text-dark mb-5">
          是一名
          <span class="relative inline-block h-[1.5em] overflow-hidden align-bottom">
            <Transition name="role" mode="out-in">
              <span :key="currentRoleIndex" class="text-notion-accent dark:text-notion-accent-dark font-semibold">{{ roles[currentRoleIndex] }}</span>
            </Transition>
          </span>
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-white/80 dark:bg-gray-800/80 text-xs text-notion-text dark:text-notion-text-dark border border-notion-border dark:border-notion-border-dark">专注实用工具开发</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-white/80 dark:bg-gray-800/80 text-xs text-notion-text dark:text-notion-text-dark border border-notion-border dark:border-notion-border-dark">热爱开源</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-white/80 dark:bg-gray-800/80 text-xs text-notion-text dark:text-notion-text-dark border border-notion-border dark:border-notion-border-dark">追求极致体验</span>
        </div>
      </div>
    </div>

    <!-- ========== 技术栈（纵向滚动） ========== -->
    <div class="card mb-8">
      <h2 class="text-lg font-bold text-notion-text dark:text-notion-text-dark mb-1">技术栈</h2>
      <p class="text-xs text-notion-muted dark:text-notion-muted-dark mb-5">用于构建此项目的技术</p>
      <div class="flex gap-4 overflow-hidden">
        <!-- 左列：向下滚动 -->
        <div class="flex-1 overflow-hidden" style="max-height: 320px;">
          <div class="tech-scroll-down">
            <div v-for="(tech, i) in techStackLoop" :key="'d-'+i"
              class="flex items-center gap-3 p-3 mb-3 rounded-xl border border-notion-border dark:border-notion-border-dark bg-gray-50/50 dark:bg-gray-800/30 hover:border-notion-accent/30 dark:hover:border-notion-accent-dark/30 transition-colors"
            >
              <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ backgroundColor: tech.color + '18' }">
                <svg v-if="tech.rect" class="w-5 h-5" :style="{ color: tech.color }" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="2" y="13" width="4" height="8" rx="1"/><rect x="8" y="9" width="4" height="12" rx="1"/><rect x="14" y="5" width="4" height="16" rx="1"/><rect x="20" y="2" width="4" height="19" rx="1"/>
                </svg>
                <svg v-else-if="tech.label" class="w-5 h-5" :style="{ color: tech.color }" viewBox="0 0 24 24">
                  <text x="2" y="18" font-size="16" font-weight="700" font-family="system-ui,sans-serif" fill="currentColor">{{ tech.label }}</text>
                </svg>
                <svg v-else class="w-5 h-5" :style="{ color: tech.color }" viewBox="0 0 24 24" fill="currentColor">
                  <path :d="tech.path"/>
                </svg>
              </div>
              <span class="text-sm font-medium text-notion-text dark:text-notion-text-dark">{{ tech.name }}</span>
            </div>
          </div>
        </div>
        <!-- 右列：向上滚动 -->
        <div class="flex-1 overflow-hidden hidden sm:block" style="max-height: 320px;">
          <div class="tech-scroll-up">
            <div v-for="(tech, i) in techStackLoop" :key="'u-'+i"
              class="flex items-center gap-3 p-3 mb-3 rounded-xl border border-notion-border dark:border-notion-border-dark bg-gray-50/50 dark:bg-gray-800/30 hover:border-notion-accent/30 dark:hover:border-notion-accent-dark/30 transition-colors"
            >
              <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ backgroundColor: tech.color + '18' }">
                <svg v-if="tech.rect" class="w-5 h-5" :style="{ color: tech.color }" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="2" y="13" width="4" height="8" rx="1"/><rect x="8" y="9" width="4" height="12" rx="1"/><rect x="14" y="5" width="4" height="16" rx="1"/><rect x="20" y="2" width="4" height="19" rx="1"/>
                </svg>
                <svg v-else-if="tech.label" class="w-5 h-5" :style="{ color: tech.color }" viewBox="0 0 24 24">
                  <text x="2" y="18" font-size="16" font-weight="700" font-family="system-ui,sans-serif" fill="currentColor">{{ tech.label }}</text>
                </svg>
                <svg v-else class="w-5 h-5" :style="{ color: tech.color }" viewBox="0 0 24 24" fill="currentColor">
                  <path :d="tech.path"/>
                </svg>
              </div>
              <span class="text-sm font-medium text-notion-text dark:text-notion-text-dark">{{ tech.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 项目特性 ========== -->
    <div class="mb-8">
      <h2 class="text-lg font-bold text-notion-text dark:text-notion-text-dark mb-1">项目特性</h2>
      <p class="text-xs text-notion-muted dark:text-notion-muted-dark mb-5">核心功能模块</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="feat in features" :key="feat.title" class="card group hover:shadow-md transition-shadow">
          <div class="w-10 h-10 rounded-btn bg-notion-accent/10 dark:bg-notion-accent-dark/15 flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="feat.icon"/>
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-notion-text dark:text-notion-text-dark mb-1">{{ feat.title }}</h3>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark leading-relaxed">{{ feat.desc }}</p>
        </div>
      </div>
    </div>

    <!-- ========== 关于项目 ========== -->
    <div class="card mb-8">
      <h2 class="text-lg font-bold text-notion-text dark:text-notion-text-dark mb-1">关于项目</h2>
      <p class="text-xs text-notion-muted dark:text-notion-muted-dark mb-5">心路历程</p>
      <div class="space-y-4 text-sm text-notion-text dark:text-notion-text-dark leading-relaxed">
        <p>
          题库管理系统是为
          <a href="https://github.com/yatori-dev/yatori-go-console" target="_blank" rel="noopener" class="text-notion-accent dark:text-notion-accent-dark hover:underline">yatori-go-console</a>
          刷课程序开发的配套管理工具。最初只是为了解决刷课题库的可视化维护需求，随着功能的不断扩展，逐渐发展为一个独立的完整管理系统。
        </p>
        <p>
          项目从最初的题目 CRUD 和分类管理起步，逐步加入了在线刷题、多用户系统、AI 答案校验、外部题库对接等模块。整个开发过程中大量借助了 AI 辅助编程，从架构设计、代码编写到 UI 优化，AI 深度参与了各个环节，大幅提升了开发效率和代码质量。
        </p>
        <p>
          系统基于 Vue 3 + Node.js + SQLite 技术栈构建，与刷课软件共享同一个数据库文件，所有修改实时生效，无需手动同步。支持多数据库管理、一键部署、移动端适配等功能。
        </p>
      </div>
    </div>

    <!-- ========== 版本信息 + 更新日志 ========== -->
    <div class="card mb-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">当前版本</h2>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">题库管理系统</p>
        </div>
        <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
          {{ appVersion }}
        </span>
      </div>
      <button
        @click="showChangelog = !showChangelog"
        class="w-full flex items-center justify-between py-3 px-4 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span class="text-sm font-medium text-notion-text dark:text-notion-text-dark">更新日志</span>
        <svg :class="['w-4 h-4 text-notion-muted dark:text-notion-muted-dark transition-transform duration-200', showChangelog ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <Transition name="collapse">
        <div v-if="showChangelog" class="mt-3 max-h-[400px] overflow-y-auto pr-1">
          <div v-if="changelog" class="markdown-body text-sm text-notion-text dark:text-notion-text-dark" v-html="renderedChangelog"></div>
          <p v-else class="text-sm text-notion-muted dark:text-notion-muted-dark text-center py-4">暂无更新日志</p>
        </div>
      </Transition>
    </div>

    <!-- ========== 友情链接 ========== -->
    <div class="card">
      <h2 class="text-lg font-bold text-notion-text dark:text-notion-text-dark mb-1">友情链接</h2>
      <p class="text-xs text-notion-muted dark:text-notion-muted-dark mb-5">相关项目</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a
          v-for="link in friendLinks"
          :key="link.name"
          :href="link.url"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-3 p-3 rounded-btn border border-notion-border dark:border-notion-border-dark hover:border-notion-accent/30 dark:hover:border-notion-accent-dark/30 hover:shadow-sm transition-all group"
        >
          <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-notion-muted dark:text-notion-muted-dark group-hover:text-notion-accent dark:group-hover:text-notion-accent-dark transition-colors" fill="currentColor" viewBox="0 0 24 24"><path :d="link.icon"/></svg>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-notion-text dark:text-notion-text-dark group-hover:text-notion-accent dark:group-hover:text-notion-accent-dark transition-colors truncate">{{ link.name }}</p>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark truncate">{{ link.desc }}</p>
          </div>
        </a>
      </div>
    </div>

  </div>
</template>

<style scoped>
.role-enter-active,
.role-leave-active {
  transition: all 0.4s ease;
}
.role-enter-from { opacity: 0; transform: translateY(20px); }
.role-leave-to { opacity: 0; transform: translateY(-20px); }

/* 纵向滚动动画 — 左列向下 */
.tech-scroll-down {
  animation: scrollDown 25s linear infinite;
}
.tech-scroll-down:hover {
  animation-play-state: paused;
}

/* 纵向滚动动画 — 右列向上 */
.tech-scroll-up {
  animation: scrollUp 28s linear infinite;
}
.tech-scroll-up:hover {
  animation-play-state: paused;
}

@keyframes scrollDown {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
@keyframes scrollUp {
  0% { transform: translateY(-50%); }
  100% { transform: translateY(0); }
}
</style>
