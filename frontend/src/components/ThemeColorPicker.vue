<script setup>
import { useThemeStore } from '@/stores/theme'
import { getAllThemes } from '@/themes'

const theme = useThemeStore()
const themes = getAllThemes()
</script>

<template>
  <div>
    <h4 class="text-sm font-medium text-notion-text mb-3">主题颜色</h4>
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="t in themes"
        :key="t.id"
        @click="theme.setThemeColor(t.id)"
        class="flex flex-col items-center gap-1.5 p-2 rounded-card border-2 transition-all duration-150 hover:scale-105"
        :class="theme.themeColor === t.id
          ? 'border-notion-accent shadow-md'
          : 'border-transparent hover:border-notion-border'"
      >
        <div
          class="w-8 h-8 rounded-full shadow-sm"
          :style="{ backgroundColor: t.preview }"
        />
        <span class="text-xs text-notion-muted">{{ t.name }}</span>
      </button>
    </div>
  </div>
</template>
