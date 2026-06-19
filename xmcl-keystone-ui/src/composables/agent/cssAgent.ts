import { computed, ref, shallowRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatMessage } from './llm'
import { runAgent, type AgentEvent, type RunAgentOptions, type Tool } from './loop'
import { useAgentSettings } from './settings'

/**
 * Everything the CSS agent's tools need to read/write the launcher's custom
 * CSS. Deliberately tiny: this agent can ONLY touch the custom CSS, nothing
 * else in the launcher.
 */
export interface CssAgentContext {
  getCss(): string
  setCss(css: string): Promise<void> | void
  getEnabled(): boolean
  setEnabled(enabled: boolean): void
}

// ── Live DOM inspection helpers ─────────────────────────────────────────
// The CSS agent runs in the renderer, so it can read the real rendered UI to
// discover selectors and current styles instead of guessing.

const DEFAULT_STYLE_PROPS = [
  'color', 'background-color', 'background-image', 'border', 'border-radius',
  'padding', 'margin', 'font-size', 'font-family', 'font-weight', 'display',
  'width', 'height', 'opacity', 'box-shadow', 'backdrop-filter',
]

function describeElement(el: Element) {
  const rect = el.getBoundingClientRect()
  const testId = el.getAttribute('data-testid')
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    classes: Array.from(el.classList),
    testId: testId || undefined,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    childCount: el.childElementCount,
    text: text ? text.slice(0, 80) : undefined,
  }
}

function nodeLabel(el: Element): string {
  const id = el.id ? `#${el.id}` : ''
  const cls = Array.from(el.classList).slice(0, 6).map((c) => `.${c}`).join('')
  const testId = el.getAttribute('data-testid')
  return `${el.tagName.toLowerCase()}${id}${cls}${testId ? `[data-testid=${testId}]` : ''}`
}

function outlineElement(el: Element, maxDepth: number, depth: number): unknown {
  const label = nodeLabel(el)
  if (depth >= maxDepth || el.childElementCount === 0) return label
  const kids: unknown[] = Array.from(el.children).slice(0, 12).map((c) => outlineElement(c, maxDepth, depth + 1))
  if (el.childElementCount > 12) kids.push(`…(+${el.childElementCount - 12} more)`)
  return { node: label, children: kids }
}

/**
 * The only tools the CSS agent is given. No instance / mod / launch tools —
 * the agent is sandboxed to custom CSS editing plus read-only DOM inspection.
 */
export function createCssAgentTools(ctx: CssAgentContext): Tool[] {
  return [
    {
      name: 'get_custom_css',
      description: 'Read the current custom CSS document and whether it is currently applied. Call this before set_custom_css whenever you want to extend or tweak existing CSS instead of replacing everything.',
      readonly: true,
      parameters: { type: 'object', properties: {} },
      async execute() {
        return { enabled: ctx.getEnabled(), css: ctx.getCss() }
      },
    },
    {
      name: 'set_custom_css',
      description: 'Replace the ENTIRE custom CSS document with the given content. This overwrites whatever is there now, so include every rule you want to keep (use get_custom_css first to read existing rules). Passing an empty string clears all custom CSS.',
      parameters: {
        type: 'object',
        properties: {
          css: { type: 'string', description: 'The full CSS document to write' },
        },
        required: ['css'],
      },
      async execute(args) {
        const css = typeof args.css === 'string' ? args.css : String(args.css ?? '')
        await ctx.setCss(css)
        return { ok: true, length: css.length, enabled: ctx.getEnabled() }
      },
    },
    {
      name: 'set_custom_css_enabled',
      description: 'Turn the custom CSS on or off. Enable it after writing CSS you want the user to see; disable it to revert to the default look without deleting the CSS.',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'true to apply the custom CSS, false to turn it off' },
        },
        required: ['enabled'],
      },
      async execute(args) {
        const enabled = Boolean(args.enabled)
        ctx.setEnabled(enabled)
        return { ok: true, enabled }
      },
    },
    {
      name: 'query_dom',
      description: 'Inspect the live launcher UI: returns the elements currently matching a CSS selector, each with its tag, id, classes, data-testid, on-screen size/position, child count and a short text preview. Use this to discover real selectors and confirm your CSS will target the right elements.',
      readonly: true,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'A CSS selector, e.g. ".v-navigation-drawer" or "[data-testid=custom-css-card]"' },
          limit: { type: 'number', description: 'Max elements to return (default 10, max 50)' },
        },
        required: ['selector'],
      },
      async execute(args) {
        if (typeof document === 'undefined') return { error: 'DOM is not available' }
        const selector = String(args.selector ?? '')
        let nodes: Element[]
        try {
          nodes = Array.from(document.querySelectorAll(selector))
        } catch {
          return { error: `invalid CSS selector: ${selector}` }
        }
        const limit = Math.min(Math.max(1, Number(args.limit ?? 10) || 10), 50)
        return {
          total: nodes.length,
          elements: nodes.slice(0, limit).map(describeElement),
        }
      },
    },
    {
      name: 'get_computed_style',
      description: 'Read the current computed CSS of the first element matching a selector. Pass `properties` to limit which ones you get (recommended); otherwise a curated set of common properties is returned. Use this to see actual current values before overriding them.',
      readonly: true,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector' },
          properties: { type: 'array', items: { type: 'string' }, description: 'Specific CSS properties to read, e.g. ["background-color","padding","border-radius"]' },
        },
        required: ['selector'],
      },
      async execute(args) {
        if (typeof document === 'undefined' || typeof window === 'undefined') return { error: 'DOM is not available' }
        const selector = String(args.selector ?? '')
        let el: Element | null
        try {
          el = document.querySelector(selector)
        } catch {
          return { error: `invalid CSS selector: ${selector}` }
        }
        if (!el) return { error: `no element matches: ${selector}` }
        const cs = window.getComputedStyle(el)
        const requested = Array.isArray(args.properties) && args.properties.length
          ? args.properties.map((p) => String(p))
          : DEFAULT_STYLE_PROPS
        const styles: Record<string, string> = {}
        for (const p of requested) styles[p] = cs.getPropertyValue(p)
        return { element: nodeLabel(el), styles }
      },
    },
    {
      name: 'get_dom_outline',
      description: 'Get a compact tree outline of the live UI under a selector (default the app root). Each node shows tag, id, classes and data-testid so you can discover the structure and find selectors to target. Bounded in depth and breadth to stay small.',
      readonly: true,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Root selector (default ".v-application", the app root)' },
          maxDepth: { type: 'number', description: 'Max tree depth (default 4, max 8)' },
        },
      },
      async execute(args) {
        if (typeof document === 'undefined') return { error: 'DOM is not available' }
        const selector = String(args.selector || '.v-application')
        let root: Element | null
        try {
          root = document.querySelector(selector)
        } catch {
          return { error: `invalid CSS selector: ${selector}` }
        }
        if (!root) return { error: `root not found: ${selector}` }
        const maxDepth = Math.min(Math.max(1, Number(args.maxDepth ?? 4) || 4), 8)
        return { outline: outlineElement(root, maxDepth, 0) }
      },
    },
  ]
}

const CSS_AGENT_RULES = `You are the XMCL (X Minecraft Launcher) Custom CSS assistant. Your ONLY job is to help the user customize the visual appearance of the launcher by writing custom CSS.

You cannot manage instances, mods, resource packs, saves, game settings, or launch the game. If the user asks for anything outside CSS / visual theming, briefly tell them this assistant only handles custom CSS and they should use the main launcher assistant for everything else.

How custom CSS works here:
- The launcher UI is an Electron + Vue 3 + Vuetify 3 app. Your CSS is injected in a <style id="xmcl-custom-css"> tag appended AFTER the app's own styles, so your rules can override the defaults. Prefer specific selectors; use !important sparingly.
- There is a single custom CSS document. \`set_custom_css\` REPLACES the whole document, so to add to existing rules you must \`get_custom_css\` first and write back the merged result.
- Custom CSS is only visible while it is enabled. After writing CSS the user should see, call \`set_custom_css_enabled\` with enabled=true (unless they explicitly want it off).

Theme CSS variables defined on :root (they track the user's current theme — prefer them over hard-coded colors):
- --color-primary, --color-accent, --color-info, --color-error, --color-success, --color-warning
- --color-bg (app background), --color-card-bg (cards), --color-sidebar-bg, --color-appbar-bg
- --color-border, --color-highlight-bg, --color-secondary-text
- --blur-card (card backdrop blur, in px)
Vuetify also exposes theme colors as --v-theme-<name>, e.g. rgb(var(--v-theme-primary)).

Useful structural selectors:
- .v-application — root app container
- .v-navigation-drawer — the sidebar
- .v-app-bar / .v-toolbar — the top bar
- .v-card — cards
- .v-btn — buttons

Inspecting the live UI (you can see the real rendered launcher):
- \`query_dom\` — find the elements matching a selector, with their classes, data-testid, size/position and text. Use it to discover real selectors and verify your CSS targets the right thing.
- \`get_computed_style\` — read an element's current computed CSS so you know the actual values before overriding them.
- \`get_dom_outline\` — print a compact tree of the UI structure to find your way around.
Prefer inspecting the DOM to find exact selectors instead of guessing.

Special feature:
- Declaring \`--custom-background-video: url('<http-url>')\` anywhere in the CSS makes the launcher play that video as an animated background.

Rules:
- Be proactive: when the user describes a look, write the CSS and apply it immediately (\`set_custom_css\`, then \`set_custom_css_enabled\` true), then briefly report what you changed. Don't ask permission for a normal styling change.
- When editing existing CSS, ALWAYS \`get_custom_css\` first so you don't discard the user's other rules.
- Only pause to warn the user if a request could badly break the UI (e.g. \`display: none\` on core containers like .v-application).
- Keep CSS selectors, property names and values in English. Reply to the user in their locale.`

export interface CssAgentPromptOptions {
  locale: string
}

export function buildCssSystemPrompt(opts: CssAgentPromptOptions): string {
  return [
    CSS_AGENT_RULES,
    `\n\nUser locale: ${opts.locale}. Reply to the user in this language. Keep CSS, tool names and JSON arguments in English (do not translate them).`,
  ].join('')
}

export interface CssAgentSession {
  /** Reactive — true once the shared AI Agent API key / endpoint / model are configured. */
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly messages: Ref<ChatMessage[]>
  readonly events: Ref<AgentEvent[]>
  send(userInput: string, options?: Partial<RunAgentOptions>): Promise<void>
  reset(): void
  abort(): void
}

interface StoredCssAgentConversation {
  version: 1
  messages: ChatMessage[]
  updatedAt: number
}

const DEFAULT_CSS_AGENT_STORAGE_KEY = 'cssAgentConversationV1'
const MAX_STORED_MESSAGES = 80

export interface UseCssAgentOptions {
  /** Read/write hooks for the CSS this agent edits (global or instance scope). */
  context: CssAgentContext
  /** localStorage key under which this conversation is persisted. */
  storageKey?: string
}

/**
 * A CSS-only agent session. It is fully isolated from the main launcher agent
 * (`useAgent`): separate message history, separate persistence, a CSS-specific
 * system prompt and ONLY the custom-CSS tools. The two agents share nothing
 * except the AI provider credentials (key/endpoint/model).
 *
 * `context` decides which CSS the agent edits — pass the global hooks for the
 * global theme, or the instance hooks for an instance theme.
 */
export function useCssAgent(options: UseCssAgentOptions): CssAgentSession {
  const { locale } = useI18n()
  const agentSettings = useAgentSettings()
  const storageKey = options.storageKey ?? DEFAULT_CSS_AGENT_STORAGE_KEY

  const running = ref(false)
  const messages = shallowRef<ChatMessage[]>([])
  const events = shallowRef<AgentEvent[]>([])
  let abortCtrl: AbortController | undefined
  /** Whether the system prompt has been seeded into `messages`. */
  let started = false

  const tools = createCssAgentTools(options.context)

  function trimForStore(input: ChatMessage[]): ChatMessage[] {
    if (input.length <= MAX_STORED_MESSAGES) return input
    const sys = input.find((m) => m.role === 'system')
    const tail = input.filter((m) => m.role !== 'system').slice(-(MAX_STORED_MESSAGES - (sys ? 1 : 0)))
    return sys ? [sys, ...tail] : tail
  }

  function persist() {
    try {
      const data: StoredCssAgentConversation = { version: 1, messages: trimForStore(messages.value), updatedAt: Date.now() }
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch { /* storage may be unavailable; transcript stays in memory */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const data = JSON.parse(raw) as StoredCssAgentConversation
      if (Array.isArray(data?.messages)) {
        messages.value = data.messages
        started = messages.value.some((m) => m.role === 'system')
      }
    } catch { /* ignore malformed cache */ }
  }

  load()

  async function send(userInput: string, options: Partial<RunAgentOptions> = {}) {
    if (running.value) throw new Error('CSS agent: a request is already in flight')
    if (!agentSettings.apiKey.value.trim()) {
      throw new Error('CSS agent: API key is not configured (Settings -> General -> AI Agent)')
    }

    if (!started) {
      const sys = buildCssSystemPrompt({ locale: locale.value })
      messages.value = [{ role: 'system', content: sys }]
      started = true
      persist()
    }

    running.value = true
    abortCtrl = new AbortController()
    const history = messages.value.slice()
    history.push({ role: 'user', content: userInput })
    messages.value = history.slice()
    try {
      await runAgent(history, {
        apiKey: agentSettings.apiKey.value.trim(),
        endpoint: agentSettings.resolvedEndpoint.value,
        model: agentSettings.resolvedModel.value,
        ...options,
        tools,
        signal: abortCtrl.signal,
        onEvent: (e) => {
          events.value = [...events.value, e]
          // `runAgent` mutates `history` in place; hand `messages` a fresh
          // reference each event so the chat UI re-renders.
          messages.value = history.slice()
          persist()
          options.onEvent?.(e)
        },
      })
      messages.value = history.slice()
      persist()
    } finally {
      running.value = false
      abortCtrl = undefined
    }
  }

  function reset() {
    if (running.value) abortCtrl?.abort()
    started = false
    messages.value = []
    events.value = []
    persist()
  }

  function abort() {
    abortCtrl?.abort()
  }

  const available = computed(() =>
    !!(agentSettings.apiKey.value || '').trim() &&
    !!(agentSettings.endpoint.value || '').trim() &&
    !!(agentSettings.model.value || '').trim())

  return {
    available,
    running,
    messages,
    events,
    send,
    reset,
    abort,
  }
}
