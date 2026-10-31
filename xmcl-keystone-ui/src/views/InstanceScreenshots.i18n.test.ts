import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

function locale(name: string) {
  return yaml.load(readFileSync(new URL(`../../locales/${name}.yaml`, import.meta.url), 'utf8')) as {
    screenshots: Record<string, string>
  }
}
const en = locale('en')
const zh = locale('zh-CN')

describe('screenshots localization', () => {
  it('has Chinese translations for the complete English screenshot namespace and preserves parameters', () => {
    expect(Object.keys(zh.screenshots).sort()).toEqual(Object.keys(en.screenshots).sort())
    for (const [key, message] of Object.entries(en.screenshots)) {
      expect(zh.screenshots[key], key).not.toBe(message)
      expect(zh.screenshots[key].match(/\{\w+\}/g) ?? [], key)
        .toEqual(message.match(/\{\w+\}/g) ?? [])
    }
  })

  it('resolves every static screenshot UI key and switches languages without English fallback in Chinese', () => {
    const files = [
      './InstanceScreenshots.vue', './InstanceScreenshotsActions.vue', './InstanceScreenshotsExtension.vue',
      './HomeScreenshotCard.vue', './HomeActions.vue',
      '../components/ScreenshotEditorModal.vue', '../components/ScreenshotLightbox.vue',
    ]
    const keys = new Set(files.flatMap(file => Array.from(
      readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/t\(['"](screenshots\.[\w]+)['"]/g),
      match => match[1],
    )))
    const i18n = createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'en', messages: { en, 'zh-CN': zh, de: {} } })
    for (const key of keys) {
      const name = key.slice('screenshots.'.length)
      expect(en.screenshots[name], key).toBeDefined()
      expect(i18n.global.te(key, 'zh-CN'), key).toBe(true)
      expect(i18n.global.t(key, { count: 2, name: 'sample.png' }), key).not.toContain('screenshots.')
    }
    expect(i18n.global.t('screenshots.title')).toBe('截图与照片')
    i18n.global.locale.value = 'en'
    expect(i18n.global.t('screenshots.title')).toBe('Screenshots & Photos')
    // Locales not translated in this focused change retain a valid English fallback.
    i18n.global.locale.value = 'de'
    expect(i18n.global.t('screenshots.dragToMove')).toBe('Drag to move')
    i18n.global.locale.value = 'zh-CN'
    expect(i18n.global.t('screenshots.layerCopy', { name: 'sample.png' })).toBe('sample.png 副本')
  })
})
