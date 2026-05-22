<script setup>
import { useRouter } from 'vue-router'

defineOptions({ name: 'NotFound' })

const router = useRouter()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20">
    <svg class="w-20 h-20 text-notion-muted/40 dark:text-notion-muted-dark/40 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    <h1 class="text-3xl font-bold text-notion-text dark:text-notion-text-dark mb-2">404</h1>
    <p class="text-notion-muted dark:text-notion-muted-dark mb-6">页面不存在</p>
    <button @click="router.push('/')" class="btn-primary">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
      </svg>
      返回首页
    </button>
  </div>
</template>
