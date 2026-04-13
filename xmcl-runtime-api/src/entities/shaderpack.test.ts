import { describe, test, expect } from 'vitest'
import { parseShaderOptions, stringifyShaderOptions } from './shaderpack'

describe('parseShaderOptions', () => {
  test('should parse basic shader options', () => {
    const text = 'shaderPack=BSL_v8.2.01.zip\n'
    const result = parseShaderOptions(text)
    expect(result.shaderPack).toEqual('BSL_v8.2.01.zip')
  })

  test('should decode unicode escapes in shaderPack name', () => {
    // "补全光影" encoded as unicode escapes
    const text = 'shaderPack=\\u8865\\u5168\\u5149\\u5f71.zip\n'
    const result = parseShaderOptions(text)
    expect(result.shaderPack).toEqual('补全光影.zip')
  })

  test('should decode mixed ASCII and unicode escapes', () => {
    const text = 'shaderPack=BSL \\u5149\\u5f71\\u5305 v8.zip\n'
    const result = parseShaderOptions(text)
    expect(result.shaderPack).toEqual('BSL 光影包 v8.zip')
  })

  test('should default to empty string if shaderPack is missing', () => {
    const text = 'oldLighting=false\n'
    const result = parseShaderOptions(text)
    expect(result.shaderPack).toEqual('')
  })

  test('should parse multiple options', () => {
    const text = [
      'shaderPack=SEUS-Renewed-v1.0.1.zip',
      'antialiasingLevel=0',
      'normalMapEnabled=true',
      'specularMapEnabled=true',
      'renderResMul=1.0',
      'shadowResMul=1.0',
      'handDepthMul=0.125',
      'oldLighting=default',
      '',
    ].join('\n')
    const result = parseShaderOptions(text)
    expect(result.shaderPack).toEqual('SEUS-Renewed-v1.0.1.zip')
  })

  test('should skip comment lines', () => {
    const text = '#This is a comment\nshaderPack=test.zip\n'
    const result = parseShaderOptions(text)
    expect(result.shaderPack).toEqual('test.zip')
  })

  test('should skip empty lines', () => {
    const text = '\n\nshaderPack=test.zip\n\n'
    const result = parseShaderOptions(text)
    expect(result.shaderPack).toEqual('test.zip')
  })

  test('should decode Japanese shader pack name', () => {
    // シェーダー = "shader" in Japanese
    const text = 'shaderPack=\\u30b7\\u30a7\\u30fc\\u30c0\\u30fc.zip\n'
    const result = parseShaderOptions(text)
    expect(result.shaderPack).toEqual('シェーダー.zip')
  })
})

describe('stringifyShaderOptions', () => {
  test('should stringify basic options', () => {
    const options = { shaderPack: 'BSL_v8.zip' }
    const result = stringifyShaderOptions(options)
    expect(result).toEqual('shaderPack=BSL_v8.zip\n')
  })

  test('should encode non-ASCII characters to unicode escapes', () => {
    const options = { shaderPack: '补全光影.zip' }
    const result = stringifyShaderOptions(options)
    expect(result).toContain('shaderPack=\\u8865\\u5168\\u5149\\u5f71.zip')
    expect(result).not.toContain('补全光影')
  })

  test('should encode mixed ASCII and non-ASCII', () => {
    const options = { shaderPack: 'BSL 光影包.zip' }
    const result = stringifyShaderOptions(options)
    expect(result).toContain('shaderPack=BSL \\u5149\\u5f71\\u5305.zip')
  })

  test('should end with newline', () => {
    const options = { shaderPack: 'test.zip' }
    const result = stringifyShaderOptions(options)
    expect(result.endsWith('\n')).toBe(true)
  })

  test('should handle empty shaderPack', () => {
    const options = { shaderPack: '' }
    const result = stringifyShaderOptions(options)
    expect(result).toEqual('shaderPack=\n')
  })
})

describe('shaderOptions unicode roundtrip', () => {
  test('should roundtrip ASCII shader pack name', () => {
    const original = { shaderPack: 'SEUS-Renewed-v1.0.1.zip' }
    const text = stringifyShaderOptions(original)
    const parsed = parseShaderOptions(text)
    expect(parsed.shaderPack).toEqual(original.shaderPack)
  })

  test('should roundtrip Chinese shader pack name', () => {
    const original = { shaderPack: '补全光影 - 高性能版.zip' }
    const text = stringifyShaderOptions(original)
    const parsed = parseShaderOptions(text)
    expect(parsed.shaderPack).toEqual(original.shaderPack)
  })

  test('should roundtrip mixed content shader pack name', () => {
    const original = { shaderPack: 'BSL Shaders v8.2 - 光影包测试.zip' }
    const text = stringifyShaderOptions(original)
    const parsed = parseShaderOptions(text)
    expect(parsed.shaderPack).toEqual(original.shaderPack)
  })

  test('should roundtrip multiple options with unicode values', () => {
    const original = {
      shaderPack: '高清光影.zip',
      oldLighting: 'default',
    } as any
    const text = stringifyShaderOptions(original)
    // Verify encoded text doesn't contain raw Chinese
    expect(text).not.toContain('高清光影')
    expect(text).toContain('\\u')
    // Verify roundtrip
    const parsed = parseShaderOptions(text)
    expect(parsed.shaderPack).toEqual('高清光影.zip')
  })
})
