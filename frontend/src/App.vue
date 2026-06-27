<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useAiTaskStore } from '@/stores/aiTask'
import AppLayout from '@/components/AppLayout.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AiProgressBall from '@/components/AiProgressBall.vue'

const theme = useThemeStore()
const router = useRouter()
const aiTask = useAiTaskStore()

onMounted(() => {
  theme.init()
})

// 点击悬浮球
const handleBallClick = () => {
  // 跳转到题目详情页
  if (aiTask.task?.questionId) {
    router.push(`/questions/${aiTask.task.questionId}`)
  }
}
</script>

<template>
  <AppLayout>
    <router-view v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <KeepAlive :include="['Questions', 'Categories', 'Quiz']">
          <component :is="Component" />
        </KeepAlive>
      </Transition>
    </router-view>
  </AppLayout>
  <ToastContainer />
  <ConfirmDialog />
  <AiProgressBall @click="handleBallClick" />
</template>
