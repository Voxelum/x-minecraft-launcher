import MarkdownIt from 'markdown-it'
// @ts-ignore
import attr from 'markdown-it-link-attributes'

export function useMarkdown() {
  const md = new MarkdownIt({
    html: true,
    typographer: true,
    linkify: true,
  })
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
