import { describe, expect, it } from 'vitest'
import { createI18n } from './i18n'

describe('createI18n', () => {
  it('replaces every occurrence of a placeholder', () => {
    const i18n = createI18n({
      en: { greeting: '{name} invited {name}' },
    }, 'en')

    expect(i18n.t('greeting', { name: 'Alex' })).toBe('Alex invited Alex')
  })

  it('falls back to the default locale for an unsupported locale', () => {
    const i18n = createI18n({
      en: { greeting: 'Hello' },
    }, 'en')

    i18n.use('fr')

    expect(i18n.t('greeting')).toBe('Hello')
  })
})