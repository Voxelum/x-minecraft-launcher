import { describe, expect, it } from 'vitest'
import { parseManifestJson } from './parseManifestJson'

describe('parseManifestJson', () => {
  it('parses plain JSON from a Buffer', () => {
    const buf = Buffer.from('{"foo":"bar"}', 'utf-8')
    expect(parseManifestJson<{ foo: string }>(buf)).toEqual({ foo: 'bar' })
  })

  it('parses JSON from a string', () => {
    expect(parseManifestJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('strips a leading UTF-8 BOM (Buffer)', () => {
    // Telemetry: 0.56.7 readManifest SyntaxError bucket caused by editors
    // writing `\uFEFF{...}` for manifest.json.
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"x":42}', 'utf-8')])
    expect(parseManifestJson<{ x: number }>(buf)).toEqual({ x: 42 })
  })

  it('strips a leading BOM (string)', () => {
    expect(parseManifestJson<{ y: boolean }>('\uFEFF{"y":true}')).toEqual({ y: true })
  })

  it('throws on invalid JSON', () => {
    expect(() => parseManifestJson('{not json')).toThrow(SyntaxError)
  })
})
