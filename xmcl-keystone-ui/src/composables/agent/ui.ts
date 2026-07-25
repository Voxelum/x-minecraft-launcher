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
    // The wire schema is a flat object (see actionObjectSchema), so per-action
    // required fields are not enforced by the provider and must be checked here.
    const required = (value: string | undefined, field: string) => {
      const trimmed = typeof value === 'string' ? value.trim() : ''
      if (!trimmed) throw new Error(`"${field}" is required for the "${input.action}" action`)
      return trimmed
    }
    if (input.action === 'navigate') {
      const path = required(input.path, 'path')
      await context.router.push(path)
      return { ok: true, path }
    }
    if (input.action === 'select_instance') {
      const target = required(input.path, 'path')
      const exact = context.instances.value.find(instance => instance.path === target)
      const named = context.instances.value.filter(instance => instance.name === target)
      const instance = exact ?? (named.length === 1 ? named[0] : undefined)
      if (!instance) {
        throw new Error(named.length > 1
          ? `Instance name is ambiguous; use an exact path: ${target}`
          : `Unknown instance path or name: ${target}`)
      }
      context.selectedInstance.value = instance.path
      return { ok: true, path: instance.path }
    }
    if (input.action === 'select_account') {
      const id = required(input.id, 'id')
      context.selectAccount(id)
      return { ok: true, id }
    }
    if (input.action === 'confirm') {
      required(input.message, 'message')
      if (context.confirm) return context.confirm(input, signal)
      return window.confirm(input.message)
    }
    if (input.action === 'query_dom') {
      const selector = required(input.selector, 'selector')
      const nodes = Array.from(document.querySelectorAll(selector))
      const limit = Math.min(Math.max(1, input.limit ?? 10), 50)
      return { total: nodes.length, elements: nodes.slice(0, limit).map(describeElement) }
    }
    if (input.action === 'get_computed_style') {
      const target = required(input.selector, 'selector')
      const element = document.querySelector(target)
      if (!element) return { error: `no element matches: ${target}` }
      const style = window.getComputedStyle(element)
      const properties = input.properties?.length
        ? input.properties
        : ['color', 'background-color', 'border', 'border-radius', 'padding', 'margin', 'font-size', 'display', 'width', 'height', 'opacity']
      return {
        element: nodeLabel(element),
        styles: Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)])),
      }
    }
    if (input.action !== 'get_dom_outline') {
      throw new Error(`Unknown ui action: ${(input as { action: string }).action}`)
    }
    const selector = input.selector || '.v-application'
    const root = document.querySelector(selector)
    if (!root) return { error: `root not found: ${selector}` }
    return { outline: outline(root, Math.min(Math.max(1, input.maxDepth ?? 4), 8)) }
  }
}
