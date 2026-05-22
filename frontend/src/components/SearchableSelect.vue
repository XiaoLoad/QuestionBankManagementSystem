<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  allLabel: { type: String, default: '' },
  labelField: { type: String, default: 'label' },
  valueField: { type: String, default: 'value' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const search = ref('')
const containerRef = ref(null)
const inputRef = ref(null)

const allOptions = computed(() => {
  const list = []
  if (props.allLabel) {
    list.push({ label: props.allLabel, value: '' })
  }
  for (const opt of props.options) {
    if (typeof opt === 'string') {
      list.push({ label: opt, value: opt })
    } else {
      list.push({ label: opt[props.labelField] || opt.label || opt.value, value: opt[props.valueField] || opt.value || '' })
    }
  }
  return list
})

const filteredOptions = computed(() => {
  if (!search.value.trim()) return allOptions.value
  const q = search.value.trim().toLowerCase()
  return allOptions.value.filter(opt => opt.label.toLowerCase().includes(q))
})

const selectedLabel = computed(() => {
  const found = allOptions.value.find(opt => opt.value === props.modelValue)
  return found ? found.label : ''
})

function select(opt) {
  emit('update:modelValue', opt.value)
  open.value = false
  search.value = ''
}

function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    search.value = ''
    nextTick(() => inputRef.value?.focus())
  }
}

function onClickOutside(e) {
  if (containerRef.value && !containerRef.value.contains(e.target)) {
    open.value = false
    search.value = ''
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="containerRef" class="relative">
    <button
      type="button"
      @click="toggle"
      :disabled="disabled"
      class="select-field w-full text-left flex items-center justify-between gap-1"
      :class="disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'"
    >
      <span class="truncate" :class="selectedLabel ? '' : 'text-notion-muted dark:text-notion-muted-dark'">
        {{ selectedLabel || placeholder }}
      </span>
      <svg class="w-3.5 h-3.5 flex-shrink-0 text-notion-muted dark:text-notion-muted-dark transition-transform" :class="open ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="open" class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-card shadow-lg border border-notion-border dark:border-notion-border-dark overflow-hidden">
        <div class="p-2 border-b border-notion-border dark:border-notion-border-dark">
          <input
            ref="inputRef"
            v-model="search"
            type="text"
            class="input-field text-xs py-1.5"
            placeholder="搜索分类..."
          />
        </div>
        <div class="max-h-48 overflow-y-auto">
          <div
            v-for="opt in filteredOptions"
            :key="opt.value"
            @click="select(opt)"
            class="px-3 py-2 text-xs cursor-pointer transition-colors flex items-center justify-between"
            :class="opt.value === modelValue
              ? 'bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark'
              : 'text-notion-text dark:text-notion-text-dark hover:bg-gray-50 dark:hover:bg-gray-700/50'"
          >
            <span class="truncate">{{ opt.label }}</span>
            <svg v-if="opt.value === modelValue" class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div v-if="filteredOptions.length === 0" class="px-3 py-4 text-xs text-notion-muted dark:text-notion-muted-dark text-center">
            无匹配项
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
