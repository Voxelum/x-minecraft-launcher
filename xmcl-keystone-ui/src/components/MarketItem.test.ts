import { readFileSync } from 'node:fs'
import { parse as parseTemplate, NodeTypes, type ElementNode, type TemplateChildNode } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

const { descriptor } = parse(readFileSync(new URL('./MarketItem.vue', import.meta.url), 'utf8'))
const template = parseTemplate(descriptor.template!.content)

function elements(nodes: TemplateChildNode[]): ElementNode[] {
  return nodes.flatMap(node => node.type === NodeTypes.ELEMENT ? [node, ...elements(node.children)] : [])
}

const nodes = elements(template.children)
const prepend = nodes.find(node => node.tag === 'template' && node.props.some(prop =>
  prop.type === NodeTypes.DIRECTIVE && prop.name === 'slot' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === 'prepend',
))!

// Guard the shared template used by mods, resource packs and shader packs.
// Actual Vuetify layout/interaction is additionally checked in the dev launcher.
describe('MarketItem selection template', () => {
  it('keeps the thumbnail avatar alongside, rather than instead of, the selection checkbox', () => {
    const children = prepend.children.filter((node): node is ElementNode => node.type === NodeTypes.ELEMENT)
    const selection = children.find(node => elements(node.children).some(child => child.tag === 'v-checkbox-btn'))!
    const avatar = children.find(node => node.tag === 'v-avatar')!
    expect(selection).toBeDefined()
    expect(avatar).toBeDefined()
    expect(selection).not.toBe(avatar)
    expect(elements(avatar.children).some(node => node.tag === 'img')).toBe(true)
    expect(avatar.props.filter(prop => prop.type === NodeTypes.DIRECTIVE && ['if', 'else', 'else-if'].includes(prop.name))).toEqual([])
  })

  it('leaves selection activation on the row, without a second focusable checkbox', () => {
    const checkbox = nodes.find(node => node.tag === 'v-checkbox-btn')!
    expect(checkbox.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: NodeTypes.ATTRIBUTE, name: 'tabindex', value: expect.objectContaining({ content: '-1' }) }),
      expect.objectContaining({ type: NodeTypes.ATTRIBUTE, name: 'readonly' }),
    ]))
    const row = nodes.find(node => node.tag === 'v-list-item')!
    expect(row.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === 'aria-selected')).toBe(true)
  })
})
