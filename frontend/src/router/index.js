import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', requiresAuth: false, hideBanner: true }
  },
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
    meta: { title: '题目详情', hideBanner: true }
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
    meta: { title: '数据管理', requiresAdmin: true }
  },
  {
    path: '/trash',
    name: 'Trash',
    component: () => import('@/views/Trash.vue'),
    meta: { title: '回收站', requiresAdmin: true }
  },
  {
    path: '/quiz',
    name: 'Quiz',
    component: () => import('@/views/Quiz.vue'),
    meta: { title: '题库练习' }
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
    meta: { title: '题库对接', requiresAdmin: true }
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/UserManagement.vue'),
    meta: { title: '用户管理', requiresAdmin: true }
  },
  {
    path: '/users/:id/logs',
    name: 'UserActivityLog',
    component: () => import('@/views/UserActivityLog.vue'),
    meta: { title: '用户活动日志', requiresAdmin: true, hideBanner: true }
  },
  {
    path: '/site-settings',
    name: 'SiteSettings',
    component: () => import('@/views/SiteSettings.vue'),
    meta: { title: '网站设置', requiresAdmin: true }
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
    meta: { title: '页面未找到', requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '题库管理'} - 题库管理`

  const authStore = useAuthStore()

  // 登录页不需要认证
  if (to.path === '/login') {
    if (authStore.isLoggedIn) {
      return next('/')  // 已登录则跳转首页
    }
    return next()
  }

  // 不需要认证的页面
  if (to.meta.requiresAuth === false) {
    return next()
  }

  // 检查是否有 token
  if (!authStore.isLoggedIn) {
    return next('/login')
  }

  // 检查管理员路由
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next('/quiz')  // 非管理员跳转到刷题页
  }

  next()
})

export default router
