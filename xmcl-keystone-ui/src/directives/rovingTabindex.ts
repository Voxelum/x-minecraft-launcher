import { ObjectDirective } from 'vue'

/**
 * Roving-tabindex directive for ARIA toolbar / listbox-like groups.
 *
 * Bind it to a container element to:
 * - Make the whole group a single Tab stop (only one descendant has
 *   `tabindex="0"`; siblings are kept at `tabindex="-1"`).
 * - Move focus among descendants with Arrow keys / Home / End.
 *
 * Nesting is supported: an inner element bound with the directive becomes
 * its own group, and its descendants are excluded from the outer group's
 * navigation. This lets you have arrow-loops-inside / Tab-jumps-between.
 *
 * Usage:
 *
 *   <div v-roving-tabindex>...</div>                  // both axes, wraps
 *   <div v-roving-tabindex="'horizontal'">...</div>   // arrows: left/right
 *   <div v-roving-tabindex="'vertical'">...</div>     // arrows: up/down
 *   <div v-roving-tabindex="{ orientation: hRef }">  // reactive orientation
 *
 * Skip an individual descendant by giving it `data-roving-skip`.
 */
export type RovingOrientation = 'horizontal' | 'vertical' | 'both'

export interface RovingTabindexOptions {
  orientation?: RovingOrientation
  /** Wrap focus at the ends. Default true. */
  wrap?: boolean
}

type Binding = RovingOrientation | RovingTabindexOptions | undefined

const ROOT_ATTR = 'data-roving-tabindex-root'
const SKIP_ATTR = 'data-roving-skip'
const FOCUSABLE_SELECTOR =
  'button, a[href], [role="button"], input, select, textarea, [tabindex]:not([tabindex="-2"])'

interface Instance {
  options: Required<RovingTabindexOptions>
  onKeydown: (e: KeyboardEvent) => void
  onFocusin: (e: FocusEvent) => void
  observer: MutationObserver | null
}

const instances = new WeakMap<HTMLElement, Instance>()

function normalize(binding: Binding): Required<RovingTabindexOptions> {
  if (!binding) return { orientation: 'both', wrap: true }
  if (typeof binding === 'string') return { orientation: binding, wrap: true }
  return {
    orientation: binding.orientation ?? 'both',
    wrap: binding.wrap ?? true,
  }
}

function isVisible(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  if (el.hasAttribute(SKIP_ATTR)) return false
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false
  return true
}

/**
 * Returns true if `el` belongs to the group rooted at `root`, i.e. there is
 * no nested roving-tabindex root between `el` and `root`.
 */
function belongsToGroup(el: HTMLElement, root: HTMLElement): boolean {
  let cur: HTMLElement | null = el.parentElement
  while (cur && cur !== root) {
    if (cur.hasAttribute(ROOT_ATTR)) return false
    cur = cur.parentElement
  }
  return cur === root
}

function getItems(root: HTMLElement): HTMLElement[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  return nodes.filter((el) => belongsToGroup(el, root) && isVisible(el))
}

function applyRoving(items: HTMLElement[], activeIndex: number) {
  for (let i = 0; i < items.length; i++) {
    items[i].tabIndex = i === activeIndex ? 0 : -1
  }
}

function refresh(root: HTMLElement, focused?: HTMLElement | null) {
  const items = getItems(root)
  if (!items.length) return
  const idx = focused ? items.indexOf(focused) : -1
  applyRoving(items, idx >= 0 ? idx : 0)
}

export const vRovingTabindex: ObjectDirective<HTMLElement, Binding> = {
  mounted(el, binding) {
    const options = normalize(binding.value)
    el.setAttribute(ROOT_ATTR, '')

    function onKeydown(e: KeyboardEvent) {
      const horizontal = options.orientation === 'horizontal' || options.orientation === 'both'
      const vertical = options.orientation === 'vertical' || options.orientation === 'both'
      const isPrev =
        (horizontal && e.key === 'ArrowLeft') || (vertical && e.key === 'ArrowUp')
      const isNext =
        (horizontal && e.key === 'ArrowRight') || (vertical && e.key === 'ArrowDown')
      const isHome = e.key === 'Home'
      const isEnd = e.key === 'End'
      if (!isPrev && !isNext && !isHome && !isEnd) return

      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      // Only handle if the focused element belongs to *this* group (not a
      // nested group). Outer listeners will be skipped via stopPropagation.
      if (!belongsToGroup(target, el)) return

      const items = getItems(el)
      if (!items.length) return
      const current = document.activeElement as HTMLElement | null
      const index = current ? items.indexOf(current) : -1
      let next = index
      if (isPrev) next = index <= 0 ? (options.wrap ? items.length - 1 : 0) : index - 1
      else if (isNext) next = index === -1 || index >= items.length - 1 ? (options.wrap ? 0 : items.length - 1) : index + 1
      else if (isHome) next = 0
      else if (isEnd) next = items.length - 1
      if (next !== index) {
        e.preventDefault()
        e.stopPropagation()
        items[next].focus()
      }
    }

    function onFocusin(e: FocusEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (!belongsToGroup(target, el)) return
      const items = getItems(el)
      const idx = items.indexOf(target)
      if (idx >= 0) applyRoving(items, idx)
    }

    el.addEventListener('keydown', onKeydown)
    el.addEventListener('focusin', onFocusin)

    const observer = new MutationObserver(() => {
      const active = document.activeElement as HTMLElement | null
      const focused = active && belongsToGroup(active, el) ? active : null
      refresh(el, focused)
    })
    observer.observe(el, { childList: true, subtree: true })

    instances.set(el, { options, onKeydown, onFocusin, observer })

    // Seed initial tabindex state after the DOM settles.
    queueMicrotask(() => refresh(el, null))
  },

  updated(el, binding) {
    const inst = instances.get(el)
    if (!inst) return
    inst.options = normalize(binding.value)
  },

  unmounted(el) {
    const inst = instances.get(el)
    if (!inst) return
    el.removeEventListener('keydown', inst.onKeydown)
    el.removeEventListener('focusin', inst.onFocusin)
    inst.observer?.disconnect()
    el.removeAttribute(ROOT_ATTR)
    instances.delete(el)
  },
}
