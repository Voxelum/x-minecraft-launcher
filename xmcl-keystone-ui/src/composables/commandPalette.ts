import { computed, onMounted, onUnmounted } from 'vue'
import { useOmniDialog } from './omniDialog'
import { kSettingsState } from './setting'
import { injection } from '@/util/inject'
import { matchShortcut, parseShortcut } from '@/util/shortcut'

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

/** Bind configured shortcut (default Ctrl/Cmd+Shift+C) to open the command palette. */
export function useCommandPaletteHotkey() {
  const surface = useOmniDialog()
  const { state: settingsState } = injection(kSettingsState)

  function onKeyDown(e: KeyboardEvent) {
    const configuredShortcut = settingsState.value?.quickActionShortcut ?? ''
    const parsed = parseShortcut(configuredShortcut)
    if (matchShortcut(e, parsed)) {
      const target = e.target as HTMLElement | null
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const isFuncKey = /^f[1-9][0-2]?$/i.test(parsed.key)
      const hasModifier = parsed.ctrl || parsed.shift || parsed.alt || parsed.meta || parsed.cmdOrCtrl
      if (isInput && !hasModifier && !isFuncKey) {
        return
      }
      e.preventDefault()
      surface.open('command')
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
