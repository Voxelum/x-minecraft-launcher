import { readFileSync, readdirSync } from 'node:fs'
import { load } from 'js-yaml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { useDuration } from './date'

const localesDirectory = new URL('../../locales/', import.meta.url)
const locales = readdirSync(localesDirectory).filter(name => name.endsWith('.yaml'))

afterEach(() => vi.unstubAllGlobals())

describe('localized task duration', () => {
  it.each(locales)('uses existing duration messages in %s for every unit', (file) => {
    const locale = file.slice(0, -5)
    const messages = load(readFileSync(new URL(file, localesDirectory), 'utf8')) as { duration: Record<string, string> }
    const i18n = createI18n({ legacy: false, locale, fallbackLocale: false, messages: { [locale]: { duration: messages.duration } } })
    vi.stubGlobal('useI18n', () => i18n.global)
    const { formatDuration } = useDuration()
    for (const [seconds, unit] of [[1, 'second'], [60, 'minute'], [3600, 'hour'], [86400, 'day']] as const) {
      expect(messages.duration[unit]).toContain('{duration}')
      expect(formatDuration(seconds)).toBe(i18n.global.t(`duration.${unit}`, { duration: '1' }, { plural: 1 }))
      expect(formatDuration(seconds * 2)).toBe(i18n.global.t(`duration.${unit}`, { duration: '2' }, { plural: 2 }))
    }
    if (locale === 'zh-TW' || locale === 'zh-HK') {
      expect(formatDuration(3600)).toBe('1 小時')
    }
  })

  it('keeps a compact single unit, rounds up sub-seconds and rejects invalid estimates', () => {
    const t = vi.fn((key: string, params: { duration: string }, options: { plural: number }) => `${key}:${params.duration}:${options.plural}`)
    vi.stubGlobal('useI18n', () => ({ t }))
    const { formatDuration } = useDuration()
    expect(formatDuration(0.2)).toBe('duration.second:1:1')
    expect(formatDuration(90)).toBe('duration.minute:1.5:1.5')
    expect(formatDuration(5400)).toBe('duration.hour:1.5:1.5')
    expect(formatDuration(172800)).toBe('duration.day:2:2')
    for (const seconds of [0, -1, NaN, Infinity, -Infinity]) {
      expect(formatDuration(seconds)).toBe('')
    }
    expect(t).toHaveBeenCalledTimes(4)
  })
})
