<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { QUESTION_TYPES } from '@/composables/constants'

const props = defineProps({
  question: { type: Object, default: null },
  categories: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'submit'])

const form = reactive({
  type: '',
  content: '',
  options: '',
  answers: '',
  category: '默认',
  images: [],
})

const newImageUrl = ref('')

const isEdit = computed(() => !!props.question)

onMounted(() => {
  if (props.question) {
    form.type = props.question.type || ''
    form.content = props.question.content || ''
    form.options = Array.isArray(props.question.options) ? props.question.options.join('\n') : (props.question.options || '')
    form.answers = Array.isArray(props.question.answers) ? props.question.answers.join('\n') : (props.question.answers || '')
    form.category = props.question.category || '默认'
    form.images = Array.isArray(props.question.images) ? [...props.question.images] : []
  }
})

const needsOptions = computed(() => ['单选题', '多选题'].includes(form.type))
const needsAnswers = computed(() => form.type !== '')

function addImageUrl() {
  const url = newImageUrl.value.trim()
  if (!url) return
  if (!/^https?:\/\/.+/.test(url)) return
  form.images.push(url)
  newImageUrl.value = ''
}

function removeImage(index) {
  form.images.splice(index, 1)
}

function handleSubmit() {
  if (!form.type || !form.content.trim()) return

  const data = {
    type: form.type,
    content: form.content.trim(),
    category: form.category || '默认',
  }

  if (needsOptions.value && form.options.trim()) {
    data.options = form.options.split('\n').map(s => s.trim()).filter(Boolean)
  } else {
    data.options = null
  }

  if (needsAnswers.value && form.answers.trim()) {
    data.answers = form.answers.split('\n').map(s => s.trim()).filter(Boolean)
  } else {
    data.answers = null
  }

  data.images = form.images.length > 0 ? form.images : null

  emit('submit', data)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9997] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
      <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-notion-border dark:border-notion-border-dark flex items-center justify-between">
          <h2 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark">
            {{ isEdit ? '编辑题目' : '添加题目' }}
          </h2>
          <button @click="emit('close')" class="p-1 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg class="w-5 h-5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
          <!-- Type -->
          <div>
            <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">题型 <span class="text-red-500">*</span></label>
            <select v-model="form.type" class="select-field w-full" required>
              <option value="" disabled>请选择题型</option>
              <option v-for="t in QUESTION_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <!-- Content -->
          <div>
            <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">题目内容 <span class="text-red-500">*</span></label>
            <textarea v-model="form.content" rows="4" class="input-field resize-y" placeholder="请输入题目内容..." required />
          </div>

          <!-- Options -->
          <div v-if="needsOptions">
            <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">
              选项 <span class="text-xs text-notion-muted dark:text-notion-muted-dark font-normal">（每行一个选项）</span>
            </label>
            <textarea v-model="form.options" rows="4" class="input-field resize-y" placeholder="A. 选项一&#10;B. 选项二&#10;C. 选项三&#10;D. 选项四" />
          </div>

          <!-- Answers -->
          <div v-if="needsAnswers">
            <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">
              答案 <span class="text-xs text-notion-muted dark:text-notion-muted-dark font-normal">（每行一个答案）</span>
            </label>
            <textarea v-model="form.answers" rows="2" class="input-field resize-y" :placeholder="form.type === '判断题' ? '正确 或 错误' : '请输入答案...'" />
          </div>

          <!-- Category -->
          <div>
            <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">分类</label>
            <select v-model="form.category" class="select-field w-full">
              <option v-for="c in categories" :key="c.id" :value="c.name">{{ c.name }}</option>
            </select>
          </div>

          <!-- Images -->
          <div>
            <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5">题目图片</label>
            <div v-if="form.images.length > 0" class="space-y-2 mb-3">
              <div v-for="(url, i) in form.images" :key="i" class="flex items-center gap-2">
                <img :src="url" class="w-16 h-12 object-cover rounded border border-notion-border dark:border-notion-border-dark flex-shrink-0" @error="(e) => e.target.style.display='none'" />
                <span class="flex-1 text-xs text-notion-muted dark:text-notion-muted-dark truncate">{{ url }}</span>
                <button type="button" @click="removeImage(i)" class="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-notion-muted hover:text-red-500 transition-colors flex-shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="flex gap-2">
              <input
                v-model="newImageUrl"
                type="text"
                class="input-field flex-1"
                placeholder="输入图片 URL..."
                @keyup.enter.prevent="addImageUrl"
              />
              <button type="button" @click="addImageUrl" class="btn-secondary flex-shrink-0">添加</button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" @click="emit('close')" class="btn-secondary">取消</button>
            <button type="submit" class="btn-primary">{{ isEdit ? '更新' : '添加' }}</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
