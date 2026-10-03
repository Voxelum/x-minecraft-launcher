import { describe, expect, it } from 'vitest'
import { useMarkdown } from './markdown'

describe('launcher markdown', () => {
  const { render } = useMarkdown()

  it('preserves formatted descriptions and external link attributes', () => {
    const html = render('# Release\n\n**Important** [details](https://example.com/notes)\n\n```json\n{"version":1}\n```')
    expect(html).toContain('<h1>Release</h1>')
    expect(html).toContain('<strong>Important</strong>')
    expect(html).toContain('href="https://example.com/notes"')
    expect(html).toContain('target="browser"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('class="language-json"')
  })

  it('keeps linkified URLs in order alongside emphasized content', () => {
    const html = render('https://example.com/one **two** https://example.com/three')
    expect([...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]))
      .toEqual(['https://example.com/one', 'https://example.com/three'])
    expect(html).toContain('<strong>two</strong>')
  })

  it.each(['http://localhost/test', 'file:///tmp/example', '/relative'])('does not activate unsupported link %s', (url) => {
    expect(render(`[details](${url})`)).not.toContain('<a ')
  })

  it('encodes a literal backslash preceding the link destination terminator', () => {
    expect(render('[details](https://example.com/path\\ )'))
      .toContain('href="https://example.com/path%5C"')
  })

  it('retains linked badge markup and ordinary images', () => {
    const html = render('[![badge](https://example.com/badge.svg)](https://example.com)\n\n![preview](https://example.com/preview.png)')
    expect(html).toContain('alt="badge"')
    expect(html).toContain('alt="preview"')
    expect(html).toContain('href="https://example.com"')
  })
})
