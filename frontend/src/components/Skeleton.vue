<script setup>
defineOptions({ name: 'Skeleton' })

defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '16px' },
  rounded: { type: String, default: '6px' },
  circle: { type: Boolean, default: false },
  lines: { type: Number, default: 0 },
  enhanced: { type: Boolean, default: false },
})
</script>

<template>
  <!-- 单个骨架块 -->
  <div
    v-if="lines === 0"
    :class="['skeleton', { 'skeleton-enhanced': enhanced }]"
    :style="{
      width: circle ? height : width,
      height: height,
      borderRadius: circle ? '50%' : rounded,
    }"
  />
  <!-- 多行骨架 -->
  <div v-else class="space-y-2.5">
    <div
      v-for="i in lines"
      :key="i"
      :class="['skeleton', { 'skeleton-enhanced': enhanced }]"
      :style="{
        width: i === lines ? '60%' : '100%',
        height: height,
        borderRadius: rounded,
      }"
    />
  </div>
</template>
