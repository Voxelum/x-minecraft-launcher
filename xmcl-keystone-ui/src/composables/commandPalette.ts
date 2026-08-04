import { computed, onMounted, onUnmounted } from 'vue'
import { useOmniDialog } from './omniDialog'

/**
 * Shared reactive visibility of the command palette. Owned by AppCommandPalette
 * (as its `v-model`), but exposed here so other UI (e.g. the gamepad cards that
 * flank the palette) can appear/disappear in sync with it.
 */
export function useCommandPaletteVisible() {
  const surface = useOmniDialog()
  return computed({
    get: () => surface.shown.value && surface.mode.value === 'command',
    set: (value) => {
      if (value) surface.open('command')
      else if (surface.mode.value === 'command') surface.close()
    },
  })
}

/** Bind Ctrl/Cmd+Shift+C to open the command palette. */
export function useCommandPaletteHotkey() {
  const surface = useOmniDialog()
  function onKeyDown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey
    if (!mod || !e.shiftKey) return
    if (e.code === 'KeyC') {
      e.preventDefault()
      surface.open('command')
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
