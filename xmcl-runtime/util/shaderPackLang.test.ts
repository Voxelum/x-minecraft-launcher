import { describe, expect, it } from 'vitest'
import {
  decodeShaderLangFile,
  mergeShaderLang,
  fillMissingShaderLang,
  parseShaderLang,
  assertCompleteTranslations,
} from './shaderPackLang'

describe('shaderPackLang', () => {
  it('preserves existing translations, including empty values, even if the client submits replacements', () => {
    const source = parseShaderLang('a=Apple\nb=Banana\nc=Cherry\n')
    const target = parseShaderLang('# Official\na=苹果\nb=\nextra=手工\n')
    expect(fillMissingShaderLang(source, target, [
      { key: 'a', value: '覆盖苹果' }, { key: 'b', value: '覆盖空值' }, { key: 'c', value: '樱桃' },
    ])).toEqual({ content: '# Official\na=苹果\nb=\nextra=手工\nc=樱桃\n', written: 1 })
    expect(fillMissingShaderLang(source, source, [])).toBeUndefined()
    expect(() => fillMissingShaderLang(source, target, [])).toThrow(/Missing translation for key: c/)
  })

  it('parses comments, CRLF, empty values and extra equals signs', () => {
    const content = '# comment\r\nprofile.POTATO=§aPotato\r\nempty=\r\nurl=https://example.com/a=b\r\n'
    const parsed = parseShaderLang(content)

    expect(parsed.eol).toBe('\r\n')
    expect(parsed.hasFinalNewline).toBe(true)
    expect(parsed.bom).toBe(false)
    expect(parsed.entries).toEqual([
      { key: 'profile.POTATO', value: '§aPotato' },
      { key: 'empty', value: '' },
      { key: 'url', value: 'https://example.com/a=b' },
    ])
    expect(parsed.lines[0].kind).toBe('comment')
    expect(parsed.lines[1].kind).toBe('entry')
  })

  it('keeps BOM and detects LF without final newline', () => {
    const parsed = parseShaderLang('\uFEFFa=1\nb=2')
    expect(parsed.bom).toBe(true)
    expect(parsed.eol).toBe('\n')
    expect(parsed.hasFinalNewline).toBe(false)
  })

  it('collapses duplicated keys with the same value and keeps the first of conflicts', () => {
    const parsed = parseShaderLang('a=1\na=1\na=2\n')
    expect(parsed.entries).toEqual([{ key: 'a', value: '1' }])
  })

  it('rejects invalid UTF-8', () => {
    // 0xFF 不是合法 UTF-8 起始字节
    expect(() => decodeShaderLangFile(new Uint8Array([0xff, 0xfe]))).toThrow(/UTF-8/)
    expect(decodeShaderLangFile(new Uint8Array([0x61, 0x3d, 0x62]))).toBe('a=b')
  })

  it('replaces values while keeping comments, spacing and line endings', () => {
    const template = parseShaderLang('# keep me\r\n  key =  value  \r\nother=1\r\n')
    const merged = mergeShaderLang(template, new Map([['key', '译文']]), [{ key: 'key', value: 'value' }])

    expect(merged).toBe('# keep me\r\n  key =  译文  \r\nother=1\r\n')
  })

  it('appends keys missing in the template and follows the final newline rule', () => {
    const template = parseShaderLang('a=1')
    const merged = mergeShaderLang(template, new Map([['a', 'A'], ['b', 'B']]), [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ])

    expect(merged).toBe('a=A\nb=B')
  })

  it('keeps target-only keys when the target file is the template', () => {
    const template = parseShaderLang('# target\na=1\nmanual=keep\n')
    const merged = mergeShaderLang(template, new Map([['a', 'A'], ['b', 'B']]), [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ])

    expect(merged).toBe('# target\na=A\nmanual=keep\nb=B\n')
  })

  it('requires a translation for every non-empty source value', () => {
    const source = [
      { key: 'a', value: '1' },
      { key: 'b', value: '' },
    ]
    expect(assertCompleteTranslations(source, [{ key: 'a', value: 'A' }])).toEqual(new Map([['a', 'A']]))
    expect(() => assertCompleteTranslations(source, [])).toThrow(/Missing translation/)
    expect(() => assertCompleteTranslations(source, [{ key: 'x', value: 'X' }])).toThrow(/Unexpected/)
    expect(() => assertCompleteTranslations(source, [{ key: 'a', value: 'A' }, { key: 'a', value: 'B' }]))
      .toThrow(/Duplicated/)
  })
})
