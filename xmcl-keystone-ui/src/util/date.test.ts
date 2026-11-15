import { afterEach, describe, expect, test, vi } from 'vitest'
import { getLocalDateString, setSystemDateLocale } from './date'

describe('getLocalDateString', () => {
  afterEach(() => {
    setSystemDateLocale(undefined)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('uses the system date locale when it differs from the renderer language', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    setSystemDateLocale('pl-PL')

    const timestamp = Date.UTC(2026, 10, 15)

    expect(getLocalDateString(timestamp, { dateStyle: 'short' })).toBe(
      new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short' }).format(timestamp),
    )
    expect(getLocalDateString(timestamp, { dateStyle: 'short' })).not.toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(timestamp),
    )
  })
})
