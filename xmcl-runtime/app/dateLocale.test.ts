import { describe, expect, test } from 'vitest'
import { getSystemDateLocale } from './dateLocale'

describe('getSystemDateLocale', () => {
  test('prefers the system time locale over the UI locale', () => {
    expect(
      getSystemDateLocale({
        LC_ALL: '',
        LC_TIME: 'pl_PL.UTF-8',
        LANG: 'en_US.UTF-8',
      }),
    ).toBe('pl-PL')
  })

  test('honors LC_ALL and falls back to LANG', () => {
    expect(
      getSystemDateLocale({
        LC_ALL: 'de_DE.UTF-8',
        LC_TIME: 'pl_PL.UTF-8',
        LANG: 'en_US.UTF-8',
      }),
    ).toBe('de-DE')
    expect(getSystemDateLocale({ LANG: 'en_US.UTF-8' })).toBe('en-US')
  })

  test('leaves C/POSIX locales to the runtime default', () => {
    expect(getSystemDateLocale({ LC_TIME: 'C.UTF-8' })).toBeUndefined()
    expect(getSystemDateLocale({ LC_TIME: 'POSIX' })).toBeUndefined()
  })
})
