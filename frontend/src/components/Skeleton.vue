<script setup>
defineOptions({ name: 'Skeleton' })

// width / height 传空字符串时不写内联样式，交由外部 class 控制尺寸
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
      width: circle ? height : width || undefined,
      height: height || undefined,
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
        height: height || undefined,
        borderRadius: rounded,
      }"
    />
  </div>
</template>