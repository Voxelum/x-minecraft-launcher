import { InjectionKey, Ref } from '@vue/composition-api'
import { injection } from '../util/inject'

export interface SearchBar {
  show: Ref<boolean>
  text: Ref<string>
}

export const SEARCH_BAR_SYMBOL: InjectionKey<SearchBar> = Symbol('search-bar')

export function useSearchBar() {
  return injection(SEARCH_BAR_SYMBOL)
}

export function provideSearchBar() {
  const text = ref('')
  const show = ref(false)
  provide(SEARCH_BAR_SYMBOL, { text, show })
}
