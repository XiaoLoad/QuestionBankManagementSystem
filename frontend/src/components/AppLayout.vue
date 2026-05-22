<script setup>
import { ref } from 'vue'
import Sidebar from './Sidebar.vue'

const sidebarOpen = ref(false)
</script>

<template>
  <div class="h-screen flex overflow-hidden bg-notion-bg dark:bg-notion-bg-dark">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/40 z-40 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <Sidebar :open="sidebarOpen" @close="sidebarOpen = false" />

    <!-- Main content -->
    <div class="flex-1 lg:ml-64 h-screen flex flex-col overflow-hidden">
      <!-- Mobile header -->
      <header class="lg:hidden flex-shrink-0 sticky top-0 z-30 bg-notion-bg/80 dark:bg-notion-bg-dark/80 backdrop-blur-sm border-b border-notion-border dark:border-notion-border-dark px-4 py-3 flex items-center gap-3">
        <button @click="sidebarOpen = true" class="p-1.5 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <span class="text-lg font-semibold">题库管理</span>
      </header>

      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <slot />
      </main>
    </div>
  </div>
</template>
