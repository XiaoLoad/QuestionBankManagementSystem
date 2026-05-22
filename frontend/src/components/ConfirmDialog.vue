<script setup>
import { useConfirmStore } from '@/stores/confirm'

const confirm = useConfirmStore()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="confirm.visible" class="fixed inset-0 z-[9998] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="confirm.cancel" />
        <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark max-w-md w-full p-6">
          <h3 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark mb-2">{{ confirm.title }}</h3>
          <p class="text-sm text-notion-muted dark:text-notion-muted-dark mb-6">{{ confirm.message }}</p>
          <div class="flex justify-end gap-3">
            <button @click="confirm.cancel" class="btn-secondary">{{ confirm.cancelText }}</button>
            <button @click="confirm.confirm" :class="confirm.danger ? 'btn-danger' : 'btn-primary'">
              {{ confirm.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
