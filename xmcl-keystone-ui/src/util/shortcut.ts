export interface ParsedShortcut {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  cmdOrCtrl: boolean
  key: string
  code?: string
}

export function parseShortcut(str: string): ParsedShortcut {
  if (!str) {
    return {
      ctrl: false,
      shift: true,
      alt: false,
      meta: false,
      cmdOrCtrl: true,
      key: 'c',
      code: 'KeyC',
    }
  }

  const parts = str.split('+').map(p => p.trim())
  let ctrl = false
  let shift = false
  let alt = false
  let meta = false
  let cmdOrCtrl = false
  let key = ''
  let code: string | undefined

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') {
      ctrl = true
    } else if (lower === 'cmdorctrl' || lower === 'mod') {
      cmdOrCtrl = true
    } else if (lower === 'shift' || lower === '⇧') {
      shift = true
    } else if (lower === 'alt' || lower === 'option' || lower === '⌥') {
      alt = true
    } else if (lower === 'cmd' || lower === 'meta' || lower === 'win' || lower === '⌘') {
      meta = true
    } else {
      key = lower
      if (key.length === 1 && key >= 'a' && key <= 'z') {
        code = `Key${key.toUpperCase()}`
      } else if (key.length === 1 && key >= '0' && key <= '9') {
        code = `Digit${key}`
      } else if (/^f[1-9][0-2]?$/.test(key)) {
        code = key.toUpperCase()
      } else if (key === 'tab') {
        code = 'Tab'
      } else if (key === 'space') {
        code = 'Space'
      }
    }
  }

  return { ctrl, shift, alt, meta, cmdOrCtrl, key, code }
}

export function matchShortcut(e: KeyboardEvent, parsed: ParsedShortcut): boolean {
  const hasCtrl = e.ctrlKey || e.key === 'Control'
  const hasMeta = e.metaKey || e.key === 'Meta'
  const hasShift = e.shiftKey || e.key === 'Shift'
  const hasAlt = e.altKey || e.key === 'Alt'

  if (parsed.cmdOrCtrl) {
    if (!hasCtrl && !hasMeta) return false
  } else {
    if (parsed.ctrl !== hasCtrl) return false
    if (parsed.meta !== hasMeta) return false
  }

  if (parsed.shift !== hasShift) return false
  if (parsed.alt !== hasAlt) return false

  // Modifier-only shortcut (e.g. Ctrl+Shift)
  if (!parsed.key) {
    return true
  }

  if (parsed.code && e.code === parsed.code) {
    return true
  }

  if (parsed.key && (e.key.toLowerCase() === parsed.key || e.code.toLowerCase() === parsed.key)) {
    return true
  }

  return false
}

export function formatShortcutDisplay(str: string): string {
  if (!str) {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
    return isMac ? '⌘⇧C' : 'Ctrl+Shift+C'
  }

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
  if (isMac) {
    return str
      .replace(/Ctrl\+|CmdOrCtrl\+|Control\+/gi, '⌘')
      .replace(/Cmd\+|Meta\+/gi, '⌘')
      .replace(/Shift\+/gi, '⇧')
      .replace(/Alt\+|Option\+/gi, '⌥')
  }

  return str
    .replace(/CmdOrCtrl\+/gi, 'Ctrl+')
    .replace(/Meta\+/gi, 'Win+')
}

export function eventToShortcutString(e: KeyboardEvent): string | null {
  if (e.key === 'Escape') return null

  const rawParts: string[] = []

  const isCtrlKey = e.key === 'Control'
  const isAltKey = e.key === 'Alt'
  const isShiftKey = e.key === 'Shift'
  const isMetaKey = e.key === 'Meta'

  if (e.ctrlKey || isCtrlKey) rawParts.push('Ctrl')
  if (e.altKey || isAltKey) rawParts.push('Alt')
  if (e.shiftKey || isShiftKey) rawParts.push('Shift')
  if (e.metaKey || isMetaKey) rawParts.push('Meta')

  const uniqueParts: string[] = []
  for (const p of rawParts) {
    if (!uniqueParts.includes(p)) uniqueParts.push(p)
  }

  if (!isCtrlKey && !isAltKey && !isShiftKey && !isMetaKey) {
    let mainKey = ''
    if (e.code.startsWith('Key')) {
      mainKey = e.code.replace('Key', '')
    } else if (e.code.startsWith('Digit')) {
      mainKey = e.code.replace('Digit', '')
    } else if (e.code.startsWith('Numpad')) {
      mainKey = e.code.replace('Numpad', 'Num')
    } else if (e.key.length === 1) {
      mainKey = e.key.toUpperCase()
    } else {
      mainKey = e.key
    }
    uniqueParts.push(mainKey)
  }

  if (uniqueParts.length === 0) return null

  return uniqueParts.join('+')
}
