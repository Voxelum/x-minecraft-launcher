import { InjectionKey, inject, onMounted, onUnmounted, provide } from 'vue'
import { injection } from '../util/inject'

// export const SEARCH_TOGGLE_SYMBOL: InjectionKey<SearchToggle> = Symbol('search-toggle')

// export interface SearchToggle {
//   handlers: Array<(force?: boolean) => boolean>
//   toggle(force?: boolean): boolean
// }

// export function useSearchToggle() {
//   const toggles = inject(SEARCH_TOGGLE_SYMBOL, [])
//   const toggle = (force?: boolean) => {
//     toggles[0]?.(force)
//   }
//   return { toggles, toggle }
// }

// export function onSearchToggle(func: (force?: boolean) => boolean) {
//   const { handlers } = injection(SEARCH_TOGGLE_SYMBOL)
//   onMounted(() => {
//     handlers.unshift(func)
//   })
//   onUnmounted(() => {
//     handlers.shift()
//   })
// }

// export function provideSearchToggle() {
//   const toggles = [(shown: boolean) => false]
//   const toggle = (shown: boolean) => toggles[0]?.(shown) ?? false
//   function handleKeydown(e: KeyboardEvent) {
//     if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
//       toggle(true)
//     }
//   }
//   function handleKeyup(e: KeyboardEvent) {
//     if (e.key === 'Escape') {
//       if (toggle(false)) {
//         e.preventDefault()
//       }
//     }
//   }
//   onMounted(() => {
//     document.addEventListener('keyup', handleKeyup)
//     document.addEventListener('keydown', handleKeydown)
//   })
//   onUnmounted(() => {
//     document.removeEventListener('keyup', handleKeyup)
//     document.removeEventListener('keydown', handleKeydown)
//   })
//   provide(SEARCH_TOGGLE_SYMBOL, { handlers: toggles, toggle })
//   return { toggle, toggles }
// }
