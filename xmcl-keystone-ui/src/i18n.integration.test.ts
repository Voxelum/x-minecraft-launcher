import { baseCompile } from '@intlify/message-compiler'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n, Translation } from 'vue-i18n'
import { expect, test } from 'vitest'

test('new runtime accepts build-compiler AST, switches language and falls back with interpolation', () => {
  const ast = baseCompile('Hello {name}', { jit: true }).ast
  const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', missingWarn: false, fallbackWarn: false, messages: {
    en: { greeting: ast, fallback: 'Fallback {name}', count: 'no files | one file | {count} files' },
    fr: { greeting: 'Bonjour {name}' },
    de: {},
  } })
  expect(i18n.global.t('greeting', { name: 'Alex' })).toBe('Hello Alex')
  expect(i18n.global.t('count', 2)).toBe('2 files')
  i18n.global.locale.value = 'fr'
  expect(i18n.global.t('greeting', { name: 'Alex' })).toBe('Bonjour Alex')
  expect(i18n.global.t('fallback', { name: 'Alex' })).toBe('Fallback Alex')
  i18n.global.setLocaleMessage('de', { greeting: 'Hallo {name}' })
  i18n.global.locale.value = 'de'
  expect(i18n.global.t('greeting', { name: 'Alex' })).toBe('Hallo Alex')
})

test('translation slots preserve VNodes and escape interpolated markup in ordinary text rendering', async () => {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { link: 'Open {action}', text: 'Hello {name}' } } })
  const app = createSSRApp({ render: () => h('div', [
    h(Translation, { keypath: 'link', tag: 'p' }, { action: () => h('a', { href: '/local' }, 'settings') }),
    h('p', i18n.global.t('text', { name: '<img src=x onerror=alert(1)>' })),
  ]) })
  app.use(i18n)
  const rendered = await renderToString(app)
  expect(rendered).toContain('<a href="/local">settings</a>')
  expect(rendered).toContain('&lt;img src=x onerror=alert(1)&gt;')
  expect(rendered).not.toContain('<img')
})
