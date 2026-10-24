import { readFileSync } from 'node:fs'
import { parse as parseTemplate, NodeTypes, type ElementNode, type TemplateChildNode } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

const { descriptor } = parse(readFileSync(new URL('./AppSideBarAccountMenu.vue', import.meta.url), 'utf8'))
const template = parseTemplate(descriptor.template!.content)

function elements(nodes: TemplateChildNode[]): ElementNode[] {
  return nodes.flatMap(node => node.type === NodeTypes.ELEMENT ? [node, ...elements(node.children)] : [])
}

const allNodes = elements(template.children)

describe('AppSideBarAccountMenu', () => {
  it('renders a floating v-menu with proper testids and structure', () => {
    const menu = allNodes.find(node => node.tag === 'v-menu')
    expect(menu).toBeDefined()

    const card = allNodes.find(node => node.tag === 'v-card')
    expect(card).toBeDefined()
    expect(card?.props.some(p => p.type === NodeTypes.ATTRIBUTE && p.name === 'data-testid' && p.value?.content === 'sidebar-account-menu')).toBe(true)

    const accountItem = allNodes.find(node => node.tag === 'v-list-item')
    expect(accountItem).toBeDefined()
    expect(accountItem?.props.some(p => p.type === NodeTypes.ATTRIBUTE && p.name === 'data-testid' && p.value?.content === 'account-item')).toBe(true)

    const addButton = allNodes.find(node => node.tag === 'v-btn' && node.props.some(p => p.type === NodeTypes.ATTRIBUTE && p.name === 'data-testid' && p.value?.content === 'accounts-add'))
    expect(addButton).toBeDefined()

    const closeButton = allNodes.find(node => node.tag === 'v-btn' && node.props.some(p => p.type === NodeTypes.ATTRIBUTE && p.name === 'icon' && p.value?.content === 'close'))
    expect(closeButton?.props.some(p => p.type === NodeTypes.DIRECTIVE && p.name === 'bind' && p.arg?.type === NodeTypes.SIMPLE_EXPRESSION && p.arg.content === 'aria-label' && p.exp?.type === NodeTypes.SIMPLE_EXPRESSION && p.exp.content === "t('shared.close')")).toBe(true)

    const avatar = allNodes.find(node => node.tag === 'PlayerAvatar')
    expect(avatar).toBeDefined()
  })
})
