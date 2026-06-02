import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '仪表盘' }
  },
  {
    path: '/questions',
    name: 'Questions',
    component: () => import('@/views/Questions.vue'),
    meta: { title: '题目管理' }
  },
  {
    path: '/questions/:id',
    name: 'QuestionDetail',
    component: () => import('@/views/QuestionDetail.vue'),
    meta: { title: '题目详情' }
  },
  {
    path: '/categories',
    name: 'Categories',
    component: () => import('@/views/Categories.vue'),
    meta: { title: '分类管理' }
  },
  {
    path: '/data',
    name: 'Data',
    component: () => import('@/views/DataManagement.vue'),
    meta: { title: '数据管理' }
  },
  {
    path: '/trash',
    name: 'Trash',
    component: () => import('@/views/Trash.vue'),
    meta: { title: '回收站' }
  },
  {
    path: '/quiz',
    name: 'Quiz',
    component: () => import('@/views/Quiz.vue'),
    meta: { title: '刷题' }
  },
  {
    path: '/ai-settings',
    name: 'AiSettings',
    component: () => import('@/views/AiSettings.vue'),
    meta: { title: 'AI 设置' }
  },
  {
    path: '/external',
    name: 'ExternalBanks',
    component: () => import('@/views/ExternalBanks.vue'),
    meta: { title: '题库对接' }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: { title: '关于' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面未找到' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  document.title = `${to.meta.title || '题库管理'} - 题库管理`
})

export default router
