import { describe, expect, it } from 'vitest'
import {
  findShaderPackTargetLanguage,
  getShaderPackPromptLanguageName,
  getShaderPackTargetLanguages,
  isTranslatableShaderValue,
  protectShaderValue,
  restoreShaderValue,
  splitShaderLangBatches,
} from './shaderPackLangClient'

describe('shaderPackLangClient', () => {
  it('protects and restores color codes and placeholders', () => {
    const protectedValue = protectShaderValue('§aHello %1$s (100%%) \\n')
    expect(protectedValue.text).not.toContain('§a')
    expect(protectedValue.text).not.toContain('%1$s')
    expect(protectedValue.text).not.toContain('\\n')
    expect(restoreShaderValue(protectedValue.text.replace('Hello', '你好'), protectedValue))
      .toBe('§a你好 %1$s (100%%) \\n')
  })

  it('rejects missing or changed formatting tokens', () => {
    const protectedValue = protectShaderValue('§aHello %s')
    expect(() => restoreShaderValue('你好', protectedValue)).toThrow('formatting token')
    expect(() => restoreShaderValue(protectedValue.text.replace('⟦XMCL0⟧', '⟦XMCL9⟧'), protectedValue))
      .toThrow('formatting token')
  })

  it('skips empty, symbolic and numeric values', () => {
    expect(isTranslatableShaderValue('')).toBe(false)
    expect(isTranslatableShaderValue('§a')).toBe(false)
    expect(isTranslatableShaderValue('12345')).toBe(false)
    expect(isTranslatableShaderValue('§aHello')).toBe(true)
  })

  it('splits entries without losing order', () => {
    const entries = [
      { key: 'a', value: 'one' },
      { key: 'b', value: 'two' },
      { key: 'c', value: 'three' },
    ]
    const batches = splitShaderLangBatches(entries, 20)
    expect(batches.flat()).toEqual(entries)
    expect(batches.length).toBeGreaterThan(1)
  })

  it('builds target languages from launcher locales and dedupes mc codes', () => {
    const targets = getShaderPackTargetLanguages([
      { locale: 'en', name: 'English' },
      { locale: 'en-IN', name: 'English (India)' },
      { locale: 'zh-CN', name: '简体中文' },
      { locale: 'zh-TW', name: '繁體中文' },
    ])
    expect(targets.map(item => item.mcLang)).toEqual(['en_us', 'zh_cn', 'zh_tw'])
    expect(targets[1]).toMatchObject({ label: '简体中文', promptName: 'Simplified Chinese' })
    expect(targets[2]).toMatchObject({ label: '繁體中文', promptName: 'Traditional Chinese' })
  })

  it('resolves prompt language names with fallbacks', () => {
    expect(getShaderPackPromptLanguageName('ja-JP')).toBe('Japanese')
    expect(getShaderPackPromptLanguageName('pt-BR')).toBe('Portuguese (Brazil)')
    // 非法语言标签无法交给 Intl 解析时回退到传入名称
    expect(getShaderPackPromptLanguageName('not a tag', 'Fallback')).toBe('Fallback')
  })

  it('finds a target language by mc code ignoring case', () => {
    const targets = getShaderPackTargetLanguages([{ locale: 'zh-CN', name: '简体中文' }])
    expect(findShaderPackTargetLanguage(targets, 'ZH_CN')?.locale).toBe('zh-CN')
    expect(findShaderPackTargetLanguage(targets, 'ko_kr')).toBeUndefined()
  })

  it('respects the configured maximum entries per batch', () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({
      key: `key${index}`,
      value: `value${index}`,
    }))
    const batches = splitShaderLangBatches(entries, 10_000, 3)
    expect(batches.flat()).toEqual(entries)
    expect(batches.map(batch => batch.length)).toEqual([3, 3, 1])
  })
})
