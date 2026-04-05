import { useEventListener } from '@vueuse/core'
import { Ref, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export interface UseSpotlightReturn {
  isVisible: Ref<boolean>
  open: () => void
  close: () => void
  toggle: () => void
}

/**
 * Parse shortcut string to check if event matches
 */
function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+').map(p => p.trim().toLowerCase())
  
  const needsCtrl = parts.includes('ctrl')
  const needsCmd = parts.includes('cmd') || parts.includes('meta')
  const needsAlt = parts.includes('alt')
  const needsShift = parts.includes('shift')
  
  // Check modifier keys
  if (needsCtrl && !event.ctrlKey) return false
  if (needsCmd && !event.metaKey) return false
  if (needsAlt && !event.altKey) return false
  if (needsShift && !event.shiftKey) return false
  
  // Get the main key (last part that's not a modifier)
  const mainKey = parts.find(p => 
    p !== 'ctrl' && p !== 'cmd' && p !== 'meta' && p !== 'alt' && p !== 'shift'
  )
  
  if (!mainKey) return false
  
  return event.key.toLowerCase() === mainKey.toLowerCase()
}

/**
 * Composable to handle Spotlight keyboard shortcut
 * Default: Ctrl+K or Cmd+K (more standard for search)
 * Alternative: Ctrl+Tab or Cmd+Tab
 */
export function useSpotlight(): UseSpotlightReturn {
  const isVisible = ref(false)
  const shortcut = useLocalStorage('spotlight-shortcut', 'Ctrl+K')

  const open = () => {
    isVisible.value = true
  }

  const close = () => {
    isVisible.value = false
  }

  const toggle = () => {
    isVisible.value = !isVisible.value
  }

  // Register global keyboard shortcut
  useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    // Ignore if typing in input/textarea
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    // Check custom shortcut
    if (matchesShortcut(e, shortcut.value)) {
      e.preventDefault()
      e.stopPropagation()
      toggle()
      return
    }

    // Fallback: Ctrl+Tab or Cmd+Tab as alternative
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      toggle()
      return
    }

    // Escape to close
    if (e.key === 'Escape' && isVisible.value) {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }, { capture: true })

  return {
    isVisible,
    open,
    close,
    toggle,
  }
}

/**
 * Composable to handle Spotlight keyboard shortcut only (without state)
 * This is useful when the Spotlight component manages its own state
 */
export function useSpotlightShortcut(onTriggered: () => void) {
  const shortcut = useLocalStorage('spotlight-shortcut', 'Ctrl+K')
  
  useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    // Ignore if typing in input/textarea
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    // Check custom shortcut
    if (matchesShortcut(e, shortcut.value)) {
      e.preventDefault()
      e.stopPropagation()
      onTriggered()
      return
    }

    // Fallback: Ctrl+Tab or Cmd+Tab as alternative
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      onTriggered()
      return
    }
  }, { capture: true })
} 
