import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { transformUnicodePropertyRegex, unicodeRegexPlugin } from './unicodeRegex'

const root = dirname(fileURLToPath(import.meta.url))

describe('DeskGap ICU-free Unicode regular expressions', () => {
  it('preserves quest title cleanup without ICU-dependent property escapes', async () => {
    const source = await readFile(join(root, '..', 'xmcl-runtime', 'save', 'progress.ts'), 'utf8')
    const pattern = source.match(/\.replace\((\/\^\[.*\/u), ''\)/)?.[1]
    expect(pattern).toBeDefined()
    const original = runInNewContext(pattern!)
    const transformed = transformUnicodePropertyRegex(pattern!, 'title.js')
    expect(transformed).not.toMatch(/\\[pP]\{/)
    expect([...transformed].every(character => character.codePointAt(0)! <= 0x7f)).toBe(true)
    const compatible = runInNewContext(transformed)
    for (const title of [
      '\u{1f680} - Getting Started',
      '\u2605 \u00a9 - Technology',
      '\u{1f1e8}\u{1f1f3} - \u5165\u95e8',
      '123 - Chapter',
      '!! - Chapter',
      'Plain - Chapter',
      '\u5165\u95e8 - Chapter',
      ' \t- Chapter',
      '\u{1f680} Chapter',
      '',
    ]) {
      expect(title.replace(compatible, '')).toBe(title.replace(original, ''))
    }
  })

  it('rewrites multiple literals, complements and flags, but not strings or comments', () => {
    const source = `
      // /\\p{Emoji}/u
      const text = "\\\\p{Emoji}"
      const emoji = /\\p{Emoji}/gu
      const nonLetter = /\\P{Letter}/u
      const punctuation = /[\\p{Punctuation}/]/iu
      const slash = /\\//g
      globalThis.result = { text, emoji, nonLetter, punctuation, slash }
    `
    const transformed = transformUnicodePropertyRegex(source, 'fixture.ts')
    expect(transformed).toContain('// /\\p{Emoji}/u')
    expect(transformed).toContain('const text = "\\\\p{Emoji}"')
    const { result } = runInNewContext(transformed + '; globalThis')
    expect(result.text).toBe('\\p{Emoji}')
    expect(result.emoji.flags).toBe('gu')
    expect(result.emoji.test('\u{1f680}')).toBe(true)
    expect(result.nonLetter.test('\u5165')).toBe(false)
    expect(result.nonLetter.test('!')).toBe(true)
    expect(result.punctuation.flags).toBe('iu')
    expect(result.punctuation.test('/')).toBe(true)
    expect(result.slash.source).toBe('\\/')
  })

  it('leaves unrelated source unchanged', () => {
    const source = 'export const pattern = /[a-z]+/gi'
    expect(transformUnicodePropertyRegex(source, 'fixture.ts')).toBe(source)
  })

  it('lowers dependency literals in production bundles and rejects invalid properties', async () => {
    const options = {
      bundle: true,
      write: false,
      minify: true,
      charset: 'ascii' as const,
      platform: 'node' as const,
      format: 'cjs' as const,
      target: 'node20',
      plugins: [unicodeRegexPlugin()],
    }
    const result = await build({
      ...options,
      stdin: {
        contents: 'export { cleanTitle } from "./xmcl-runtime/save/progress"',
        resolveDir: join(root, '..'),
      },
    })
    const code = result.outputFiles[0].text
    expect(transformUnicodePropertyRegex(code, 'bundle.cjs')).toBe(code)
    expect([...code].every(character => character.codePointAt(0)! <= 0x7f)).toBe(true)
    expect(() => transformUnicodePropertyRegex('/\\p{NotAProperty}/u', 'bad.js')).toThrow()
  })
})
