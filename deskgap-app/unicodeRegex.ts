import type { Plugin } from 'esbuild'
import { readFile } from 'node:fs/promises'
import rewritePattern from 'regexpu-core'
import ts from 'typescript'

export function transformUnicodePropertyRegex(source: string, filename: string): string {
  if (!/\\[pP]\{/.test(source)) return source
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const replacements: { start: number; end: number; text: string }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isRegularExpressionLiteral(node)) {
      const literal = node.text
      const end = literal.lastIndexOf('/')
      const pattern = literal.slice(1, end)
      const flags = literal.slice(end + 1)
      if (flags.includes('u') && /\\[pP]\{/.test(pattern)) {
        replacements.push({
          start: node.getStart(file),
          end: node.end,
          text: `/${rewritePattern(pattern, flags, { unicodePropertyEscapes: 'transform' })}/${flags}`,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  for (const replacement of replacements.reverse()) {
    source = source.slice(0, replacement.start) + replacement.text + source.slice(replacement.end)
  }
  return source
}

export function unicodeRegexPlugin(): Plugin {
  return {
    name: 'deskgap-unicode-regex',
    setup(build) {
      // The published DeskGap Node runtime omits ICU, so property escapes fail even on Node 24.
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/, namespace: 'file' }, async ({ path }) => {
        const source = await readFile(path, 'utf8')
        const contents = transformUnicodePropertyRegex(source, path)
        if (contents === source) return
        const loader = path.endsWith('.tsx') ? 'tsx' : path.endsWith('.jsx') ? 'jsx' : /\.[cm]?ts$/.test(path) ? 'ts' : 'js'
        return { contents, loader }
      })
    },
  }
}
