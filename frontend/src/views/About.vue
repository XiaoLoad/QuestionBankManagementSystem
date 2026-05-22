<script setup>
import avatarUrl from '@/assets/images/test.jpg'

defineOptions({ name: 'About' })

const techStack = [
  {
    name: 'Vue 3',
    desc: '渐进式 JavaScript 框架',
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    iconPath: 'M24,1.61H14.06L12,5.16,9.94,1.61H0L12,22.39ZM12,14.08,5.16,2.23H9.59L12,6.41l2.41-4.18h4.43Z',
    viewBox: '0 0 24 24',
  },
  {
    name: 'Vite',
    desc: '下一代前端构建工具',
    color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    iconPath: 'M12,1.55L3.06,18.13,4.58,18.72,12,5.4l7.42,13.32,1.52-.59ZM12,14.23,8.17,7.72H15.83Z',
    viewBox: '0 0 24 24',
  },
  {
    name: 'Node.js',
    desc: '服务端 JavaScript 运行时',
    color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    iconPath: 'M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0 l8.795-5.076c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072 c-0.081-0.047-0.189-0.047-0.271,0L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.135,0.235 l2.409,1.392c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253 v10.021c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z',
    viewBox: '0 0 24 24',
  },
  {
    name: 'Express',
    desc: '轻量级 Web 应用框架',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    iconPath: 'M24,1.61H14.06L12,5.16,9.94,1.61H0L12,22.39ZM12,14.08,5.16,2.23H9.59L12,6.41l2.41-4.18h4.43Z',
    viewBox: '0 0 24 24',
    label: 'Ex',
    useLabel: true,
  },
  {
    name: 'SQLite',
    desc: '轻量级嵌入式数据库',
    color: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    iconPath: 'M12.006,2.412c-2.17,0-4.007,0.726-5.264,1.797C5.485,5.281,4.74,6.753,4.74,8.288 c0,2.008,1.215,3.596,3.14,4.655c0.605,0.332,1.08,0.613,1.412,0.867c0.224,0.171,0.338,0.301,0.387,0.409 c0.048,0.106,0.067,0.268-0.022,0.514c-0.115,0.319-0.493,0.729-1.141,0.729c-0.283,0-0.603-0.059-0.966-0.185 c-0.637-0.221-1.361-0.618-2.088-1.237c-0.253,1.695-0.432,3.182-0.432,4.227c0,1.665,0.454,2.532,1.224,2.532 c0.55,0,1.082-0.396,1.591-1.183c0.528-0.816,1.073-1.972,1.691-3.466c0.649,1.547,1.379,2.726,2.078,3.525 c0.478,0.541,0.928,0.809,1.336,0.809c0.379,0,0.692-0.195,0.91-0.565c0.073-0.125,0.134-0.274,0.184-0.445 c0.05-0.173,0.085-0.38,0.107-0.617c0.063-0.725,0.024-1.688-0.123-2.866c-0.145-1.179-0.373-2.536-0.68-3.992 c0.647-0.753,1.228-1.613,1.703-2.537C18.241,6.526,18.5,5.18,18.5,4.015c0-1.026-0.341-1.603-0.965-1.603 c-0.343,0-0.742,0.183-1.18,0.547C15.856,3.355,15.118,3.7,14.312,3.7c-1.15,0-2.175-0.537-2.853-1.021 C10.935,2.292,11.279,2.412,12.006,2.412z',
    viewBox: '0 0 24 24',
  },
  {
    name: 'TailwindCSS',
    desc: '实用优先的 CSS 框架',
    color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    iconPath: 'M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C16.337,6.182,14.976,4.8,12.001,4.8zM6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C10.337,13.382,8.976,12,6.001,12z',
    viewBox: '0 0 24 24',
  },
  {
    name: 'Chart.js',
    desc: '数据可视化图表库',
    color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    iconPath: null,
    viewBox: '0 0 24 24',
    useRect: true,
  },
  {
    name: 'Pinia',
    desc: 'Vue 官方状态管理库',
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    iconPath: 'M13.277.002c-.079-.01-.193.024-.31.09a2.346 2.346 0 0 0-.415.311c-.301.274-.65.68-.985 1.176-.672.99-1.31 2.356-1.485 3.785-.12.977-.154 1.849-.074 2.578a5.878 5.878 0 0 1 1.956-.338c.922 0 1.804.218 2.618.613.197-.637.34-1.395.445-2.246.175-1.429-.1-2.907-.499-4.028a6.695 6.695 0 0 0-.653-1.378 2.296 2.296 0 0 0-.321-.401c-.097-.092-.199-.153-.277-.162zm-6.81 2.965a.603.603 0 0 0-.288.117l-.013.011a.863.863 0 0 0-.177.327c-.051.15-.094.344-.126.565a8.205 8.205 0 0 0-.044 1.637c.08 1.222.397 2.665 1.079 3.769.093.15.193.296.294.442.726-.776 1.567-1.385 2.488-1.768-.1-.79-.06-1.714.066-2.744.038-.31.1-.616.176-.916a6.45 6.45 0 0 0-1.692-1.08 4.575 4.575 0 0 0-1.29-.366 1.805 1.805 0 0 0-.474.006zm11.751 1.789c-.21.003-.442.022-.687.06a5.974 5.974 0 0 0-2.132.76c-.009.146-.019.291-.036.437-.11.888-.258 1.684-.475 2.364.848.468 1.614 1.13 2.267 1.94.823-.85 1.43-2.05 1.787-3.13.187-.57.304-1.1.35-1.514.022-.207.027-.38.017-.51-.01-.133-.042-.206-.04-.202a.35.35 0 0 0-.114-.072 1.516 1.516 0 0 0-.375-.1 3.42 3.42 0 0 0-.562-.033zm-6.254 3.139c-2.014 0-3.83 1.087-5.147 2.834-1.316 1.748-2.131 4.16-2.131 6.807 0 2.65.806 4.258 2.131 5.218C8.132 23.707 9.96 24 11.964 24c2.004 0 3.831-.293 5.147-1.246 1.326-.96 2.133-2.568 2.133-5.218 0-2.647-.816-5.059-2.133-6.806-1.317-1.748-3.134-2.835-5.147-2.835zm-3.297 5.209a1.282 1.282 0 0 1 .292 2.518c.115.094.177.201.164.307-.032.265-.521.424-1.09.354-.571-.07-1.007-.342-.974-.607.024-.198.302-.336.678-.364a1.282 1.282 0 0 1 .93-2.208zm6.284.22a1.282 1.282 0 0 1 .726 2.303c.437.058.757.244.757.466 0 .267-.466.483-1.04.483-.574 0-1.04-.216-1.04-.483 0-.098.063-.189.17-.265a1.282 1.282 0 0 1 .427-2.505zm-6.318.215a.822.822 0 1 0 .028 1.645.822.822 0 0 0-.028-1.645zm6.284.22a.822.822 0 1 0 .027 1.644.822.822 0 0 0-.027-1.644zm-6.543.109a.338.338 0 1 1-.023.677.338.338 0 0 1 .023-.677zm6.284.22a.339.339 0 1 1-.018 0h.018zm-3.91 1.179c.17.252.432.404.808.447.372.043.694-.05.976-.28a.145.145 0 1 1 .183.226c-.344.28-.745.394-1.192.343-.445-.051-.79-.24-1.016-.574a.145.145 0 1 1 .24-.162z',
    viewBox: '0 0 24 24',
  },
  {
    name: 'better-sqlite3',
    desc: '同步 SQLite3 驱动',
    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    iconPath: 'M12,2L4,5v6.09c0,5.05,3.41,9.76,8,10.91,4.59-1.15,8-5.86,8-10.91V5L12,2z M10.94,15.54l-3.54-3.54 1.41-1.41 2.12,2.12 4.24-4.24 1.41,1.41L10.94,15.54z',
    viewBox: '0 0 24 24',
  },
]
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-notion-text dark:text-notion-text-dark">关于</h1>
      <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-1">项目信息与技术栈</p>
    </div>

    <!-- Author -->
    <div class="card mb-6">
      <div class="flex items-center gap-5">
        <img :src="avatarUrl" alt="头像" class="flex-shrink-0 w-16 h-16 rounded-full object-cover border border-notion-border dark:border-notion-border-dark" />
        <div>
          <h2 class="text-lg font-bold text-notion-text dark:text-notion-text-dark">派大星</h2>
          <p class="text-sm text-notion-muted dark:text-notion-muted-dark mt-0.5">独立开发者</p>
        </div>
      </div>
    </div>

    <!-- Project Introduction -->
    <div class="card mb-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-9 h-9 rounded-btn bg-notion-accent/10 dark:bg-notion-accent-dark/15 flex items-center justify-center">
          <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
        </div>
        <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">项目介绍</h2>
      </div>
      <div class="space-y-3 text-sm text-notion-text dark:text-notion-text-dark leading-relaxed">
        <p>
          题库管理系统是
          <a href="https://github.com/yatori-dev/yatori-go-quesbank" target="_blank" rel="noopener" class="text-notion-accent dark:text-notion-accent-dark hover:underline">yatori-go-quesbank</a>
          自动考试答题系统的配套管理工具。基于 SQLite 数据库构建，提供可视化 Web 界面，方便对刷课题库进行维护和管理。
        </p>
        <p>
          系统与刷课软件共享同一个数据库文件，所有修改实时生效，无需手动同步。支持多数据库管理，可在不同题库之间快速切换，并支持一键部署到刷课软件的数据库目录。
        </p>
        <p>核心功能：</p>
        <ul class="list-disc list-inside space-y-1 text-notion-muted dark:text-notion-muted-dark pl-1">
          <li>仪表盘 — 数据概览、新增趋势图表、分类分布统计</li>
          <li>题目管理 — 关键词高亮搜索、多维筛选、分页、批量操作</li>
          <li>分类管理 — 科目分类的增删改查，自动关联题目</li>
          <li>数据管理 — 多数据库切换/上传、JSON 导入导出、数据库备份、题目去重</li>
          <li>部署功能 — 一键将题库复制到刷课软件数据库目录</li>
          <li>回收站 — 软删除与恢复、批量操作、永久删除</li>
          <li>AI 校验 — 接入 AI 服务对题目答案进行智能分析</li>
        </ul>
      </div>
    </div>

    <!-- Tech Stack -->
    <div class="card">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-9 h-9 rounded-btn bg-notion-accent/10 dark:bg-notion-accent-dark/15 flex items-center justify-center">
          <svg class="w-5 h-5 text-notion-accent dark:text-notion-accent-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
          </svg>
        </div>
        <h2 class="text-base font-semibold text-notion-text dark:text-notion-text-dark">技术栈</h2>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="tech in techStack"
          :key="tech.name"
          class="flex items-center gap-3.5 p-3.5 rounded-card border border-notion-border dark:border-notion-border-dark hover:border-notion-accent/30 dark:hover:border-notion-accent-dark/30 transition-colors"
        >
          <div :class="['flex-shrink-0 w-10 h-10 rounded-btn flex items-center justify-center', tech.color]">
            <svg v-if="tech.useLabel" class="w-6 h-6" :viewBox="tech.viewBox">
              <text x="2" y="18" font-size="16" font-weight="700" font-family="system-ui,sans-serif" fill="currentColor">Ex</text>
            </svg>
            <svg v-else-if="tech.useRect" class="w-6 h-6" :viewBox="tech.viewBox" fill="currentColor">
              <rect x="2" y="13" width="4" height="8" rx="1" /><rect x="8" y="9" width="4" height="12" rx="1" /><rect x="14" y="5" width="4" height="16" rx="1" /><rect x="20" y="2" width="4" height="19" rx="1" />
            </svg>
            <svg v-else class="w-6 h-6" fill="currentColor" :viewBox="tech.viewBox"><path :d="tech.iconPath" /></svg>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-notion-text dark:text-notion-text-dark">{{ tech.name }}</p>
            <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">{{ tech.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
