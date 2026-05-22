<script setup>
import { onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import AppLayout from '@/components/AppLayout.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const theme = useThemeStore()

onMounted(() => {
  theme.init()
})
</script>

<template>
  <AppLayout>
    <router-view />
  </AppLayout>
  <ToastContainer />
  <ConfirmDialog />
</template>
