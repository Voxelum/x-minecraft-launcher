import { afterEach, describe, expect, test, vi } from 'vitest'
import { eventToShortcutString, formatShortcutDisplay, matchShortcut, parseShortcut } from './shortcut'

function createKeyboardEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    altKey: false,
    code: '',
    ctrlKey: false,
    key: '',
    metaKey: false,
    shiftKey: false,
    ...overrides,
  } as KeyboardEvent
}

describe('shortcut', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test.each([
    ['space', createKeyboardEvent({ code: 'Space', ctrlKey: true, key: ' ' }), 'Ctrl+Space'],
    ['plus', createKeyboardEvent({ code: 'Equal', ctrlKey: true, key: '+', shiftKey: true }), 'Ctrl+Shift+Plus'],
    ['numpad', createKeyboardEvent({ code: 'Numpad0', ctrlKey: true, key: '0' }), 'Ctrl+Numpad0'],
  ])('round-trips a recorded %s shortcut', (_, event, expected) => {
    const shortcut = eventToShortcutString(event)

    expect(shortcut).toBe(expected)
    expect(matchShortcut(event, parseShortcut(shortcut!))).toBe(true)
  })

  test.each([
    createKeyboardEvent({ code: 'KeyC', key: 'c', shiftKey: true, ctrlKey: true }),
    createKeyboardEvent({ code: 'KeyC', key: 'c', shiftKey: true, metaKey: true }),
  ])('matches the default shortcut with Ctrl or Command', (event) => {
    expect(matchShortcut(event, parseShortcut(''))).toBe(true)
  })

  test('formats the plus key for display', () => {
    expect(formatShortcutDisplay('Ctrl+Shift+Plus')).toBe('Ctrl+Shift++')
  })

  test('does not match an ordinary key pressed after a modifier-only shortcut', () => {
    const parsed = parseShortcut('Ctrl+Shift')

    expect(matchShortcut(createKeyboardEvent({ code: 'ShiftLeft', ctrlKey: true, key: 'Shift', shiftKey: true }), parsed)).toBe(true)
    expect(matchShortcut(createKeyboardEvent({ code: 'KeyV', ctrlKey: true, key: 'v', shiftKey: true }), parsed)).toBe(false)
  })

  test('distinguishes Control from Command on macOS', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })

    expect(formatShortcutDisplay('Ctrl+K')).toBe('⌃K')
    expect(formatShortcutDisplay('CmdOrCtrl+K')).toBe('⌘K')
  })
})