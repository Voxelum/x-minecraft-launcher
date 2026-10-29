import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('lets the preview follow its split pane instead of clipping a 320px canvas at minimum window height', () => {
  const source = readFileSync(new URL('./BlueprintPreview.vue', import.meta.url), 'utf8')
  const style = source.match(/\.blueprint-preview \{([^}]+)\}/)?.[1]
  expect(style).toMatch(/height:\s*100%/)
  expect(style).toMatch(/min-height:\s*0;/)
  expect(style).not.toMatch(/min-height:\s*\d+px/)
  expect(source).toContain('resizeObserver.observe(el)')
})
