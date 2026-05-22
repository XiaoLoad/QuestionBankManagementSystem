import { computed } from 'vue'

/**
 * Composable for pagination logic shared across list views.
 * @param {function} getPage - getter for current page (e.g. () => filters.page)
 * @param {import('vue').Ref<number>} totalPages - total pages ref
 * @param {function} setPage - setter for current page (e.g. (p) => { filters.page = p })
 * @returns {{ paginationRange, goToPage }}
 */
export function usePagination(getPage, totalPages, setPage) {
  const currentPage = computed({
    get: getPage,
    set: setPage,
  })

  const paginationRange = computed(() => {
    const p = currentPage.value
    const tp = totalPages.value
    if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
    const range = []
    range.push(1)
    if (p > 4) range.push('...')
    const start = Math.max(2, p - 1)
    const end = Math.min(tp - 1, p + 1)
    for (let i = start; i <= end; i++) range.push(i)
    if (p < tp - 3) range.push('...')
    if (tp > 1) range.push(tp)
    return range
  })

  function goToPage(p) {
    if (p < 1 || p > totalPages.value || p === currentPage.value) return
    currentPage.value = p
  }

  return { paginationRange, goToPage }
}
