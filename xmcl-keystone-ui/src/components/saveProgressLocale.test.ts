import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
import { baseCompile } from '@intlify/message-compiler'
import { describe, expect, test } from 'vitest'

const directory = new URL('../../locales/', import.meta.url)
const files = readdirSync(directory).filter(file => file.endsWith('.yaml'))
const keys = ['loading', 'noData', 'noDataHint', 'quests', 'advancements', 'done', 'inProgress', 'all', 'treeView', 'filterPlaceholder', 'root', 'exitFullscreen', 'locked', 'zoomIn', 'zoomOut']
const removed = ['tabTitle', 'completed', 'deaths', 'minedBlocks', 'mobKills', 'playTime', 'fullscreen', 'listView']
const referencedKeys = [...new Set(['SaveProgress.vue', 'SaveProgressCanvas.vue'].flatMap(file => {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  return [...source.matchAll(/'([a-zA-Z]\w*(?:\.\w+)+)'/g)].map(match => match[1])
}))]
function messageAt(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined
    return Reflect.get(value, part)
  }, messages)
}
const english = load(readFileSync(new URL('en.yaml', directory), 'utf8'))
interface Messages {
  save: { map: { tabTitle: string }; progress: Record<string, string> }
  instance: { fullscreen: string }
  me: { listView: string }
  duration: Record<string, string>
}
describe('save progress locale coverage', () => {
  test('covers every shipped locale', () => { expect(files).toHaveLength(29) })
  test('discovers shared instructions from the actual progress component sources', () => {
    expect(referencedKeys).toEqual(expect.arrayContaining(['save.mapHintPan', 'save.resetView', 'shared.close']))
  })
  test.each(files)('%s has translated, compilable labels and duration parameters', file => {
    const messages = load(readFileSync(new URL(file, directory), 'utf8')) as Messages
    expect(Object.keys(messages.save.progress).sort()).toEqual([...keys].sort())
    for (const key of removed) expect(messages.save.progress[key]).toBeUndefined()
    const values = [messages.save.map.tabTitle, ...keys.map(key => messages.save.progress[key]), messages.instance.fullscreen, messages.me.listView]
    for (const value of values) {
      expect(typeof value, fileURLToPath(new URL(file, directory))).toBe('string')
      expect(value.length).toBeGreaterThan(0)
      baseCompile(value, { onError: error => { throw error } })
    }
    for (const unit of ['second', 'minute', 'hour', 'day']) {
      expect(messages.duration[unit]).toContain('{duration}')
      baseCompile(messages.duration[unit], { onError: error => { throw error } })
    }
    for (const key of referencedKeys) {
      const value = messageAt(messages, key)
      expect(value, `${file}: ${key} must not fall back to English`).toBeTypeOf('string')
      if (typeof value !== 'string') continue
      expect(value.trim().length, `${file}: ${key}`).toBeGreaterThan(0)
      baseCompile(value, { onError: error => { throw error } })
      // "Quests" is also the established German gaming term.
      if (!['en.yaml', 'en-IN.yaml', 'lolcat.yaml'].includes(file) && !(file === 'de.yaml' && key === 'save.progress.quests')) {
        expect(value, `${file}: ${key} must be translated`).not.toBe(messageAt(english, key))
      }
    }
    if (!['en.yaml', 'en-IN.yaml'].includes(file)) {
      expect(messages.save.progress.noDataHint).not.toMatch(/^Play in this world/)
    }
  })
})
