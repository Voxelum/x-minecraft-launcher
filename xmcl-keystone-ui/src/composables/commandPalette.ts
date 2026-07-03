import { useEventBus } from '@vueuse/core'
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Event bus key for showing / hiding the command palette modal. We don't
 * use the existing `useDialog` system because the palette is a more
 * lightweight always-mounted modal — using the bus avoids the dialog
 * registration boilerplate.
 */
const PALETTE_BUS_KEY = 'app:command-palette'

export function useCommandPaletteBus() {
  return useEventBus<'show' | 'hide' | 'toggle'>(PALETTE_BUS_KEY)
}

/**
 * Shared reactive visibility of the command palette. Owned by AppCommandPalette
 * (as its `v-model`), but exposed here so other UI (e.g. the gamepad cards that
 * flank the palette) can appear/disappear in sync with it.
 */
const paletteVisible = ref(false)
export function useCommandPaletteVisible() {
  return paletteVisible
}

/**
 * Bind Ctrl/Cmd+K (and Ctrl/Cmd+Shift+P) to toggle the command palette.
 * Should be called once at the app root.
 */
export function useCommandPaletteHotkey() {
  const bus = useCommandPaletteBus()
  function onKeyDown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    if (e.code === 'KeyK') {
      e.preventDefault()
      bus.emit('toggle')
    } else if (e.shiftKey && e.code === 'KeyP') {
      e.preventDefault()
      bus.emit('toggle')
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
