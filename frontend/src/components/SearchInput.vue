<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索题目内容...' },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="relative">
    <input
      :value="modelValue"
      @input="emit('update:modelValue', $event.target.value)"
      type="text"
      :placeholder="placeholder"
      class="input-field pr-8"
    />
    <button
      v-if="modelValue"
      @click="emit('update:modelValue', '')"
      class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title="清除"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>
</template>
