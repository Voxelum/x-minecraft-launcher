import type { AgentUiAction } from '@xmcl/runtime-api'
import type { Router } from 'vue-router'
import type { Ref } from 'vue'

function describeElement(el: Element) {
  const rect = el.getBoundingClientRect()
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    classes: Array.from(el.classList),
    testId: el.getAttribute('data-testid') || undefined,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    childCount: el.childElementCount,
    text: text ? text.slice(0, 80) : undefined,
  }
}

function nodeLabel(el: Element) {
  const id = el.id ? `#${el.id}` : ''
  const classes = Array.from(el.classList).slice(0, 6).map(value => `.${value}`).join('')
  const testId = el.getAttribute('data-testid')
  return `${el.tagName.toLowerCase()}${id}${classes}${testId ? `[data-testid=${testId}]` : ''}`
}

function outline(el: Element, maxDepth: number, depth = 0): unknown {
  if (depth >= maxDepth || !el.childElementCount) return nodeLabel(el)
  const children: unknown[] = Array.from(el.children).slice(0, 12).map(child => outline(child, maxDepth, depth + 1))
  if (el.childElementCount > 12) children.push(`…(+${el.childElementCount - 12} more)`)
  return { node: nodeLabel(el), children }
}

export interface AgentUiContext {
  router: Router
  selectedInstance: Ref<string>
  instances: Readonly<Ref<Array<{ path: string; name: string }>>>
  selectAccount(id: string): void
  confirm?(request: Extract<AgentUiAction, { action: 'confirm' }>, signal?: AbortSignal): Promise<boolean>
}

export function createAgentUiHandler(context: AgentUiContext) {
  return async (input: AgentUiAction, signal?: AbortSignal): Promise<unknown> => {
    if (input.action === 'navigate') {
      await context.router.push(input.path)
      return { ok: true, path: input.path }
    }
    if (input.action === 'select_instance') {
      const exact = context.instances.value.find(instance => instance.path === input.path)
      const named = context.instances.value.filter(instance => instance.name === input.path)
      const instance = exact ?? (named.length === 1 ? named[0] : undefined)
      if (!instance) {
        throw new Error(named.length > 1
          ? `Instance name is ambiguous; use an exact path: ${input.path}`
          : `Unknown instance path or name: ${input.path}`)
      }
      context.selectedInstance.value = instance.path
      return { ok: true, path: instance.path }
    }
    if (input.action === 'select_account') {
      context.selectAccount(input.id)
      return { ok: true, id: input.id }
    }
    if (input.action === 'confirm') {
      if (context.confirm) return context.confirm(input, signal)
      return window.confirm(input.message)
    }
    if (input.action === 'query_dom') {
      const nodes = Array.from(document.querySelectorAll(input.selector))
      const limit = Math.min(Math.max(1, input.limit ?? 10), 50)
      return { total: nodes.length, elements: nodes.slice(0, limit).map(describeElement) }
    }
    if (input.action === 'get_computed_style') {
      const element = document.querySelector(input.selector)
      if (!element) return { error: `no element matches: ${input.selector}` }
      const style = window.getComputedStyle(element)
      const properties = input.properties?.length
        ? input.properties
        : ['color', 'background-color', 'border', 'border-radius', 'padding', 'margin', 'font-size', 'display', 'width', 'height', 'opacity']
      return {
        element: nodeLabel(element),
        styles: Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)])),
      }
    }
    const selector = input.selector || '.v-application'
    const root = document.querySelector(selector)
    if (!root) return { error: `root not found: ${selector}` }
    return { outline: outline(root, Math.min(Math.max(1, input.maxDepth ?? 4), 8)) }
  }
}
