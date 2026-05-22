<script setup>
import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { normalizeAnswer } from '@/composables/utils'

const props = defineProps({
  duplicates: { type: Array, default: () => [] },
  conflicts: { type: Array, default: () => [] },
  importSummary: { type: Object, default: () => ({ imported: 0, skipped: 0 }) },
})
const emit = defineEmits(['close', 'resolved'])
const api = useApi()
const toast = useToastStore()
const conflictSelections = ref({})
const resolving = ref(false)
const aiResults = ref({})
const aiLoading = ref({})
const aiErrors = ref({})
const batchAiLoading = ref(false)

const allConflictsSelected = computed(() =>
  props.conflicts.length > 0 && props.conflicts.every((_, i) => conflictSelections.value[i])
)
function toggleAllConflicts() {
  const v = !allConflictsSelected.value
  const s = {}; props.conflicts.forEach((_, i) => { s[i] = v }); conflictSelections.value = s
}
function toggleConflict(i) { conflictSelections.value = { ...conflictSelections.value, [i]: !conflictSelections.value[i] } }
const selectedConflictCount = computed(() => Object.values(conflictSelections.value).filter(Boolean).length)

function getAiMatchType(c, ai) {
  if (!ai?.length) return null
  const opts = c.options || []
  const a = JSON.stringify([...normalizeAnswer(ai, opts)].sort())
  if (a === JSON.stringify([...normalizeAnswer(c.existingAnswers, opts)].sort())) return 'existing'
  if (a === JSON.stringify([...normalizeAnswer(c.importedAnswers, opts)].sort())) return 'imported'
  return 'different'
}
async function analyzeSingleConflict(i) {
  const c = props.conflicts[i]; if (!c) return
  aiLoading.value = { ...aiLoading.value, [i]: true }; aiErrors.value = { ...aiErrors.value, [i]: '' }
  try { aiResults.value = { ...aiResults.value, [i]: await api.analyzeQuestion({ type: c.type, content: c.content, options: c.options || [] }) } }
  catch (e) { aiErrors.value = { ...aiErrors.value, [i]: e.data?.error || 'AI 分析失败' } }
  finally { aiLoading.value = { ...aiLoading.value, [i]: false } }
}
async function analyzeAllConflicts() {
  batchAiLoading.value = true
  for (let i = 0; i < props.conflicts.length; i++) if (!aiResults.value[i] && !aiLoading.value[i]) await analyzeSingleConflict(i)
  batchAiLoading.value = false
}
async function resolveOverwriteAll() {
  resolving.value = true
  try { const r = await api.resolveImportConflicts(props.conflicts.map(c => ({ type: c.type, content: c.content, answers: c.importedAnswers, category: c.importedCategory }))); toast.success(r.message); emit('resolved') }
  catch (e) {} finally { resolving.value = false }
}
function resolveSkipAll() { toast.info(`已跳过 ${props.conflicts.length} 条答案冲突`); emit('resolved') }
async function resolveSelected() {
  const sel = props.conflicts.filter((_, i) => conflictSelections.value[i])
  if (!sel.length) { toast.error('请至少勾选一条'); return }
  resolving.value = true
  try { const r = await api.resolveImportConflicts(sel.map(c => ({ type: c.type, content: c.content, answers: c.importedAnswers, category: c.importedCategory }))); toast.success(r.message); emit('resolved') }
  catch (e) {} finally { resolving.value = false }
}
function getDialogTitle() {
  const p = []; if (props.conflicts.length) p.push(`${props.conflicts.length} 条答案冲突`); if (props.duplicates.length) p.push(`${props.duplicates.length} 条重复`); return `导入完成 · ${p.join(' · ')}`
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9997] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50" />
      <div class="relative bg-white dark:bg-gray-800 rounded-card shadow-xl border border-notion-border dark:border-notion-border-dark max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div class="flex-shrink-0 px-6 py-4 border-b border-notion-border dark:border-notion-border-dark">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark flex items-center gap-2">
                <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                {{ getDialogTitle() }}
              </h2>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1">
                成功导入 {{ importSummary.imported }} 条
                <span v-if="duplicates.length"> · {{ duplicates.length }} 条重复已跳过</span>
                <span v-if="conflicts.length"> · 以下 {{ conflicts.length }} 条答案不同，请处理</span>
              </p>
            </div>
            <button @click="emit('close')" class="p-1 rounded-btn hover:bg-gray-100 dark:hover:bg-gray-700"><svg class="w-5 h-5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>
          <div v-if="conflicts.length" class="mt-3 flex items-center gap-2">
            <input type="checkbox" :checked="allConflictsSelected" @change="toggleAllConflicts" class="rounded accent-notion-accent dark:accent-notion-accent-dark" />
            <span class="text-xs text-notion-muted dark:text-notion-muted-dark">{{ allConflictsSelected ? '取消全选冲突' : '全选冲突' }}<span v-if="selectedConflictCount" class="text-notion-accent dark:text-notion-accent-dark ml-1">（已选 {{ selectedConflictCount }} 条）</span></span>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div v-if="duplicates.length">
            <h3 class="text-sm font-medium text-notion-text dark:text-notion-text-dark mb-3">重复题目（{{ duplicates.length }} 条，已跳过）</h3>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div v-for="(d, i) in duplicates" :key="'d'+i" class="border border-gray-200 dark:border-gray-700 rounded-card p-3 bg-gray-50/50 dark:bg-gray-700/20">
                <div class="flex items-center gap-2 mb-1"><span class="badge badge-type">{{ d.type }}</span><span class="badge badge-category">{{ d.category }}</span></div>
                <p class="text-sm text-notion-muted dark:text-notion-muted-dark break-words">{{ d.content }}</p>
              </div>
            </div>
          </div>
          <div v-if="duplicates.length && conflicts.length" class="border-t border-notion-border dark:border-notion-border-dark" />
          <div v-if="conflicts.length">
            <div class="flex items-center gap-2 mb-3">
              <h3 class="text-sm font-medium text-notion-text dark:text-notion-text-dark">答案冲突（{{ conflicts.length }} 条）</h3>
              <button @click="analyzeAllConflicts" :disabled="batchAiLoading" class="ml-auto btn-secondary text-xs py-1 px-2.5">{{ batchAiLoading ? 'AI 分析中...' : '全部 AI 分析' }}</button>
            </div>
            <div class="space-y-4">
              <div v-for="(c, i) in conflicts" :key="'c'+i" class="border border-notion-border dark:border-notion-border-dark rounded-card p-4" :class="conflictSelections[i] ? 'bg-notion-accent/5 dark:bg-notion-accent-dark/10 border-notion-accent/30 dark:border-notion-accent-dark/30' : ''">
                <div class="flex items-start gap-3 mb-3">
                  <input type="checkbox" :checked="conflictSelections[i]" @change="toggleConflict(i)" class="mt-1 rounded accent-notion-accent dark:accent-notion-accent-dark" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1"><span class="badge badge-type">{{ c.type }}</span><span class="badge badge-category">{{ c.importedCategory }}</span></div>
                    <p class="text-sm text-notion-text dark:text-notion-text-dark break-words">{{ c.content }}</p>
                  </div>
                  <button @click="analyzeSingleConflict(i)" :disabled="aiLoading[i]" class="flex-shrink-0 btn-secondary text-xs py-1 px-2">{{ aiLoading[i] ? '分析中' : 'AI 分析' }}</button>
                </div>
                <div v-if="c.options?.length" class="ml-7 mb-3">
                  <div class="rounded-btn bg-gray-50 dark:bg-gray-700/40 p-3">
                    <div class="grid grid-cols-2 gap-1">
                      <div v-for="(opt, oi) in c.options" :key="oi" class="text-xs px-2 py-1 rounded flex items-center gap-1.5" :class="(c.existingAnswers||[]).includes(opt) && !(c.importedAnswers||[]).includes(opt) ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : (c.importedAnswers||[]).includes(opt) && !(c.existingAnswers||[]).includes(opt) ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : (c.existingAnswers||[]).includes(opt) && (c.importedAnswers||[]).includes(opt) ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''">
                        <span>{{ opt }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3 ml-7">
                  <div class="rounded-btn bg-red-50 dark:bg-red-900/20 p-3"><div class="text-xs font-medium text-red-600 dark:text-red-400 mb-1.5">当前题库答案</div><p v-for="a in (c.existingAnswers||['（无答案）'])" :key="a" class="text-sm text-notion-text dark:text-notion-text-dark">{{ a }}</p></div>
                  <div class="rounded-btn bg-green-50 dark:bg-green-900/20 p-3"><div class="text-xs font-medium text-green-600 dark:text-green-400 mb-1.5">导入数据答案</div><p v-for="a in (c.importedAnswers||['（无答案）'])" :key="a" class="text-sm text-notion-text dark:text-notion-text-dark">{{ a }}</p></div>
                </div>
                <div v-if="aiErrors[i]" class="ml-7 mt-2 text-xs text-red-500">{{ aiErrors[i] }}</div>
                <div v-if="aiResults[i]" class="ml-7 mt-3 rounded-btn border p-3" :class="{'bg-green-50/70 dark:bg-green-900/15 border-green-200 dark:border-green-800': getAiMatchType(c, aiResults[i].answer)==='imported', 'bg-red-50/70 dark:bg-red-900/15 border-red-200 dark:border-red-800': getAiMatchType(c, aiResults[i].answer)==='existing', 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800': getAiMatchType(c, aiResults[i].answer)==='different'}">
                  <div class="flex items-center gap-2 mb-2"><span class="text-xs font-semibold">AI 判断</span><span class="text-[10px] text-notion-muted">{{ aiResults[i].provider }} · {{ aiResults[i].model }}</span><span v-if="getAiMatchType(c,aiResults[i].answer)==='existing'" class="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">与现有答案一致</span><span v-else-if="getAiMatchType(c,aiResults[i].answer)==='imported'" class="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">与导入答案一致</span><span v-else class="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">AI 独立判断</span></div>
                  <div class="flex flex-wrap gap-1.5 mb-1"><span v-for="a in aiResults[i].answer" :key="a" class="text-xs px-2 py-0.5 rounded bg-white dark:bg-gray-700 border text-notion-text dark:text-notion-text-dark">{{ a }}</span></div>
                  <p v-if="aiResults[i].analysis" class="text-xs text-notion-muted dark:text-notion-muted-dark">{{ aiResults[i].analysis }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex-shrink-0 px-6 py-4 border-t border-notion-border dark:border-notion-border-dark flex flex-wrap items-center justify-between gap-3">
          <button @click="emit('close')" class="btn-secondary text-sm">关闭</button>
          <div v-if="conflicts.length" class="flex items-center gap-2">
            <button @click="analyzeAllConflicts" :disabled="batchAiLoading" class="btn-secondary text-sm">{{ batchAiLoading ? 'AI 分析中...' : '全部 AI 分析' }}</button>
            <button @click="resolveSkipAll" class="btn-secondary text-sm">全部跳过</button>
            <button @click="resolveSelected" :disabled="resolving || !selectedConflictCount" class="btn-primary text-sm">覆盖选中{{ selectedConflictCount ? `（${selectedConflictCount}）` : '' }}</button>
            <button @click="resolveOverwriteAll" :disabled="resolving" class="btn-danger text-sm">全部覆盖</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>