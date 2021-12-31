import { InjectionKey, inject, ref, Ref, onMounted, onUnmounted, provide } from '@vue/composition-api'

export const SEARCH_TEXT_SYMBOL: InjectionKey<Ref<string>> = Symbol('search-text')
export const SEARCH_TOGGLE_SYMBOL: InjectionKey<Array<(shown?: boolean) => boolean>> = Symbol('search-toggle')

export interface Search {
  text: Ref<string>
  toggle(): void
}

export const SEARCH_SYMBOL: InjectionKey<Search> = Symbol('Search')

export function useSearch() {
  const text = inject(SEARCH_TEXT_SYMBOL, ref(''))
  return { text }
}

export function useSearchToggles() {
  const toggles = inject(SEARCH_TOGGLE_SYMBOL, [])
  const toggle = (shown?: boolean) => {
    toggles[0]?.(shown)
  }
  return { toggles, toggle }
}

export function onSearchToggle(func: (shown?: boolean) => boolean) {
  const toggles = inject(SEARCH_TOGGLE_SYMBOL, [])
  onMounted(() => {
    toggles.unshift(func)
  })
  onUnmounted(() => {
    toggles.shift()
  })
}

export function provideSearch() {
  const toggles = [(shown?: boolean) => false]
  const text = ref('')
  const toggle = (shown?: boolean) => toggles[0]?.(shown) ?? false
  function handleKeydown(e: KeyboardEvent) {
    if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
      toggle()
    }
  }
  function handleKeyup(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (toggle(true)) {
        text.value = ''
        e.preventDefault()
        // e.stopImmediatePropagation()
      }
    }
  }
  onMounted(() => {
    document.addEventListener('keyup', handleKeyup)
    document.addEventListener('keydown', handleKeydown)
  })
  onUnmounted(() => {
    document.removeEventListener('keyup', handleKeyup)
    document.removeEventListener('keydown', handleKeydown)
  })
  provide(SEARCH_SYMBOL, {
    toggle,
    text,
  })
  provide(SEARCH_TEXT_SYMBOL, text)
  provide(SEARCH_TOGGLE_SYMBOL, toggles)
  return { toggle, text, toggles }
}
