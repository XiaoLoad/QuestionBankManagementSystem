<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { useQuizStore } from "@/stores/quiz";
import { useToastStore } from "@/stores/toast";
import { QUESTION_TYPES } from "@/composables/constants";
import SearchableSelect from "@/components/SearchableSelect.vue";

defineOptions({ name: "Quiz" });

const api = useApi();
const authStore = useAuthStore();
const quizStore = useQuizStore();
const toast = useToastStore();

// State: 'setup' | 'quiz' | 'result'
const state = ref(quizStore.state);
const loading = ref(false);
const resultReported = ref(quizStore.resultReported || false);

// Setup
const categories = ref([]);
const selectedCategories = ref(quizStore.setupConfig.selectedCategories || []);
const selectedTypes = ref([...quizStore.setupConfig.selectedTypes]);
const selectedMode = ref(quizStore.setupConfig.selectedMode);
const questionLimit = ref(quizStore.setupConfig.questionLimit);
const autoAdvance = ref(quizStore.setupConfig.autoAdvance);
const autoAdvanceDelay = ref(quizStore.setupConfig.autoAdvanceDelay ?? 2);
const reviewMode = ref(quizStore.setupConfig.reviewMode || false);
const shuffleOptions = ref(quizStore.setupConfig.shuffleOptions || false);

// Quiz
const navigatorRef = ref(null);
const questions = ref(quizStore.questions);
const currentIndex = ref(quizStore.currentIndex);
const userAnswer = ref(null);
const answered = ref(false);
const checkResult = ref(null);
const records = ref(quizStore.records);
const countdown = ref(0);
let autoAdvanceTimer = null;
let countdownTimer = null;

// Type counts
const typeCounts = ref({});
const typeCountsLoading = ref(false);

const currentQuestion = computed(
  () => questions.value[currentIndex.value] || null,
);
const progress = computed(() =>
  questions.value.length > 0
    ? (((currentIndex.value + 1) / questions.value.length) * 100).toFixed(0)
    : 0,
);
const correctCount = computed(
  () => records.value.filter((r) => r.correct).length,
);
const accuracy = computed(() =>
  records.value.length > 0
    ? Math.round((correctCount.value / records.value.length) * 100)
    : 0,
);
const wrongList = computed(() => records.value.filter((r) => !r.correct));

// 选项乱序（缓存同一题的打乱结果，保证返回时顺序不变）
const shuffledCache = new Map();
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const displayOptions = computed(() => {
  const q = currentQuestion.value;
  if (!q || !q.options || !["单选题", "多选题"].includes(q.type))
    return q?.options || [];
  if (!shuffleOptions.value) return q.options;
  if (!shuffledCache.has(q.id))
    shuffledCache.set(q.id, shuffleArray(q.options));
  return shuffledCache.get(q.id);
});

// 计算可选题目总数
const availableCount = computed(() => {
  if (selectedTypes.value.length === 0) {
    return typeCounts.value.total || 0;
  }
  let count = 0;
  for (const t of selectedTypes.value) {
    count += typeCounts.value.byType?.[t] || 0;
  }
  return count;
});

// 监听分类变化，加载题型数量
watch(
  selectedCategories,
  async () => {
    await loadTypeCounts();
  },
  { deep: true },
);

// 监听可选题目数变化，实时同步题目数量
watch(availableCount, (val) => {
  if (val > 0) {
    questionLimit.value = val;
  }
});

function addCategory(val) {
  if (val && !selectedCategories.value.includes(val)) {
    selectedCategories.value.push(val);
  }
}

async function loadTypeCounts() {
  typeCountsLoading.value = true;
  try {
    typeCounts.value = await api.getTypeCounts(
      selectedCategories.value.join(","),
    );
  } catch (e) {
    typeCounts.value = {};
  } finally {
    typeCountsLoading.value = false;
  }
}

onMounted(async () => {
  try {
    categories.value = await api.getCategories();
  } catch {}
  await loadTypeCounts();

  // 如果有保存的进度，恢复到对应状态
  if (quizStore.hasProgress) {
    restoreQuizState();
    // 恢复到结果页时，补报刷题结果（页面刷新场景）
    if (state.value === "result") reportResult();
  }
});

function restoreQuizState() {
  state.value = quizStore.state;
  questions.value = quizStore.questions;
  currentIndex.value = quizStore.currentIndex;
  records.value = quizStore.records;
  resultReported.value = quizStore.resultReported || false;
  selectedCategories.value = quizStore.setupConfig.selectedCategories || [];
  selectedTypes.value = [...quizStore.setupConfig.selectedTypes];
  selectedMode.value = quizStore.setupConfig.selectedMode;
  questionLimit.value = quizStore.setupConfig.questionLimit;
  autoAdvance.value = quizStore.setupConfig.autoAdvance;
  autoAdvanceDelay.value = quizStore.setupConfig.autoAdvanceDelay ?? 2;
  shuffleOptions.value = quizStore.setupConfig.shuffleOptions || false;

  // 恢复当前题的显示状态
  const rec = records.value.find((r) => r.id === currentQuestion.value?.id);
  if (rec) {
    answered.value = true;
    checkResult.value = {
      correct: rec.correct,
      correctAnswers: rec.correctAnswer,
      userAnswer: rec.userAnswer,
    };
    userAnswer.value = rec.userAnswer;
  } else {
    resetAnswer();
  }
}

// 保存进度
function saveProgress() {
  quizStore.state = state.value;
  quizStore.questions = questions.value;
  quizStore.currentIndex = currentIndex.value;
  quizStore.records = records.value;
  quizStore.resultReported = resultReported.value;
  quizStore.setupConfig = {
    selectedCategories: [...selectedCategories.value],
    selectedTypes: [...selectedTypes.value],
    selectedMode: selectedMode.value,
    questionLimit: questionLimit.value,
    autoAdvance: autoAdvance.value,
    autoAdvanceDelay: autoAdvanceDelay.value,
    reviewMode: reviewMode.value,
    shuffleOptions: shuffleOptions.value,
  };
  quizStore.saveProgress();
}

// 上报刷题结果（带去重）
function reportResult() {
  if (resultReported.value || records.value.length === 0) return;
  resultReported.value = true;
  quizStore.resultReported = true;
  quizStore.saveProgress();
  api
    .reportQuizResult({
      total: questions.value.length,
      correct: correctCount.value,
      accuracy: accuracy.value,
      wrongCount: wrongList.value.length,
      category:
        selectedCategories.value.length > 0
          ? selectedCategories.value.join(",")
          : "全部",
    })
    .catch(() => {});
}

// 监听进入结果页，自动上报
watch(state, (val) => {
  if (val === "result") reportResult();
});

// 监听关键状态变化，自动保存进度
watch(
  [state, currentIndex, records],
  () => {
    if (state.value !== "setup") {
      saveProgress();
    }
  },
  { deep: true },
);

async function startQuiz() {
  loading.value = true;
  try {
    const res = await api.getQuizQuestions({
      category: selectedCategories.value.join(","),
      type: selectedTypes.value.length > 0 ? selectedTypes.value.join(",") : "",
      mode: selectedMode.value,
      limit: questionLimit.value,
    });
    if (res.items.length === 0) {
      toast.error("该分类下没有题目");
      return;
    }
    questions.value = res.items;
    currentIndex.value = 0;
    records.value = [];
    resultReported.value = false;
    shuffledCache.clear();
    resetAnswer();
    state.value = "quiz";
    saveProgress();
  } catch (e) {
    // handled
  } finally {
    loading.value = false;
  }
}

function clearAutoAdvance() {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdown.value = 0;
}

function resetAnswer() {
  clearAutoAdvance();
  answered.value = false;
  checkResult.value = null;
  const q = currentQuestion.value;
  if (!q) return;
  if (q.type === "多选题") {
    userAnswer.value = [];
  } else {
    userAnswer.value = "";
  }
  // 复习模式：自动获取答案并显示
  if (reviewMode.value) {
    showReviewAnswer();
  }
}

async function showReviewAnswer() {
  const q = currentQuestion.value;
  if (!q) return;
  try {
    const res = await api.checkQuizAnswer(q.id, null);
    // 复习模式：直接显示正确答案，不判断对错
    checkResult.value = {
      correct: true, // 显示为正确（绿色高亮）
      correctAnswers: res.correctAnswers,
      userAnswer: res.correctAnswers, // 用户答案设为正确答案
    };
    answered.value = true;
    // 不记录到 records 中
  } catch (e) {
    // handled
  }
}

function selectOption(opt) {
  if (answered.value) return;
  const q = currentQuestion.value;
  if (q.type === "多选题") {
    const idx = userAnswer.value.indexOf(opt);
    if (idx >= 0) {
      userAnswer.value.splice(idx, 1);
    } else {
      userAnswer.value.push(opt);
    }
  } else {
    userAnswer.value = opt;
    if (autoAdvance.value || reviewMode.value) submitAndAutoAdvance();
  }
}

function selectBool(val) {
  if (answered.value) return;
  userAnswer.value = val;
  if (autoAdvance.value || reviewMode.value) submitAndAutoAdvance();
}

async function submitAndAutoAdvance() {
  await submitAnswer(true);
}

async function submitAnswer(autoAdvance = false) {
  const q = currentQuestion.value;
  if (!q) return;

  // Validate
  if (q.type === "多选题") {
    if (userAnswer.value.length === 0) {
      toast.error("请选择答案");
      return;
    }
  } else if (q.type === "填空题" || q.type === "简答题") {
    if (!userAnswer.value || !userAnswer.value.trim()) {
      toast.error("请输入答案");
      return;
    }
  } else {
    if (!userAnswer.value && userAnswer.value !== 0) {
      toast.error("请选择答案");
      return;
    }
  }

  loading.value = true;
  try {
    const res = await api.checkQuizAnswer(q.id, userAnswer.value);
    checkResult.value = res;
    answered.value = true;
    records.value.push({
      id: q.id,
      content: q.content,
      type: q.type,
      correct: res.correct,
      userAnswer: res.userAnswer,
      correctAnswer: res.correctAnswers,
    });
    saveProgress();
    if (autoAdvance && res.correct) {
      const delay = Math.max(1, autoAdvanceDelay.value);
      countdown.value = delay;
      countdownTimer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
      }, 1000);
      autoAdvanceTimer = setTimeout(() => {
        goNext();
      }, delay * 1000);
    }
  } catch (e) {
    // handled
  } finally {
    loading.value = false;
  }
}

function goNext() {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++;
    resetAnswer();
  } else {
    state.value = "result";
    saveProgress();
  }
}

function goPrev() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    // Don't allow re-answer, just view
    const rec = records.value.find((r) => r.id === currentQuestion.value?.id);
    if (rec) {
      answered.value = true;
      checkResult.value = {
        correct: rec.correct,
        correctAnswers: rec.correctAnswer,
        userAnswer: rec.userAnswer,
      };
      userAnswer.value = rec.userAnswer;
    } else {
      resetAnswer();
    }
  }
}

function jumpTo(idx) {
  currentIndex.value = idx;
  const rec = records.value.find((r) => r.id === currentQuestion.value?.id);
  if (rec) {
    answered.value = true;
    checkResult.value = {
      correct: rec.correct,
      correctAnswers: rec.correctAnswer,
      userAnswer: rec.userAnswer,
    };
    userAnswer.value = rec.userAnswer;
  } else {
    resetAnswer();
  }
}

function endQuiz() {
  if (records.value.length === 0) {
    state.value = "setup";
    quizStore.clearProgress();
    return;
  }
  state.value = "result";
  saveProgress();
  // 上报刷题结果（watcher 会自动处理）
}

function restart() {
  state.value = "setup";
  questions.value = [];
  records.value = [];
  resultReported.value = false;
  shuffledCache.clear();
  quizStore.clearProgress();
}

function retryWrong() {
  if (wrongList.value.length === 0) return;
  // Re-fetch the wrong questions
  const wrongIds = wrongList.value.map((r) => r.id);
  questions.value = questions.value.filter((q) => wrongIds.includes(q.id));
  currentIndex.value = 0;
  records.value = [];
  resultReported.value = false;
  shuffledCache.clear();
  resetAnswer();
  state.value = "quiz";
  saveProgress();
}

// 鼠标滚轮水平滚动题号导航
function onNavigatorWheel(e) {
  if (navigatorRef.value) {
    e.preventDefault();
    navigatorRef.value.scrollLeft += e.deltaY || e.deltaX;
  }
}

function isOptionSelected(opt) {
  if (Array.isArray(userAnswer.value)) return userAnswer.value.includes(opt);
  return userAnswer.value === opt;
}

function getOptionClass(opt) {
  if (!answered.value) {
    return isOptionSelected(opt)
      ? "border-notion-accent dark:border-notion-accent-dark bg-notion-accent/5 dark:bg-notion-accent-dark/10"
      : "border-notion-border dark:border-notion-border-dark hover:border-gray-300 dark:hover:border-gray-600";
  }
  const q = currentQuestion.value;
  const isCorrect = checkResult.value?.correctAnswers?.includes(opt);
  const isUserSelected = isOptionSelected(opt);
  if (isCorrect) return "border-green-400 bg-green-50 dark:bg-green-900/20";
  if (isUserSelected && !isCorrect)
    return "border-red-400 bg-red-50 dark:bg-red-900/20";
  return "border-notion-border dark:border-notion-border-dark opacity-50";
}

function getBoolClass(val) {
  if (!answered.value) {
    return userAnswer.value === val
      ? "border-notion-accent dark:border-notion-accent-dark bg-notion-accent/5 dark:bg-notion-accent-dark/10"
      : "border-notion-border dark:border-notion-border-dark hover:border-gray-300 dark:hover:border-gray-600";
  }
  const correctVal = checkResult.value?.correctAnswers?.[0];
  const normalizedCorrect =
    correctVal === "对" || correctVal === "正确" ? "对" : "错";
  const isCorrect = val === normalizedCorrect;
  const isUserSelected = userAnswer.value === val;
  if (isCorrect) return "border-green-400 bg-green-50 dark:bg-green-900/20";
  if (isUserSelected && !isCorrect)
    return "border-red-400 bg-red-50 dark:bg-red-900/20";
  return "border-notion-border dark:border-notion-border-dark opacity-50";
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex-shrink-0 mb-4 sm:mb-6">
      <h1
        class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark"
      >
        题库练习
      </h1>
      <p
        class="text-xs sm:text-sm text-notion-muted dark:text-notion-muted-dark mt-1"
      >
        选择分类，开始练习
      </p>
    </div>

    <!-- Setup -->
    <div v-if="state === 'setup'" class="card mb-10">
      <h2
        class="text-base sm:text-lg font-semibold text-notion-text dark:text-notion-text-dark mb-5 sm:mb-6"
      >
        练习设置
      </h2>

      <div class="space-y-5 sm:space-y-6">
        <!-- 出题范围 -->
        <div>
          <h3
            class="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark mb-3 sm:mb-4"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            出题范围
          </h3>
          <div class="space-y-3 sm:space-y-4 pl-0 sm:pl-5">
            <div>
              <label
                class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5"
              >
                选择分类（可多选，不选则全部）
              </label>
              <div
                v-if="selectedCategories.length > 0"
                class="flex flex-wrap gap-1.5 mb-2"
              >
                <span
                  v-for="cat in selectedCategories"
                  :key="cat"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-badge text-xs bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark"
                >
                  {{ cat }}
                  <button
                    @click="
                      selectedCategories.splice(
                        selectedCategories.indexOf(cat),
                        1,
                      )
                    "
                    class="hover:text-red-500 transition-colors"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              </div>
              <SearchableSelect
                modelValue=""
                @update:modelValue="addCategory"
                :options="
                  categories
                    .filter((c) => !selectedCategories.includes(c.name))
                    .map((c) => ({
                      label: c.name + '（' + c.question_count + '题）',
                      value: c.name,
                    }))
                "
                placeholder="搜索并添加分类..."
              />
            </div>
            <div>
              <label
                class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5"
              >
                题型（可多选，不选则全部）
                <span
                  v-if="typeCountsLoading"
                  class="text-notion-muted dark:text-notion-muted-dark ml-1"
                  >加载中...</span
                >
                <span
                  v-else-if="availableCount > 0"
                  class="text-notion-accent dark:text-notion-accent-dark ml-1"
                  >共 {{ availableCount }} 题</span
                >
              </label>
              <div class="flex flex-wrap gap-1.5 sm:gap-2">
                <button
                  v-for="t in QUESTION_TYPES"
                  :key="t"
                  type="button"
                  @click="
                    selectedTypes.includes(t)
                      ? selectedTypes.splice(selectedTypes.indexOf(t), 1)
                      : selectedTypes.push(t)
                  "
                  :class="[
                    'px-2.5 py-1.5 sm:px-3 rounded-btn text-xs font-medium border transition-colors inline-flex items-center gap-1',
                    selectedTypes.includes(t)
                      ? 'border-notion-accent dark:border-notion-accent-dark bg-notion-accent/10 dark:bg-notion-accent-dark/15 text-notion-accent dark:text-notion-accent-dark'
                      : 'border-notion-border dark:border-notion-border-dark text-notion-muted dark:text-notion-muted-dark hover:border-gray-300 dark:hover:border-gray-600',
                  ]"
                >
                  {{ t }}
                  <span
                    v-if="typeCounts.byType?.[t]"
                    class="text-[10px] opacity-70"
                    >({{ typeCounts.byType[t] }})</span
                  >
                </button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label
                  class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5"
                  >出题顺序</label
                >
                <select v-model="selectedMode" class="select-field w-full">
                  <option value="random">随机</option>
                  <option value="sequential">顺序</option>
                </select>
              </div>
              <div>
                <label
                  class="block text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-1.5"
                >
                  题目数量
                  <span
                    v-if="availableCount > 0"
                    class="text-notion-muted dark:text-notion-muted-dark"
                    >/ {{ availableCount }}</span
                  >
                </label>
                <input
                  v-model.number="questionLimit"
                  type="number"
                  min="1"
                  :max="Math.min(availableCount || 300, 300)"
                  class="input-field w-full"
                />
                <p
                  class="text-[10px] text-notion-muted dark:text-notion-muted-dark mt-1"
                >
                  最多 300 题
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 分隔线 -->
        <div
          class="border-t border-notion-border dark:border-notion-border-dark"
        ></div>

        <!-- 答题设置 -->
        <div>
          <h3
            class="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-notion-muted dark:text-notion-muted-dark mb-3 sm:mb-4"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            答题设置
          </h3>
          <div
            class="space-y-2 sm:space-y-0 sm:divide-y sm:divide-notion-border dark:sm:divide-notion-border-dark"
          >
            <!-- 自动下一题 -->
            <div
              class="flex items-start sm:items-center justify-between gap-3 py-0 sm:py-3"
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark"
                >
                  自动下一题
                </p>
                <p
                  class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5"
                >
                  答对后自动跳转，答错需手动
                </p>
              </div>
              <button
                type="button"
                @click="autoAdvance = !autoAdvance"
                :class="[
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                  autoAdvance
                    ? 'bg-notion-accent dark:bg-notion-accent-dark'
                    : 'bg-gray-200 dark:bg-gray-700',
                ]"
              >
                <span
                  :class="[
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    autoAdvance ? 'translate-x-5' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>
            <!-- 跳转延迟 -->
            <div
              v-if="autoAdvance"
              class="flex items-center gap-3 py-2 sm:py-3 pl-0 sm:pl-0"
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark"
                >
                  跳转延迟
                </p>
                <p
                  class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5"
                >
                  答对后等待时间
                </p>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <input
                  v-model.number="autoAdvanceDelay"
                  type="number"
                  min="1"
                  max="30"
                  class="input-field w-14 text-center text-xs py-1"
                />
                <span
                  class="text-xs text-notion-muted dark:text-notion-muted-dark"
                  >秒</span
                >
              </div>
            </div>
            <!-- 选项乱序 -->
            <div
              class="flex items-start sm:items-center justify-between gap-3 py-2 sm:py-3"
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark"
                >
                  选项乱序
                </p>
                <p
                  class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5"
                >
                  打乱单选/多选题的选项顺序
                </p>
              </div>
              <button
                type="button"
                @click="shuffleOptions = !shuffleOptions"
                :class="[
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                  shuffleOptions
                    ? 'bg-notion-accent dark:bg-notion-accent-dark'
                    : 'bg-gray-200 dark:bg-gray-700',
                ]"
              >
                <span
                  :class="[
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    shuffleOptions ? 'translate-x-5' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>
            <!-- 复习模式 -->
            <div
              class="flex items-start sm:items-center justify-between gap-3 py-2 sm:py-3"
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark"
                >
                  复习模式
                </p>
                <p
                  class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5"
                >
                  直接显示答案，用于复习巩固
                </p>
              </div>
              <button
                type="button"
                @click="reviewMode = !reviewMode"
                :class="[
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 sm:mt-0',
                  reviewMode
                    ? 'bg-notion-accent dark:bg-notion-accent-dark'
                    : 'bg-gray-200 dark:bg-gray-700',
                ]"
              >
                <span
                  :class="[
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    reviewMode ? 'translate-x-5' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- 分隔线 -->
        <div
          class="border-t border-notion-border dark:border-notion-border-dark"
        ></div>

        <!-- 开始按钮 -->
        <button
          @click="startQuiz"
          :disabled="loading || availableCount === 0"
          class="btn-primary w-full justify-center py-3 text-sm sm:text-base"
        >
          {{
            loading
              ? "加载中..."
              : availableCount === 0
                ? "该分类下没有题目"
                : "开始练习"
          }}
        </button>
      </div>
    </div>

    <!-- Quiz -->
    <template v-if="state === 'quiz' && currentQuestion">
      <!-- Progress bar -->
      <div class="flex-shrink-0 mb-3 sm:mb-4">
        <div
          class="flex items-center justify-between text-xs text-notion-muted dark:text-notion-muted-dark mb-1.5"
        >
          <span>{{ currentIndex + 1 }} / {{ questions.length }}</span>
          <span
            >正确 {{ correctCount }} / 已答 {{ records.length }} ({{
              accuracy
            }}%)</span
          >
        </div>
        <div
          class="w-full h-1.5 sm:h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"
        >
          <div
            class="h-full bg-notion-accent dark:bg-notion-accent-dark rounded-full transition-all duration-300"
            :style="{ width: progress + '%' }"
          />
        </div>
      </div>

      <!-- Question card -->
      <div class="card flex-1 min-h-0 flex flex-col overflow-hidden p-3 sm:p-6">
        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto pr-1">
          <div class="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <span class="badge badge-type text-xs">{{
              currentQuestion.type
            }}</span>
            <span class="badge badge-category text-xs">{{
              currentQuestion.category
            }}</span>
          </div>

          <p
            class="text-sm sm:text-base text-notion-text dark:text-notion-text-dark leading-relaxed whitespace-pre-wrap mb-3 sm:mb-4"
          >
            {{ currentQuestion.content }}
          </p>

          <!-- Images -->
          <div
            v-if="currentQuestion.images && currentQuestion.images.length > 0"
            class="mb-3 sm:mb-4"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <img
                v-for="(url, i) in currentQuestion.images"
                :key="i"
                :src="url"
                class="max-w-full rounded-btn border border-notion-border dark:border-notion-border-dark"
                loading="lazy"
                @error="(e) => (e.target.style.display = 'none')"
              />
            </div>
          </div>

          <!-- Options: 单选 / 多选 -->
          <div
            v-if="
              ['单选题', '多选题'].includes(currentQuestion.type) &&
              displayOptions.length
            "
            class="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4"
          >
            <button
              v-for="(opt, i) in displayOptions"
              :key="opt"
              @click="!reviewMode && selectOption(opt)"
              :class="[
                'w-full text-left px-3 sm:px-4 py-3 sm:py-3 rounded-btn border-2 transition-all text-sm min-h-[44px]',
                reviewMode
                  ? getOptionClass(opt) + ' cursor-default'
                  : getOptionClass(opt),
              ]"
            >
              <span
                class="font-medium mr-2 text-notion-muted dark:text-notion-muted-dark"
                >{{ String.fromCharCode(65 + i) }}.</span
              >
              <span class="break-words">{{ opt }}</span>
            </button>
          </div>

          <!-- 判断题 -->
          <div
            v-if="currentQuestion.type === '判断题'"
            class="flex gap-3 sm:gap-4 mb-3 sm:mb-4"
          >
            <button
              @click="selectBool('对')"
              :class="[
                'flex-1 py-5 sm:py-4 rounded-btn border-2 text-base font-medium text-center transition-all min-h-[56px]',
                getBoolClass('对'),
              ]"
            >
              对
            </button>
            <button
              @click="selectBool('错')"
              :class="[
                'flex-1 py-5 sm:py-4 rounded-btn border-2 text-base font-medium text-center transition-all min-h-[56px]',
                getBoolClass('错'),
              ]"
            >
              错
            </button>
          </div>

          <!-- 填空 / 简答 -->
          <div
            v-if="['填空题', '简答题'].includes(currentQuestion.type)"
            class="mb-3 sm:mb-4"
          >
            <!-- 复习模式：直接显示答案 -->
            <div
              v-if="reviewMode && answered && checkResult"
              class="p-3 sm:p-4 rounded-btn bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            >
              <p
                class="text-xs text-green-600 dark:text-green-400 font-medium mb-2"
              >
                正确答案：
              </p>
              <p
                class="text-sm sm:text-base text-notion-text dark:text-notion-text-dark"
              >
                {{ checkResult.correctAnswers?.join("、") }}
              </p>
            </div>
            <!-- 答题模式：输入框 -->
            <textarea
              v-else
              v-model="userAnswer"
              rows="3"
              class="input-field w-full text-sm sm:text-base"
              placeholder="请输入你的答案..."
              :disabled="answered"
            />
          </div>

          <!-- Answer feedback (非填空/简答题的复习模式，或答题模式) -->
          <div
            v-if="
              answered &&
              checkResult &&
              !(
                reviewMode &&
                ['填空题', '简答题'].includes(currentQuestion.type)
              )
            "
            class="mb-3 sm:mb-4 p-3 sm:p-4 rounded-btn"
            :class="
              checkResult.correct
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            "
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                v-if="checkResult.correct"
                class="text-green-600 dark:text-green-400 font-medium text-sm"
                >回答正确</span
              >
              <span
                v-else
                class="text-red-600 dark:text-red-400 font-medium text-sm"
                >回答错误</span
              >
            </div>
            <div
              v-if="!checkResult.correct"
              class="text-xs sm:text-sm text-notion-text dark:text-notion-text-dark"
            >
              正确答案：<span
                class="font-medium text-green-600 dark:text-green-400"
                >{{ checkResult.correctAnswers?.join("、") }}</span
              >
            </div>
            <div
              v-if="countdown > 0"
              class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1"
            >
              {{ countdown }} 秒后自动下一题
            </div>
          </div>
        </div>

        <!-- Actions (fixed at bottom) -->
        <div
          class="flex-shrink-0 flex items-center justify-between pt-3 sm:pt-4 border-t border-notion-border dark:border-notion-border-dark gap-2"
        >
          <button
            @click="goPrev"
            :disabled="currentIndex === 0"
            class="btn-secondary py-2.5 px-4"
            :class="currentIndex === 0 ? 'opacity-50' : ''"
          >
            上一题
          </button>
          <template v-if="!answered">
            <button
              v-if="
                (!autoAdvance && !reviewMode) ||
                ['多选题', '填空题', '简答题'].includes(currentQuestion.type)
              "
              @click="submitAnswer()"
              :disabled="loading"
              class="btn-primary py-2.5 px-4"
            >
              {{ loading ? "提交中..." : "提交答案" }}
            </button>
            <span
              v-else
              class="text-xs text-notion-muted dark:text-notion-muted-dark"
              >{{
                reviewMode ? "复习模式：选择后显示答案" : "选择后自动判题"
              }}</span
            >
          </template>
          <button v-else @click="goNext" class="btn-primary py-2.5 px-4">
            {{ currentIndex < questions.length - 1 ? "下一题" : "查看结果" }}
          </button>
        </div>
      </div>

      <!-- Bottom: question navigator + end button -->
      <div class="flex-shrink-0 mt-3 sm:mt-4 flex items-center gap-2 sm:gap-3">
        <button
          @click="endQuiz"
          class="btn-danger text-xs py-2 px-3 flex-shrink-0"
        >
          结束
        </button>
        <div
          ref="navigatorRef"
          class="flex-1 overflow-x-auto scrollbar-hide"
          @wheel.prevent="onNavigatorWheel"
        >
          <div class="flex gap-1 sm:gap-1.5">
            <button
              v-for="(q, i) in questions"
              :key="q.id"
              @click="jumpTo(i)"
              class="w-7 h-7 sm:w-8 sm:h-8 rounded text-xs font-medium flex-shrink-0 transition-colors"
              :class="
                i === currentIndex
                  ? 'bg-notion-accent text-white'
                  : records.find((r) => r.id === q.id)
                    ? records.find((r) => r.id === q.id).correct
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-notion-muted dark:text-notion-muted-dark'
              "
            >
              {{ i + 1 }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Result -->
    <div v-if="state === 'result'" class="card max-w-2xl">
      <h2
        class="text-base sm:text-lg font-semibold text-notion-text dark:text-notion-text-dark mb-4 sm:mb-6"
      >
        练习结果
      </h2>

      <div class="grid grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div
          class="text-center p-3 sm:p-4 rounded-btn bg-notion-surface dark:bg-notion-surface-dark"
        >
          <p
            class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark"
          >
            {{ questions.length }}
          </p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">
            总题数
          </p>
        </div>
        <div
          class="text-center p-3 sm:p-4 rounded-btn bg-green-50 dark:bg-green-900/20"
        >
          <p
            class="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400"
          >
            {{ correctCount }}
          </p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">
            正确
          </p>
        </div>
        <div
          class="text-center p-3 sm:p-4 rounded-btn"
          :class="
            accuracy >= 60
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-red-50 dark:bg-red-900/20'
          "
        >
          <p
            class="text-xl sm:text-2xl font-bold"
            :class="
              accuracy >= 60
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            "
          >
            {{ accuracy }}%
          </p>
          <p class="text-xs text-notion-muted dark:text-notion-muted-dark">
            正确率
          </p>
        </div>
      </div>

      <!-- Wrong list -->
      <div v-if="wrongList.length > 0" class="mb-4 sm:mb-6">
        <h3
          class="text-xs sm:text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2 sm:mb-3"
        >
          错题列表（{{ wrongList.length }} 题）
        </h3>
        <div class="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto">
          <div
            v-for="(r, i) in wrongList"
            :key="i"
            class="p-2.5 sm:p-3 rounded-btn bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
          >
            <div class="flex items-center gap-1.5 sm:gap-2 mb-1">
              <span class="badge badge-type text-xs">{{ r.type }}</span>
            </div>
            <p
              class="text-xs sm:text-sm text-notion-text dark:text-notion-text-dark line-clamp-2"
            >
              {{ r.content }}
            </p>
            <div class="text-xs mt-1">
              <span class="text-red-500"
                >你的：{{
                  Array.isArray(r.userAnswer)
                    ? r.userAnswer.join("、")
                    : r.userAnswer
                }}</span
              >
              <span class="text-green-500 ml-2 sm:ml-3"
                >正确：{{ r.correctAnswer?.join("、") }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-2 sm:gap-3">
        <button @click="restart" class="btn-secondary flex-1 py-2.5">
          返回设置
        </button>
        <button
          v-if="wrongList.length > 0"
          @click="retryWrong"
          class="btn-primary flex-1 py-2.5"
        >
          错题重练 ({{ wrongList.length }})
        </button>
      </div>
    </div>
  </div>
</template>
