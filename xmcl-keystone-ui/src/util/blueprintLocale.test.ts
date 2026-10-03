import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import yaml from 'js-yaml'

const localeDir = join(dirname(fileURLToPath(import.meta.url)), '../../locales')
const sourceFiles = [
  'Blueprint.vue',
  'BlueprintActions.vue',
  'BlueprintExtension.vue',
  'BlueprintPreview.vue',
  'HomeBlueprintCard.vue',
  'HomeFooterCard.vue',
]
const blueprintKeys = new Set(
  sourceFiles.flatMap((fileName) => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../views', fileName), 'utf8')
    return [...source.matchAll(/(?:t|\$t)\(\s*['"](blueprint(?:\.[A-Za-z0-9_]+)+)/g)]
      .map((match) => match[1].replace(/^blueprint\./, ''))
  }),
)

function getValue(value: unknown, key: string): unknown {
  return key.split('.').reduce((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, value)
}

function placeholders(value: unknown): string[] {
  return [...new Set([...String(value).matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]))].sort()
}

function loadLocale(fileName: string) {
  return yaml.load(readFileSync(join(localeDir, fileName), 'utf8')) as {
    blueprint?: Record<string, unknown>
  }
}

describe('blueprint locales', () => {
  const localeFiles = readdirSync(localeDir).filter((fileName) => fileName.endsWith('.yaml')).sort()
  const english = loadLocale('en.yaml').blueprint

  test('covers every key used by the blueprint views in every locale', () => {
    expect(localeFiles).toHaveLength(29)
    for (const fileName of localeFiles) {
      const blueprint = loadLocale(fileName).blueprint
      for (const key of blueprintKeys) {
        expect(getValue(blueprint, key), `${fileName}: blueprint.${key}`).toBeTypeOf('string')
      }
    }
  })

  test('preserves blueprint message placeholders', () => {
    for (const fileName of localeFiles) {
      const blueprint = loadLocale(fileName).blueprint
      for (const key of blueprintKeys) {
        expect(
          placeholders(getValue(blueprint, key)),
          `${fileName}: blueprint.${key}`,
        ).toEqual(placeholders(getValue(english, key)))
      }
    }
  })
})
