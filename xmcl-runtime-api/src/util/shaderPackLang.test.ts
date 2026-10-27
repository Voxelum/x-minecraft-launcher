import { describe, expect, it } from 'vitest'
import { shaderPackTargetPath, toShaderPackMcLang } from './shaderPackLang'

describe('toShaderPackMcLang', () => {
  it('normalizes launcher locale codes to Minecraft codes', () => {
    expect(toShaderPackMcLang('zh-CN')).toBe('zh_cn')
    expect(toShaderPackMcLang('zh-TW')).toBe('zh_tw')
    expect(toShaderPackMcLang('ja-JP')).toBe('ja_jp')
    expect(toShaderPackMcLang('pt-BR')).toBe('pt_br')
    expect(toShaderPackMcLang('ko')).toBe('ko_kr')
    expect(toShaderPackMcLang('kz')).toBe('kk_kz')
  })

  it('keeps region specific mappings stable', () => {
    expect(toShaderPackMcLang('en-IN')).toBe('en_us')
    expect(toShaderPackMcLang('ar-EG')).toBe('ar_sa')
    expect(toShaderPackMcLang('ar')).toBe('ar_sa')
  })
})

describe('shaderPackTargetPath', () => {
  it('follows the source file region casing', () => {
    expect(shaderPackTargetPath('shaders/lang/en_US.lang', 'zh_cn')).toBe('shaders/lang/zh_CN.lang')
    expect(shaderPackTargetPath('shaders/lang/en_us.lang', 'zh_cn')).toBe('shaders/lang/zh_cn.lang')
    expect(shaderPackTargetPath('lang/en_US.lang', 'ja_jp')).toBe('lang/ja_JP.lang')
  })

  it('reuses an existing path with different casing', () => {
    expect(shaderPackTargetPath('shaders/lang/en_US.lang', 'zh_cn', ['shaders/lang/zh_cn.lang']))
      .toBe('shaders/lang/zh_cn.lang')
  })

  it('supports any target language', () => {
    expect(shaderPackTargetPath('shaders/lang/en_US.lang', 'ru_ru')).toBe('shaders/lang/ru_RU.lang')
    expect(shaderPackTargetPath('shaders/lang/en_US.lang', 'zh-HK')).toBe('shaders/lang/zh_HK.lang')
  })
})
