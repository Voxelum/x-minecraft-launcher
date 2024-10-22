import MarkdownIt from 'markdown-it'
// @ts-ignore
import attr from 'markdown-it-link-attributes'
import Token from 'markdown-it/lib/token'

export function useMarkdown() {
  const md = new MarkdownIt({
    html: true,
    typographer: true,
    linkify: true,
  })

  const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    const hrefIndex = token.attrIndex('href')

    if (hrefIndex >= 0) {
      const href = token.attrs?.[hrefIndex][1]

      if (!isValidLink(href)) {
        const spanToken = new Token('span_open', 'span', 1)
        spanToken.block = false
        tokens[idx] = spanToken

        for (let i = idx + 1; i < tokens.length; i++) {
          if (tokens[i].type === 'link_close') {
            const spanCloseToken = new Token('span_close', 'span', -1)
            spanCloseToken.block = false
            tokens[i] = spanCloseToken
            break
          }
        }
      }
    }

    return defaultRender(tokens, idx, options, env, self)
  }

  function isValidLink(href: string | undefined) {
    if (!href) return false
    try {
      const url = new URL(href)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
      if (url.hostname === 'localhost') return false
      return true
    } catch {
      return false
    }
  }

  md.use(attr, {
    attrs: {
      target: 'browser',
      rel: 'noopener noreferrer',
    },
  })

  const render = (t: string) => md.render(t)

  return {
    render,
  }
}
