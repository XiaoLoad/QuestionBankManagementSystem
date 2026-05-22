import { watch, onBeforeUnmount } from 'vue'

/**
 * Composable for debounced search input, shared across list views.
 * @param {import('vue').Reactive} filters - reactive filters object with a 'search' property
 * @param {function} onSearch - callback when search triggers (should reload data with page reset)
 * @param {number} delay - debounce delay in ms (default 300)
 */
export function useDebounceSearch(filters, onSearch, delay = 300) {
  let timer = null

  const stop = watch(() => filters.search, () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      filters.page = 1
      onSearch()
    }, delay)
  })

  onBeforeUnmount(() => {
    clearTimeout(timer)
    stop()
  })
}
