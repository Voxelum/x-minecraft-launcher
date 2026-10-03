import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { baseCompile } from '@intlify/message-compiler'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { flatten, LOCALES_DIR, scanSource, SRC_DIR } from './i18n-core.mjs'

const base = flatten(yaml.load(readFileSync(join(LOCALES_DIR, 'en.yaml'), 'utf8')))
const importKeys = [...base.keys()].filter(key => key.startsWith('importModpack.'))
const reusedKeys = ['userSkin.localFile', 'shared.install']
const removedKeys = ['fromFile', 'fromUrlTitle', 'fromUrlPlaceholder', 'import', 'importVersion', 'resolving']
const parameters = message => [...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

describe('modpack import translations', () => {
  it.each(readdirSync(LOCALES_DIR).filter(file => file.endsWith('.yaml')))('%s covers the import flow without fallback and preserves parameters', (file) => {
    const messages = flatten(yaml.load(readFileSync(join(LOCALES_DIR, file), 'utf8')))
    for (const key of [...importKeys, ...reusedKeys]) {
      const message = messages.get(key)
      expect(typeof message, key).toBe('string')
      expect(message.trim(), key).not.toBe('')
      expect(parameters(message), key).toEqual(parameters(base.get(key)))
      const errors = []
      baseCompile(message, { onError: error => errors.push(error.message) })
      expect(errors, key).toEqual([])
    }
    for (const key of removedKeys) {
      expect(messages.has(`importModpack.${key}`)).toBe(false)
    }
  })

  it('uses each retained import key and the shared labels in the dialogs', () => {
    const keys = new Set(['AppAddInstanceDialog.vue', 'AppImportUrlDialog.vue'].flatMap(file => {
      const path = join(SRC_DIR, 'views', file)
      return [...scanSource(path, readFileSync(path, 'utf8')).staticKeys]
    }))
    for (const key of [...importKeys, ...reusedKeys]) {
      expect(keys.has(key), key).toBe(true)
    }
    for (const key of keys) {
      if (key.startsWith('importModpack.')) expect(base.has(key), key).toBe(true)
    }
  })
})
