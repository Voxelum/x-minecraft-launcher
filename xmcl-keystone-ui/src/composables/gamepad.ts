import { useGamepad as useBrowserGamepad, createGlobalState, useLocalStorage } from '@vueuse/core'
import { computed, isRef, onScopeDispose, ref, watch, type InjectionKey, type Ref } from 'vue'

/**
 * All gamepad control logic lives here so it can be shared across views and
 * kept out of `.vue` files. It covers:
 * - controller model / label detection
 * - the `requestAnimationFrame` polling loop and button edge detection
 * - accessible spatial focus navigation (D-Pad / stick)
 * - focus restoration when overlays open and close
 */

export type GamepadType = 'xbox' | 'steamdeck' | 'ps5' | 'ps4' | 'ps3' | 'ps2'

/** W3C "Standard Gamepad" button indices. */
export const GamepadButtonIndex = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  Select: 8,
  Start: 9,
  L3: 10,
  R3: 11,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
} as const

const PLAYSTATION_TYPES: GamepadType[] = ['ps5', 'ps4', 'ps3', 'ps2']

export function isPlayStationType(type: GamepadType) {
  return PLAYSTATION_TYPES.includes(type)
}

export function detectGamepadType(id: string): GamepadType {
  const s = id.toLowerCase()
  if (s.includes('steam deck') || s.includes('valve') || s.includes('neptune')) return 'steamdeck'
  if (s.includes('ps5') || s.includes('dualsense') || s.includes('054c:0ce6')) return 'ps5'
  if (s.includes('ps4') || s.includes('dualshock 4') || s.includes('054c:05c4') || s.includes('054c:09cc')) return 'ps4'
  if (s.includes('ps3') || s.includes('dualshock 3') || s.includes('sony playstation 3')) return 'ps3'
  if (s.includes('ps2') || s.includes('playstation 2') || s.includes('twin usb joystick')) return 'ps2'
  if (s.includes('sony') || s.includes('playstation') || s.includes('dualshock') || s.includes('wireless controller')) return 'ps5'
  return 'xbox'
}

export function cleanGamepadName(id: string): string {
  return id
    .replace(/\s*\(Vendor:.*?\)/i, '')
    .replace(/\s*\(Input:.*?\)/i, '')
    .replace(/\s*\(Standard\s*Gamepad\)/i, '')
    .trim()
}

export interface GamepadLabels {
  /** Bottom face button. */
  confirm: string
  /** Right face button. */
  cancel: string
  /** Top face button. */
  keyboard: string
  /** Left face button. */
  backspace: string
  /** Upper shoulder buttons (L1/R1). */
  bumpers: string
  /** Lower shoulder buttons / triggers (L2/R2). */
  triggers: string
  back: string
  menu: string
}

export function getGamepadLabels(type: GamepadType): GamepadLabels {
  switch (type) {
    case 'steamdeck':
      return { confirm: 'A', cancel: 'B', keyboard: 'Y', backspace: 'X', bumpers: 'L1/R1', triggers: 'L2/R2', back: 'View', menu: 'Menu' }
    case 'ps5':
      return { confirm: '✕', cancel: '◯', keyboard: '△', backspace: '▢', bumpers: 'L1/R1', triggers: 'L2/R2', back: 'Create', menu: 'Options' }
    case 'ps4':
      return { confirm: '✕', cancel: '◯', keyboard: '△', backspace: '▢', bumpers: 'L1/R1', triggers: 'L2/R2', back: 'Share', menu: 'Options' }
    case 'ps3':
    case 'ps2':
      return { confirm: '✕', cancel: '◯', keyboard: '△', backspace: '▢', bumpers: 'L1/R1', triggers: 'L2/R2', back: 'Select', menu: 'Start' }
    default:
      return { confirm: 'A', cancel: 'B', keyboard: 'Y', backspace: 'X', bumpers: 'LB/RB', triggers: 'LT/RT', back: 'Back', menu: '☰' }
  }
}

interface GamepadRumbleOptions {
  /** Effect length in milliseconds. */
  duration?: number
  /** Low-frequency (heavy) motor intensity, 0..1. */
  strongMagnitude?: number
  /** High-frequency (light) motor intensity, 0..1. */
  weakMagnitude?: number
}

/**
 * Fire a short rumble on the first connected controller that exposes a haptic
 * actuator. It is a best-effort no-op when no gamepad is present or the pad has
 * no vibration support, so callers can invoke it unconditionally to add tactile
 * feedback to visual error cues (e.g. the unsaved-changes shake, the
 * EULA-required shake).
 */
export function vibrateGamepad(options?: GamepadRumbleOptions) {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return
  const { duration = 200, strongMagnitude = 0.6, weakMagnitude = 0.35 } = options ?? {}
  for (const pad of navigator.getGamepads()) {
    if (!pad) continue
    const actuator = (pad as Gamepad & { vibrationActuator?: { playEffect?: (type: string, params: object) => Promise<unknown> } }).vibrationActuator
    if (actuator && typeof actuator.playEffect === 'function') {
      actuator.playEffect('dual-rumble', { duration, strongMagnitude, weakMagnitude }).catch(() => { })
      return
    }
    // Legacy Chromium haptics fallback.
    const legacy = (pad as Gamepad & { hapticActuators?: Array<{ pulse?: (value: number, duration: number) => Promise<unknown> }> }).hapticActuators
    if (legacy && legacy[0] && typeof legacy[0].pulse === 'function') {
      legacy[0].pulse(Math.max(strongMagnitude, weakMagnitude), duration).catch(() => { })
      return
    }
  }
}

/**
 * One shared vueuse gamepad instance for the whole app: a single
 * `requestAnimationFrame` poll loop, one pair of connect/disconnect listeners
 * and one reactive `gamepads` array. It is created in a detached scope
 * (`createGlobalState`) so it lives for the app's lifetime no matter which
 * component or composable touches it first. Every consumer of {@link useGamepad}
 * shares it, so the Gamepad API is never polled twice.
 */
const useSharedGamepads = createGlobalState(() => useBrowserGamepad())

/** The pad we treat as "the controller": a standard-mapped one, else the first. */
function pickGamepad(pads: readonly Gamepad[]): Gamepad | undefined {
  return pads.find((g) => g.mapping === 'standard') ?? pads[0]
}

/* ------------------------ contextual X / Y actions ------------------------- */

/** The two contextual face buttons a page can bind (X = left, Y = top). */
export type GamepadFaceButton = 'X' | 'Y'

type Gettable<T> = T | Ref<T> | (() => T)
function toGetter<T>(v: Gettable<T>): () => T {
  if (isRef(v)) return () => v.value
  if (typeof v === 'function') return v as () => T
  return () => v
}

interface GamepadActionRegistration {
  id: number
  button: GamepadFaceButton
  label: () => string
  disabled: () => boolean
  handler: () => void
  priority: number
}

// Module level registry so any page can register without prop/inject plumbing.
// There is a single gamepad driver per window, so a singleton is sufficient.
// A plain array is enough: it is only read imperatively inside the poll loop.
const gamepadActions: GamepadActionRegistration[] = []
let gamepadActionSeq = 0

/** The active registration for a button: highest priority, then most recent. */
function topGamepadAction(button: GamepadFaceButton): GamepadActionRegistration | undefined {
  let best: GamepadActionRegistration | undefined
  for (const a of gamepadActions) {
    if (a.button !== button || a.disabled()) continue
    if (!best || a.priority > best.priority || (a.priority === best.priority && a.id > best.id)) {
      best = a
    }
  }
  return best
}

export interface GamepadActionOptions {
  /** Hint text shown in the footer. Pass a string, ref or getter. */
  label: Gettable<string>
  /** Invoked when the button is pressed while this page owns the action. */
  handler: () => void
  /** When truthy the action is inactive and its hint hidden. */
  disabled?: Gettable<boolean>
  /** Higher wins when several components bind the same button. App-wide
   *  defaults use a negative priority so any page override takes precedence. */
  priority?: number
}

/**
 * Register a contextual X / Y action for the current component, à la a hotkey.
 * The most recently mounted component owns the button, and the binding is
 * removed automatically when the component unmounts.
 */
export function useGamepadAction(button: GamepadFaceButton, options: GamepadActionOptions) {
  const id = ++gamepadActionSeq
  const registration: GamepadActionRegistration = {
    id,
    button,
    label: toGetter(options.label),
    disabled: options.disabled !== undefined ? toGetter(options.disabled) : () => false,
    handler: options.handler,
    priority: options.priority ?? 0,
  }
  gamepadActions.push(registration)
  const unregister = () => {
    const i = gamepadActions.findIndex((a) => a.id === id)
    if (i >= 0) gamepadActions.splice(i, 1)
  }
  onScopeDispose(unregister)
  return { unregister }
}

/* --------------------------- inner navigation (L2/R2) ---------------------- */

// Page-defined "inner" prev/next navigation bound to the triggers (L2/R2). E.g.
// the home pages cycle among instance tabs; the base-setting page cycles its
// tabs. Same priority model as useGamepadAction: highest priority, then latest.
interface GamepadInnerNavRegistration {
  id: number
  handler: (direction: 'prev' | 'next') => void
  disabled: () => boolean
  priority: number
}

const gamepadInnerNavs: GamepadInnerNavRegistration[] = []
let gamepadInnerNavSeq = 0

function topGamepadInnerNav(): GamepadInnerNavRegistration | undefined {
  let best: GamepadInnerNavRegistration | undefined
  for (const a of gamepadInnerNavs) {
    if (a.disabled()) continue
    if (!best || a.priority > best.priority || (a.priority === best.priority && a.id > best.id)) {
      best = a
    }
  }
  return best
}

export interface GamepadInnerNavOptions {
  /** Move within the page's group. */
  handler: (direction: 'prev' | 'next') => void
  /** When truthy the binding is inactive. */
  disabled?: Gettable<boolean>
  priority?: number
}

/**
 * Bind the triggers (L2 / R2) to page-local prev/next navigation. Auto-registers
 * for the current component and removes itself on unmount.
 */
export function useGamepadInnerNav(options: GamepadInnerNavOptions) {
  const id = ++gamepadInnerNavSeq
  const registration: GamepadInnerNavRegistration = {
    id,
    handler: options.handler,
    disabled: options.disabled !== undefined ? toGetter(options.disabled) : () => false,
    priority: options.priority ?? 0,
  }
  gamepadInnerNavs.push(registration)
  const unregister = () => {
    const i = gamepadInnerNavs.findIndex((a) => a.id === id)
    if (i >= 0) gamepadInnerNavs.splice(i, 1)
  }
  onScopeDispose(unregister)
  return { unregister }
}

/* ----------------------------- focus navigation ---------------------------- */

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), .v-list-item, .v-tab, .v-card--link, [role="button"], .cursor-pointer, .v-field, .v-selection-control, .v-switch, [data-gamepad-focusable]'

function isElementVisible(el: HTMLElement): boolean {
  // Prefer the native visibility check — it evaluates display / visibility /
  // opacity / content-visibility across ancestors in one optimized call, so we
  // avoid an O(depth) `getComputedStyle` walk per element. Falls back to a
  // single `getComputedStyle` where `checkVisibility` is unavailable.
  if (typeof el.checkVisibility === 'function') {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
  } else {
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  }
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * Resolve the container that gamepad focus navigation should be scoped to.
 * When an explicit root is provided (e.g. an open dialog) it wins; otherwise
 * the top-most visible overlay that has focusable children is used, falling
 * back to the whole document.
 */
function resolveNavigationRoot(explicit?: HTMLElement | null): Document | HTMLElement {
  if (explicit) return explicit

  const overlays = Array.from(document.querySelectorAll<HTMLElement>('.v-overlay__content, .v-dialog'))
  const visibleOverlays = overlays.filter((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    return el.querySelectorAll(FOCUSABLE_SELECTOR).length > 0
  })

  if (visibleOverlays.length > 0) return visibleOverlays[visibleOverlays.length - 1]
  return document
}

export function getFocusableElements(explicitRoot?: HTMLElement | null): HTMLElement[] {
  const root = resolveNavigationRoot(explicitRoot)
  const elements = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  return elements.filter((el) => {
    // Let pages opt an element (or a whole subtree) out of gamepad navigation.
    if (el.closest('[data-gamepad-skip]')) return false
    // Vuetify text fields / selects wrap a visually-collapsed native input in a
    // `.v-field`. Use the visible field as the single focus target and skip the
    // inner input, otherwise focus lands on an invisible element (or duplicates).
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.closest('.v-field')) return false
    if (el.classList.contains('v-field') && el.classList.contains('v-field--disabled')) return false
    if (!isElementVisible(el)) return false
    if (el.tabIndex === undefined || el.tabIndex < 0) el.tabIndex = 0
    return true
  })
}

/**
 * Resolve a per-element directional override. On the currently focused element
 * a page may set `data-gamepad-<dir>` (up/down/left/right) to:
 * - a CSS selector -> focus moves straight to that element
 * - "trap" / "none" -> movement in that direction is blocked
 * Returns 'blocked' when movement should stop, the target element, or null when
 * there is no override and the geometric scorer should run.
 */
function resolveDirectionalOverride(
  current: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right',
): HTMLElement | 'blocked' | null {
  const value = current.getAttribute(`data-gamepad-${direction}`)
  if (value === null) return null
  if (value === '' || value === 'trap' || value === 'none') return 'blocked'
  try {
    const target = document.querySelector<HTMLElement>(value)
    if (target && isElementVisible(target)) {
      if (target.tabIndex < 0) target.tabIndex = 0
      return target
    }
  } catch {
    // Invalid selector -> fall through to the scorer.
  }
  return null
}

/** Gap between two 1-D ranges; 0 when they overlap. Symmetric. */
function rangeGap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  if (aEnd < bStart) return bStart - aEnd
  if (bEnd < aStart) return aStart - bEnd
  return 0
}

/**
 * Pick the best candidate in `direction` from `current` among `elements`.
 *
 * Score = primary-axis *leading-edge* distance + cross-axis *overlap gap* × weight.
 * - Primary uses the gap between the nearest edges (not centres), so a wide
 *   element next to a narrow one still counts as adjacent — pressing right from
 *   a wide field lands on the field beside it, not a centred element above.
 * - A candidate that overlaps the current element on the primary axis is really
 *   beside it on the *other* axis, so it is penalised (OVERLAP_PENALTY) and can
 *   never masquerade as a neighbour in this direction.
 * - Cross-axis uses the overlap gap (0 when aligned), so within a column/row the
 *   physically nearest element wins — no skipped-middle, and up/down is symmetric.
 */
const CROSS_AXIS_WEIGHT = 3
const OVERLAP_PENALTY = 3

function pickBestCandidate(
  current: HTMLElement,
  elements: HTMLElement[],
  direction: 'up' | 'down' | 'left' | 'right',
): HTMLElement | null {
  const cur = current.getBoundingClientRect()
  const curCenter = { x: cur.left + cur.width / 2, y: cur.top + cur.height / 2 }

  let bestCandidate: HTMLElement | null = null
  let minScore = Infinity

  for (const el of elements) {
    if (el === current) continue
    if (el.inert) continue
    const rect = el.getBoundingClientRect()
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    const dx = center.x - curCenter.x
    const dy = center.y - curCenter.y

    // Only consider elements whose centre lies in the requested direction.
    if (direction === 'up' && dy >= -1) continue
    if (direction === 'down' && dy <= 1) continue
    if (direction === 'left' && dx >= -1) continue
    if (direction === 'right' && dx <= 1) continue

    // Signed leading-edge distance along the movement axis: >= 0 when the
    // candidate is truly ahead (separated), < 0 when it overlaps this axis.
    let lead: number
    let crossGap: number
    if (direction === 'down') {
      lead = rect.top - cur.bottom
      crossGap = rangeGap(cur.left, cur.right, rect.left, rect.right)
    } else if (direction === 'up') {
      lead = cur.top - rect.bottom
      crossGap = rangeGap(cur.left, cur.right, rect.left, rect.right)
    } else if (direction === 'right') {
      lead = rect.left - cur.right
      crossGap = rangeGap(cur.top, cur.bottom, rect.top, rect.bottom)
    } else {
      lead = cur.left - rect.right
      crossGap = rangeGap(cur.top, cur.bottom, rect.top, rect.bottom)
    }

    const primary = lead >= 0 ? lead : -lead * OVERLAP_PENALTY
    const score = primary + crossGap * CROSS_AXIS_WEIGHT

    if (score < minScore) {
      minScore = score
      bestCandidate = el
    }
  }

  return bestCandidate
}

function focusElement(el: HTMLElement) {
  el.focus()
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

export function moveFocus(direction: 'up' | 'down' | 'left' | 'right', explicitRoot?: HTMLElement | null) {
  const elements = getFocusableElements(explicitRoot)
  if (elements.length === 0) return

  const current = document.activeElement as HTMLElement
  if (!current || !elements.includes(current)) {
    elements[0].focus()
    return
  }

  // 1. Element-level hard override always wins.
  const override = resolveDirectionalOverride(current, direction)
  if (override === 'blocked') return
  if (override) {
    focusElement(override)
    return
  }

  // 2. Section-scoped navigation: while inside a `data-gamepad-section`, stay
  //    within it; only at its edge use the section's declared neighbour.
  const section = current.closest<HTMLElement>('[data-gamepad-section]')
  if (section) {
    const inSection = elements.filter((el) => section.contains(el))
    const best = pickBestCandidate(current, inSection, direction)
    if (best) {
      focusElement(best)
      return
    }
    const sectionOverride = resolveDirectionalOverride(section, direction)
    if (sectionOverride === 'blocked') return
    if (sectionOverride) {
      focusElement(sectionOverride)
      return
    }
    // No in-section candidate and no declared neighbour -> fall through to the
    // global scorer so the user can still leave the section by geometry.
  }

  // 2.5 Implicit scroll-container scoping (vertical only): when moving up/down,
  //     prefer candidates within the current scroll region so navigation doesn't
  //     jump to fixed chrome (e.g. the system bar) as the page is scrolled — the
  //     same-page element above / below is chosen and scrolled into view instead.
  //     Left/right are intentionally excluded so focus can cross into a sibling
  //     column (e.g. the settings nav sidebar). Falls through when the container
  //     has no candidate in that direction.
  if (direction === 'up' || direction === 'down') {
    const scrollContainer = getNearestScrollContainer(current)
    if (scrollContainer) {
      const inContainer = elements.filter((el) => scrollContainer.contains(el))
      const best = pickBestCandidate(current, inContainer, direction)
      if (best) {
        focusElement(best)
        return
      }
    }
  }

  // 3. Global geometric scoring, with index wrap-around as a last resort.
  const target = pickBestCandidate(current, elements, direction) ?? (() => {
    const index = elements.indexOf(current)
    if (direction === 'down' || direction === 'right') return elements[(index + 1) % elements.length]
    return elements[(index - 1 + elements.length) % elements.length]
  })()

  focusElement(target)
}

/**
 * Nearest scrollable ancestor of `el`, or null when it isn't inside one. Used
 * to scope focus navigation to the current scroll region.
 */
function getNearestScrollContainer(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.scrollHeight > node.clientHeight) {
      const overflowY = window.getComputedStyle(node).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') return node
    }
    node = node.parentElement
  }
  return null
}

/**
 * Scroll the first scrollable ancestor of `start` that still has room in the
 * requested direction (so a small nested scroller doesn't trap the scroll).
 * Returns true if something was scrolled.
 */
/**
 * Scroll the *largest* scrollable ancestor of `start` that still has room in the
 * requested direction. Preferring the largest (not the nearest) means a small
 * nested scroller — a chip row, a short list — doesn't trap the scroll: the
 * dominant content region wins. Returns true if something was scrolled.
 */
function scrollFromNode(start: HTMLElement | null, delta: number): boolean {
  const downward = delta > 0
  let node: HTMLElement | null = start
  let best: HTMLElement | null = null
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflowY = window.getComputedStyle(node).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') {
        const hasRoom = downward
          ? node.scrollHeight - node.clientHeight - node.scrollTop > 1
          : node.scrollTop > 1
        if (hasRoom && (!best || node.clientHeight > best.clientHeight)) {
          best = node
        }
      }
    }
    node = node.parentElement
  }
  if (best) {
    // `behavior: 'instant'` bypasses any CSS `scroll-behavior: smooth` on the
    // container (e.g. the settings page), which would otherwise animate every
    // per-frame step and make the stick barely move.
    best.scrollBy({ top: delta, behavior: 'instant' })
    return true
  }
  return false
}

/**
 * Scroll the region under the current focus by `delta` pixels, called every
 * frame while the right stick is held (continuous scrolling). Tries, in order:
 * the focused element's scroll ancestor, the scroll region under the centre of
 * the viewport (handles pages whose scroller is a *sibling* of the focused
 * column, e.g. the settings sidebar), then the main content region.
 */
function scrollFocusedRegion(delta: number) {
  if (scrollFromNode(document.activeElement as HTMLElement | null, delta)) return

  const mid = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) as HTMLElement | null
  if (mid && scrollFromNode(mid, delta)) return

  const main = document.querySelector<HTMLElement>('main')
  const fallback = main && main.scrollHeight > main.clientHeight
    ? main
    : (document.scrollingElement as HTMLElement | null)
  if (fallback) fallback.scrollBy({ top: delta, behavior: 'instant' })
}

/* ------------------------------- input driver ------------------------------ */

const COOLDOWN_MS = 200
const SCROLL_SPEED = 12

/** High level app actions the main-view controls delegate to. */
export interface GamepadActions {
  /** L1 / R1 — move between top level tabs / pages. */
  navigateTab(direction: 'prev' | 'next'): void
  /** Select — toggle the background task dialog. */
  openTasks(): void
  /** Start — open the command palette (with the gamepad cards). */
  quickAction(): void
  /** B — go back / close in the main view. */
  back(): void
}

/**
 * A modal input context. While registered its confirm / cancel handlers
 * override the default main-view behaviour, and focus navigation is scoped to
 * `root()`.
 */
export interface GamepadContext {
  onConfirm?: () => void
  onCancel?: () => void
  /** Start pressed while this context is active (e.g. to close the menu). */
  onMenu?: () => void
  /** Overrides the default focus navigation (moveFocus) when provided. */
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void
  root?: () => HTMLElement | null
}

export interface UseGamepadOptions {
  actions: GamepadActions
  /** Called when a button is pressed while the gamepad is not yet enabled. */
  onEnablePrompt: () => void
}

/**
 * The single app-wide gamepad instance: shared read-only state (enabled +
 * live-derived connection / name / type / labels / button glyphs) *and* the
 * input driver (per-frame processing, button edge detection, spatial focus
 * navigation, modal context stack). Created once in a detached scope
 * (`createGlobalState`) so every consumer — the driver host and the many
 * components that only render button hints — shares one set of refs and a
 * single processing loop.
 *
 * The high-level `actions` / `onEnablePrompt` can only come from the host that
 * owns routing + dialogs (AppGamepadPrompt), so they are wired lazily via
 * `boot()` the first time {@link useGamepad} is called with options.
 */
const useGamepadCore = createGlobalState(() => {
  const { gamepads, onConnected, onDisconnected, pause } = useSharedGamepads()

  // `enabled` is the only persisted state (a user preference). `useLocalStorage`
  // persists it and keeps it live across windows via storage events.
  const enabled = useLocalStorage('gamepad_enabled', false)
  const setEnabled = (value: boolean) => {
    enabled.value = value
  }

  // The pad currently driving input: the one most recently interacted with,
  // else the first standard controller. Everything user-visible is derived live.
  const preferredIndex = ref<number | null>(null)
  const activeGamepad = computed<Gamepad | undefined>(() => {
    const pads = gamepads.value
    if (preferredIndex.value !== null) {
      const found = pads.find((g) => g.index === preferredIndex.value)
      if (found) return found
    }
    return pickGamepad(pads)
  })

  const connected = computed(() => !!activeGamepad.value)
  const type = computed<GamepadType>(() => (activeGamepad.value ? detectGamepadType(activeGamepad.value.id) : 'xbox'))
  const name = computed(() => (activeGamepad.value ? cleanGamepadName(activeGamepad.value.id) : ''))
  const isActive = computed(() => enabled.value && connected.value)
  const labels = computed(() => getGamepadLabels(type.value))
  const buttonA = computed(() => labels.value.confirm)
  const buttonB = computed(() => labels.value.cancel)
  // Face buttons X (left) and Y (top) — used to mark buttons a page binds to them.
  const buttonX = computed(() => labels.value.backspace)
  const buttonY = computed(() => labels.value.keyboard)
  const isPlayStation = computed(() => isPlayStationType(type.value))

  const promptDismissed = ref(false)
  const dismissPrompt = () => {
    promptDismissed.value = true
  }

  // High-level actions + the enable-prompt callback are owned by the host
  // (AppGamepadPrompt) and injected lazily via boot(); until then the driver
  // only does focus/scroll work that needs no app context.
  let actions: GamepadActions | null = null
  let onEnablePrompt: (() => void) | null = null
  const boot = (options: UseGamepadOptions) => {
    actions = options.actions
    onEnablePrompt = options.onEnablePrompt
  }

  // Modal context stack (dialogs register themselves while open).
  const contexts = new Map<string, GamepadContext>()
  const contextOrder: string[] = []
  const registerContext = (id: string, ctx: GamepadContext) => {
    contexts.set(id, ctx)
    if (!contextOrder.includes(id)) contextOrder.push(id)
  }
  const unregisterContext = (id: string) => {
    contexts.delete(id)
    const i = contextOrder.indexOf(id)
    if (i >= 0) contextOrder.splice(i, 1)
  }
  const activeContext = (): GamepadContext | null => {
    for (let i = contextOrder.length - 1; i >= 0; i--) {
      const ctx = contexts.get(contextOrder[i])
      if (ctx) return ctx
    }
    return null
  }

  // --- input processing state ---
  let prevButtons: boolean[] = []
  let lastInputTime = 0

  // --- focus restoration across overlays ---
  let prevOverlayCount = 0
  let lastOutsideFocus: HTMLElement | null = null
  let lastOverlayCheck = 0
  const focusStack: (HTMLElement | null)[] = []

  const countOpenOverlays = () =>
    document.querySelectorAll('.v-overlay--active.v-dialog, .v-dialog--active').length

  const isInsideOverlay = (el: Element | null) =>
    !!el && !!el.closest('.v-overlay__content, .v-dialog')

  function trackFocusRestore(now: number) {
    // Throttle the DOM query — overlay open/close doesn't need per-frame polling.
    if (now - lastOverlayCheck < 80) return
    lastOverlayCheck = now
    const overlayCount = countOpenOverlays()
    if (overlayCount > prevOverlayCount) {
      // An overlay just opened — remember what was focused beforehand.
      focusStack.push(lastOutsideFocus)
    } else if (overlayCount < prevOverlayCount) {
      // An overlay closed — return focus to the opener.
      const target = focusStack.pop()
      if (target && document.contains(target)) {
        requestAnimationFrame(() => target.focus())
      }
    }
    prevOverlayCount = overlayCount

    if (overlayCount === 0) {
      const active = document.activeElement as HTMLElement | null
      if (active && active !== document.body && !isInsideOverlay(active)) {
        lastOutsideFocus = active
      }
    }
  }

  /** Remember the most-recently-interacted pad so it wins as the active one. */
  function updatePreferred() {
    for (const gp of gamepads.value) {
      const anyButton = gp.buttons.some((b) => b.pressed)
      const anyAxis = gp.axes.some((a) => Math.abs(a) > 0.5)
      if (anyButton || anyAxis) preferredIndex.value = gp.index
    }
  }

  function pressed(buttons: readonly GamepadButton[], index: number) {
    return buttons[index] && buttons[index].pressed
  }

  /** True only on the frame the button transitions from up to down. */
  function justPressed(buttons: readonly GamepadButton[], index: number) {
    return !!(buttons[index] && buttons[index].pressed) && !prevButtons[index]
  }

  function activateFocused() {
    const current = document.activeElement as HTMLElement
    if (current && current !== document.body) {
      current.click()
      if (
        current.tagName === 'INPUT' ||
        current.tagName === 'SELECT' ||
        current.classList.contains('v-field') ||
        current.closest('.v-input') ||
        current.closest('.v-select') ||
        current.closest('.v-combobox')
      ) {
        const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
        const enterUp = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
        current.dispatchEvent(enterDown)
        current.dispatchEvent(enterUp)
        const field = current.closest('.v-field') as HTMLElement
        if (field && field !== current) field.click()
      }
    }
  }

  function handleMainView(buttons: readonly GamepadButton[], axes: readonly number[], now: number) {
    // A -> activate focused element.
    if (justPressed(buttons, GamepadButtonIndex.A)) activateFocused()

    // X / Y -> per-page contextual actions (see useGamepadAction).
    if (justPressed(buttons, GamepadButtonIndex.X)) topGamepadAction('X')?.handler()
    if (justPressed(buttons, GamepadButtonIndex.Y)) topGamepadAction('Y')?.handler()

    // B -> back / close.
    if (justPressed(buttons, GamepadButtonIndex.B)) {
      const activeDialog = document.querySelector('.v-dialog')
      if (activeDialog) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      } else {
        actions!.back()
      }
    }

    // L1 / R1 (bumpers) -> switch tabs.
    if (justPressed(buttons, GamepadButtonIndex.L1)) actions!.navigateTab('prev')
    if (justPressed(buttons, GamepadButtonIndex.R1)) actions!.navigateTab('next')

    // L2 / R2 (triggers) -> page-defined inner navigation (see useGamepadInnerNav).
    if (justPressed(buttons, GamepadButtonIndex.L2)) topGamepadInnerNav()?.handler('prev')
    if (justPressed(buttons, GamepadButtonIndex.R2)) topGamepadInnerNav()?.handler('next')

    // Menu (Start) -> open the command palette (with the gamepad cards).
    // Select -> toggle the task dialog.
    if (justPressed(buttons, GamepadButtonIndex.Start)) actions!.quickAction()
    if (justPressed(buttons, GamepadButtonIndex.Select)) actions!.openTasks()

    // D-Pad / left stick -> spatial focus navigation.
    const stickX = axes[0] ?? 0
    const stickY = axes[1] ?? 0
    let dir: 'up' | 'down' | 'left' | 'right' | null = null
    if (pressed(buttons, GamepadButtonIndex.DpadUp) || stickY < -0.5) dir = 'up'
    else if (pressed(buttons, GamepadButtonIndex.DpadDown) || stickY > 0.5) dir = 'down'
    else if (pressed(buttons, GamepadButtonIndex.DpadLeft) || stickX < -0.5) dir = 'left'
    else if (pressed(buttons, GamepadButtonIndex.DpadRight) || stickX > 0.5) dir = 'right'

    if (dir && now - lastInputTime > COOLDOWN_MS) {
      moveFocus(dir)
      lastInputTime = now
    }

    // Right stick -> scroll the focused region (vertical). Runs every frame so
    // the scroll is continuous while the stick is held.
    const rStickY = axes[3] ?? 0
    if (Math.abs(rStickY) > 0.2) {
      scrollFocusedRegion(rStickY * SCROLL_SPEED)
    }
  }

  function handleContext(ctx: GamepadContext, buttons: readonly GamepadButton[], axes: readonly number[], now: number) {
    if (justPressed(buttons, GamepadButtonIndex.A)) {
      ctx.onConfirm?.()
      return
    }
    if (justPressed(buttons, GamepadButtonIndex.B)) {
      ctx.onCancel?.()
      return
    }
    if (justPressed(buttons, GamepadButtonIndex.Start) && ctx.onMenu) {
      ctx.onMenu()
      return
    }
    // Directional input: a context may override navigation, else focus moves.
    const stickX = axes[0] ?? 0
    const stickY = axes[1] ?? 0
    let dir: 'up' | 'down' | 'left' | 'right' | null = null
    if (pressed(buttons, GamepadButtonIndex.DpadUp) || stickY < -0.5) dir = 'up'
    else if (pressed(buttons, GamepadButtonIndex.DpadDown) || stickY > 0.5) dir = 'down'
    else if (pressed(buttons, GamepadButtonIndex.DpadLeft) || stickX < -0.5) dir = 'left'
    else if (pressed(buttons, GamepadButtonIndex.DpadRight) || stickX > 0.5) dir = 'right'
    if (dir && now - lastInputTime > COOLDOWN_MS) {
      if (ctx.onNavigate) ctx.onNavigate(dir)
      else moveFocus(dir, ctx.root?.() ?? null)
      lastInputTime = now
    }
  }

  // vueuse keeps `gamepads` fresh via its own rAF loop, replacing the whole
  // snapshot object for each pad every frame. We watch that object's *identity*
  // (one reference compare per frame) instead of a `deep` watch that would
  // re-traverse every button/axis each time. Keyboard/mouse users never fire
  // `gamepadconnected`, so vueuse's loop stays paused and they pay zero
  // per-frame cost; we pause it again once the last controller disconnects.
  function processFrame() {
    const now = performance.now()
    trackFocusRestore(now)

    updatePreferred()
    const active = activeGamepad.value
    if (!active) {
      prevButtons = []
      return
    }

    // Prompt to enable when a button is pressed and we are not active yet.
    if (!enabled.value && !promptDismissed.value && onEnablePrompt) {
      if (active.buttons.some((b) => b.pressed)) onEnablePrompt()
    }

    const buttons = active.buttons
    const axes = active.axes
    if (prevButtons.length === 0) prevButtons = new Array(buttons.length).fill(false)

    const ctx = activeContext()
    if (ctx) {
      handleContext(ctx, buttons, axes, now)
    } else if (enabled.value && actions) {
      handleMainView(buttons, axes, now)
    }

    for (let i = 0; i < buttons.length; i++) {
      prevButtons[i] = buttons[i].pressed
    }
  }

  // Fires once per frame on the snapshot's identity change. The source is
  // independent of `preferredIndex` (which `processFrame` writes), so the sync
  // callback can never re-trigger itself.
  watch(() => pickGamepad(gamepads.value), processFrame, { flush: 'sync' })

  onConnected(() => {
    // A fresh controller re-opens the enable prompt for this session.
    promptDismissed.value = false
  })
  onDisconnected((index) => {
    if (preferredIndex.value === index) preferredIndex.value = null
    prevButtons = []
    // vueuse leaves its loop running after a disconnect; pause it ourselves
    // when nothing is left to poll so idle users pay no per-frame cost.
    if (gamepads.value.length === 0) pause()
  })

  return {
    isActive,
    enabled,
    connected,
    type,
    name,
    labels,
    buttonA,
    buttonB,
    buttonX,
    buttonY,
    isPlayStation,
    promptDismissed,
    setEnabled,
    dismissPrompt,
    registerContext,
    unregisterContext,
    boot,
  }
})

/**
 * Access the single shared gamepad instance. Components that only render button
 * hints call it with no arguments; the host (AppGamepadPrompt) passes `options`
 * once to wire the high-level actions and the enable-prompt callback.
 */
export function useGamepad(options?: UseGamepadOptions) {
  const core = useGamepadCore()
  if (options) core.boot(options)
  return core
}

export type UseGamepadReturn = ReturnType<typeof useGamepad>
export type GamepadEnabledRef = Ref<boolean>

/** Provide/inject key for the shared gamepad driver (provided by AppGamepadPrompt). */
export const kGamepad: InjectionKey<UseGamepadReturn> = Symbol('Gamepad')
