import { describe, expect, it } from 'vitest'
import { buildMainState, computeInvalid, computeLint, computeWarnings, scanSource } from './i18n-core.mjs'

function createState(files, baseEntries = [['shared.key', 'Shared']]) {
  return {
    localeKeys: new Map([['en', new Map(baseEntries)]]),
    localeErrors: new Map(),
    fileScans: new Map(files.map(([file, source]) => [file, scanSource(file, source)])),
    allowList: new Set(),
  }
}

describe('scanSource', () => {
  it('ignores translation-shaped text in comments and strings', () => {
    const result = scanSource('/sample.ts', `
      // t('comment.key')
      const example = "t('string.key')"
      t('real.key')
    `)

    expect([...result.staticKeys]).toEqual(['real.key'])
  })

  it('only derives dynamic prefixes from translation calls', () => {
    const result = scanSource('/sample.ts', `
      const url = \`https://example.com/items.\${id}\`
      t(\`items.\${id}\`)
    `)

    expect([...result.prefixes]).toEqual(['items.'])
  })

  it('records finite static choices passed to a translation call', () => {
    const result = scanSource('/sample.ts', `
      t(submitted ? 'publish.submitted' : 'publish.draft')
      t(key || 'shared.fallback')
    `)

    expect([...result.staticKeys]).toEqual(['publish.submitted', 'publish.draft', 'shared.fallback'])
  })

  it('supports quoted static keypaths and ignores bound keypaths', () => {
    const result = scanSource('/sample.vue', `
      <template>
        <i18n-t keypath="double.key" />
        <i18n-t keypath='single.key' />
        <i18n-t :keypath="dynamicKey" />
      </template>
    `)

    expect([...result.staticKeys]).toEqual(['double.key', 'single.key'])
  })
})

describe('computeLint', () => {
  it('keeps inline locale definitions scoped to their source file', () => {
    const state = createState([
      ['/owner.vue', `<script setup>t('local.title')</script>\n<i18n locale="en" lang="yaml">local:\n  title: Local</i18n>`],
      ['/consumer.vue', `<script setup>t('local.title')</script>`],
    ])

    expect(computeLint(state).missing).toHaveLength(1)
    expect(computeLint(state).missing[0]).toMatchObject({ key: 'local.title' })
    expect(computeLint(state).missing[0].at).toMatch(/consumer\.vue:1$/)
  })

  it('does not accept an object path as a translatable message', () => {
    const state = createState([
      ['/sample.vue', `<script setup>t('shared')</script>`],
    ])

    expect(computeLint(state).missing).toHaveLength(1)
    expect(computeLint(state).missing[0]).toMatchObject({ key: 'shared' })
    expect(computeLint(state).missing[0].at).toMatch(/sample\.vue:1$/)
  })

  it('reports translation coverage against the base locale', () => {
    const state = createState([],
      [['shared.first', 'First'], ['shared.second', 'Second']])
    state.localeKeys.set('de', new Map([['shared.first', 'Erste']]))

    expect(computeLint(state).coverage).toEqual([
      { locale: 'de', translated: 1, total: 2, missing: 1, percent: 50 },
    ])
  })

  it('excludes invalid messages and retains malformed locales in coverage', () => {
    const state = createState([], [['shared.first', 'First'], ['shared.second', 'Second']])
    state.localeKeys.set('de', new Map([['shared.first', ''], ['shared.second', null]]))
    state.localeKeys.set('fr', new Map([['shared.first', 'Previously valid']]))
    state.localeErrors.set('fr', 'bad yaml')
    state.localeNames = new Set(['en', 'de', 'fr'])

    expect(computeLint(state).coverage).toEqual([
      { locale: 'de', translated: 0, total: 2, missing: 2, percent: 0 },
      { locale: 'fr', translated: 0, total: 2, missing: 2, percent: 0 },
    ])
  })

  it('reports malformed inline locale blocks with their source file', () => {
    const state = createState([
      ['/broken.vue', `<i18n locale="en" lang="yaml">message: [</i18n>`],
    ])

    expect(computeLint(state).invalid).toMatchObject([
      { locale: 'en', key: null, code: 'yaml', file: expect.stringMatching(/broken\.vue$/) },
    ])
  })

  it('compares placeholders between inline base and translation blocks', () => {
    const state = createState([
      ['/inline.vue', `
        <i18n locale="en" lang="yaml">message: Hello {name}</i18n>
        <i18n locale="de" lang="yaml">message: Hallo {Name}</i18n>
      `],
    ])

    expect(computeLint(state).invalid).toMatchObject([
      { locale: 'de', key: 'message', code: 'placeholders', file: expect.stringMatching(/inline\.vue$/) },
    ])
  })
})

describe('computeInvalid', () => {
  it('rejects empty and non-string locale leaves', () => {
    const localeKeys = new Map([
      ['en', new Map([['empty', ''], ['nullish', null], ['list', ['value']]])],
    ])

    expect(computeInvalid({ localeKeys, localeErrors: new Map() })).toMatchObject([
      { locale: 'en', key: 'empty', code: 'empty' },
      { locale: 'en', key: 'list', code: 'type' },
      { locale: 'en', key: 'nullish', code: 'type' },
    ])
  })

  it('reports placeholder names that drift from the base locale', () => {
    const localeKeys = new Map([
      ['en', new Map([['welcome', 'Hello {name}, {name}!']])],
      ['de', new Map([['welcome', 'Hallo {Name}!']])],
    ])

    expect(computeInvalid({ localeKeys, localeErrors: new Map() })).toMatchObject([
      {
        locale: 'de',
        key: 'welcome',
        code: 'placeholders',
        missing: ['name'],
        extra: ['Name'],
      },
    ])
  })

  it('compares placeholder sets rather than plural-branch repetitions', () => {
    const localeKeys = new Map([
      ['en', new Map([['items', '{count} item | {count} items']])],
      ['ja-JP', new Map([['items', '{count} items']])],
    ])

    expect(computeInvalid({ localeKeys, localeErrors: new Map() })).toEqual([])
  })

  it('validates positional placeholder indexes', () => {
    const localeKeys = new Map([
      ['en', new Map([['items', 'Item {0} and {1}']])],
      ['de', new Map([['items', 'Element {0} und {2}']])],
    ])

    expect(computeInvalid({ localeKeys, localeErrors: new Map() })).toMatchObject([
      { locale: 'de', key: 'items', code: 'placeholders', missing: ['#1'], extra: ['#2'] },
    ])
  })

  it('reports omitted placeholders as warnings rather than invalid messages', () => {
    const localeKeys = new Map([
      ['en', new Map([['memory', '{free} / {total}']])],
      ['it-IT', new Map([['memory', 'Memoria di sistema']])],
    ])

    const state = { localeKeys, localeErrors: new Map() }
    expect(computeInvalid(state)).toEqual([])
    expect(computeWarnings(state)).toMatchObject([
      { locale: 'it-IT', key: 'memory', code: 'placeholders-missing', missing: ['free', 'total'] },
    ])
  })
})

describe('Electron main-process locales', () => {
  it('loads only bundled locales and keeps their used keys complete', () => {
    const state = buildMainState()

    expect([...state.localeKeys.keys()].sort()).toEqual(['en', 'es-ES', 'ru', 'zh-CN'])
    expect(computeLint(state).invalid).toEqual([])
    expect(computeLint(state).missing).toEqual([])
  })
})