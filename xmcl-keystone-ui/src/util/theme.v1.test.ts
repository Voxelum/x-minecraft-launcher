import { describe, expect, test } from 'vitest'
import { getDefaultTheme } from '../composables/theme'
import { deserialize, serialize } from './theme.v1'

describe('theme.v1 round-trip', () => {
  test('preserves muted background volume (0)', () => {
    const theme = getDefaultTheme()
    theme.backgroundVolume = 0
    const restored = deserialize(serialize(theme))
    expect(restored.backgroundVolume).toBe(0)
  })

  test('preserves zero blur values', () => {
    const theme = getDefaultTheme()
    theme.blur = { background: 0, card: 0, appBar: 0, sideBar: 0 }
    const restored = deserialize(serialize(theme))
    expect(restored.blur.background).toBe(0)
    expect(restored.blur.card).toBe(0)
    expect(restored.blur.appBar).toBe(0)
    expect(restored.blur.sideBar).toBe(0)
  })

  test('preserves backgroundColorOverlay = false', () => {
    const theme = getDefaultTheme()
    theme.backgroundColorOverlay = false
    const restored = deserialize(serialize(theme))
    expect(restored.backgroundColorOverlay).toBe(false)
  })

  test('preserves non-zero values', () => {
    const theme = getDefaultTheme()
    theme.backgroundVolume = 0.5
    theme.blur = { background: 3, card: 20, appBar: 4, sideBar: 5 }
    theme.backgroundColorOverlay = true
    const restored = deserialize(serialize(theme))
    expect(restored.backgroundVolume).toBe(0.5)
    expect(restored.blur.background).toBe(3)
    expect(restored.blur.card).toBe(20)
    expect(restored.blur.appBar).toBe(4)
    expect(restored.blur.sideBar).toBe(5)
    expect(restored.backgroundColorOverlay).toBe(true)
  })

  test('round-trips dark mode values', () => {
    for (const dark of [true, false, 'system'] as const) {
      const theme = getDefaultTheme()
      theme.dark = dark
      const restored = deserialize(serialize(theme))
      expect(restored.dark).toBe(dark)
    }
  })

  test('preserves colors', () => {
    const theme = getDefaultTheme()
    theme.colors.darkPrimaryColor = '#abcdef'
    const restored = deserialize(serialize(theme))
    expect(restored.colors.darkPrimaryColor).toBe('#abcdef')
  })
})
