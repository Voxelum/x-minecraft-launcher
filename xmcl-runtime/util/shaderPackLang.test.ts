import { describe, expect, it } from 'vitest'
import { mergeShaderPackLang, parseShaderPackLang } from './shaderPackLang'

const bom = Buffer.from([0xef, 0xbb, 0xbf])

describe('shaderPackLang', () => {
  it('parses comments, CRLF, BOM, empty values and equals in values', () => {
    const buffer = Buffer.concat([
      bom,
      Buffer.from('# header\r\n\r\nprofile.POTATO=§aPotato\r\nempty=\r\nurl=https://example.com/a=b\r\n', 'utf8'),
    ])
    const parsed = parseShaderPackLang(buffer)

    expect(parsed.bom).toBe(true)
    expect(parsed.eol).toBe('\r\n')
    expect(parsed.entries).toEqual([
      { key: 'profile.POTATO', value: '§aPotato' },
      { key: 'empty', value: '' },
      { key: 'url', value: 'https://example.com/a=b' },
    ])
  })

  it('preserves comments, BOM and line endings when replacing values', () => {
    const parsed = parseShaderPackLang(Buffer.from('# note\r\nkey=English\r\n', 'utf8'))
    const output = mergeShaderPackLang(parsed, undefined, { key: '中文' }).toString('utf8')

    expect(output).toBe('# note\r\nkey=中文\r\n')
  })

  it('uses an existing target as the template and appends missing source keys', () => {
    const source = parseShaderPackLang(Buffer.from('a=One\nb=Two\n', 'utf8'))
    const target = parseShaderPackLang(Buffer.from('# existing\nb=旧值\nkeep=保留\n', 'utf8'))
    const output = mergeShaderPackLang(source, target, { a: '一', b: '二' })
    const reparsed = parseShaderPackLang(output)

    expect(output.toString('utf8')).toContain('# existing\n')
    expect(reparsed.entries).toEqual([
      { key: 'b', value: '二' },
      { key: 'keep', value: '保留' },
      { key: 'a', value: '一' },
    ])
  })

  it('rejects duplicate keys', () => {
    expect(() => parseShaderPackLang(Buffer.from('a=1\na=2\n'))).toThrow('Duplicate')
  })

  it('rejects missing translations for non-empty values', () => {
    const parsed = parseShaderPackLang(Buffer.from('a=One\nb=Two\n'))
    expect(() => mergeShaderPackLang(parsed, undefined, { a: '一' })).toThrow('Missing')
  })

  it('rejects invalid UTF-8', () => {
    expect(() => parseShaderPackLang(Buffer.from([0xff, 0xfe, 0xfd]))).toThrow('UTF-8')
  })
})
