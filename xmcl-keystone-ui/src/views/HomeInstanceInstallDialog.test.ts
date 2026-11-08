import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

const template = parse(readFileSync(new URL('./HomeInstanceInstallDialog.vue', import.meta.url), 'utf8')).descriptor.template!.content

// These flex constraints are intentional: the scroll body must shrink, but the
// virtualized tree's wrapper must retain its full height to create overflow.
describe('instance update dialog scroll layout', () => {
  it('lets the scroll body shrink within the viewport-bounded card', () => {
    expect(template).toMatch(/<v-card class="[^"]*max-h-\[90vh\][^"]*overflow-hidden/)
    expect(template).toMatch(/ref="scrollRef"\s+class="[^"]*min-h-0[^"]*overflow-y-auto/)
  })

  it('does not shrink and clip the virtualized file tree wrapper', () => {
    expect(template).toMatch(/<div class="[^"]*shrink-0[^"]*overflow-hidden">\s*<InstanceManifestFileTree/)
  })

  it('keeps the header and action bar from shrinking with a long list', () => {
    expect(template).toMatch(/class="[^"]*shrink-0[^"]*border-b border-white\/5"/)
    expect(template).toMatch(/class="[^"]*shrink-0[^"]*border-t border-white\/5/)
  })
})
