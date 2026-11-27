import { describe, expect, it } from 'vitest'
import {
  createShaderLangBatches,
  isTranslatableShaderLangValue,
  prepareShaderLangEntries,
  protectShaderLangPlaceholders,
  readShaderLangTranslations,
  restoreShaderLangPlaceholders,
  toMcLang,
} from './shaderPackLangClient'

describe('shaderPackLangClient', () => {
  it('normalizes launcher locales to Minecraft language codes', () => {
    expect(toMcLang('zh-CN')).toBe('zh_cn')
    expect(toMcLang('en')).toBe('en_us')
    expect(toMcLang('en_IN')).toBe('en_us')
    expect(toMcLang('ar-EG')).toBe('ar_sa')
    expect(toMcLang('ja')).toBe('ja_jp')
    expect(toMcLang('pt_BR')).toBe('pt_br')
  })

  it('protects and restores color codes and printf placeholders', () => {
    const protectedValue = protectShaderLangPlaceholders('§aHello %1$s (100%%) \\n&l')
    expect(protectedValue.text).toBe('⟦XMCL0⟧Hello ⟦XMCL1⟧ (100⟦XMCL2⟧) ⟦XMCL3⟧⟦XMCL4⟧')
    expect(restoreShaderLangPlaceholders(protectedValue.text, protectedValue.tokens))
      .toBe('§aHello %1$s (100%%) \\n&l')
  })

  it('rejects broken placeholder restoration', () => {
    const tokens = ['§a', '%s']
    expect(restoreShaderLangPlaceholders('⟦XMCL0⟧x', tokens)).toBeNull()
    expect(restoreShaderLangPlaceholders('⟦XMCL0⟧⟦XMCL0⟧', tokens)).toBeNull()
    expect(restoreShaderLangPlaceholders('⟦XMCL9⟧⟦XMCL1⟧', tokens)).toBeNull()
    expect(restoreShaderLangPlaceholders('⟦XMCL0⟧⟦XMCL1⟧⟦XMCL2⟧', tokens)).toBeNull()
  })

  it('skips values that only contain formatting, numbers or punctuation', () => {
    expect(isTranslatableShaderLangValue('Hello')).toBe(true)
    expect(isTranslatableShaderLangValue('§a')).toBe(false)
    expect(isTranslatableShaderLangValue('123.45')).toBe(false)
    expect(isTranslatableShaderLangValue('%s %%')).toBe(false)
    expect(isTranslatableShaderLangValue('   ')).toBe(false)
    expect(isTranslatableShaderLangValue('§aWater')).toBe(true)
  })

  it('splits batches by count and by character budget without losing entries', () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      key: `key.${index}`,
      value: index === 0 ? 'x'.repeat(3400) : `Value ${index}`,
    }))
    const prepared = prepareShaderLangEntries(entries)
    expect(prepared.items).toHaveLength(12)

    const batches = createShaderLangBatches(prepared.items, 5)
    // 第一条独占一批（超出字符上限），其余按 5 条切分
    expect(batches[0].entries).toHaveLength(1)
    expect(batches.slice(1).every(batch => batch.entries.length <= 5)).toBe(true)
    expect(batches.flatMap(batch => batch.entries).map(entry => entry.key)).toEqual(entries.map(entry => entry.key))
    expect(batches.map(batch => batch.index)).toEqual(batches.map((_, index) => index))
  })

  it('validates AI responses and restores translated values', () => {
    const prepared = prepareShaderLangEntries([
      { key: 'a', value: '§aHello' },
      { key: 'b', value: 'World' },
    ])
    const batch = createShaderLangBatches(prepared.items, 10)[0]

    expect(readShaderLangTranslations([
      { key: 'a', value: '⟦XMCL0⟧你好' },
      { key: 'b', value: '世界' },
    ], batch.entries)).toEqual([
      { key: 'a', value: '§a你好' },
      { key: 'b', value: '世界' },
    ])

    expect(() => readShaderLangTranslations([{ key: 'a', value: '⟦XMCL0⟧你好' }], batch.entries))
      .toThrow(/missed/)
    expect(() => readShaderLangTranslations([
      { key: 'a', value: '⟦XMCL0⟧你好' },
      { key: 'a', value: '⟦XMCL0⟧你好' },
    ], batch.entries)).toThrow(/duplicated/)
    expect(() => readShaderLangTranslations([
      { key: 'a', value: '⟦XMCL0⟧你好' },
      { key: 'c', value: '未知' },
    ], batch.entries)).toThrow(/unknown/)
    expect(() => readShaderLangTranslations([
      { key: 'a', value: '你好' },
      { key: 'b', value: '世界' },
    ], batch.entries)).toThrow(/placeholders/)
    expect(() => readShaderLangTranslations([
      { key: 'a', value: '⟦XMCL0⟧你好' },
      { key: 'b', value: '世\n界' },
    ], batch.entries)).toThrow(/line break/)
  })
})
