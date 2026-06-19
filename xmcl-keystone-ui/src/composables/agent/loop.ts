import type { ChatMessage, LLMOptions, ToolCall, ToolDefinition } from './llm'
import { chat } from './llm'

export interface Tool {
  readonly name: string
  readonly description: string
  readonly parameters: ToolDefinition['function']['parameters']
  /** Pure read tools can run in parallel and are safe to retry. */
  readonly readonly?: boolean
  execute(args: Record<string, unknown>, signal: AbortSignal): Promise<unknown>
}

export interface AgentEvent {
  type: 'assistant' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'tools_loaded'
  content?: string
  toolCall?: ToolCall
  toolResult?: { id: string; name: string; result: string; isError?: boolean }
  error?: string
  /** Final assistant text on `done`. */
  finalText?: string
  /** Tool pack names that were just loaded into the registry. */
  loaded?: string[]
}

export interface LoadableToolPack {
  description: string
  load: () => Promise<Tool[]>
}

export interface RunAgentOptions extends LLMOptions {
  tools: Tool[]
  /**
   * Tool packs the agent can mount mid-conversation via the built-in
   * `load_tools` meta-tool. Once loaded the pack stays available for the
   * rest of the loop.
   */
  loadable?: Record<string, LoadableToolPack>
  /**
   * Pack names already loaded earlier in the *session* (across previous user
   * turns). Each `runAgent` call rebuilds its tool map from `tools`, so without
   * this the tools a prior turn loaded would be missing — the model would see
   * them in the history and call one, only to get an "unknown tool" error.
   * These packs are re-mounted before the first model call.
   */
  preloadedPacks?: string[]
  /** Hard cap on tool-call rounds. Each round = one assistant turn. */
  maxIterations?: number
  /** Fired for each LLM/tool event. UI uses this to render the transcript. */
  onEvent?: (event: AgentEvent) => void
}

const DEFAULT_MAX_ITERATIONS = 10

function toToolDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

function stringifyResult(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try { return JSON.stringify(value) }
  catch { return String(value) }
}

function buildLoadToolsTool(
  loadable: Record<string, LoadableToolPack>,
  loaded: Set<string>,
  onLoad: (newTools: Tool[], names: string[]) => void,
): Tool {
  const available = Object.entries(loadable).map(([name, p]) => `- ${name}: ${p.description}`).join('\n')
  return {
    name: 'load_tools',
    description: `Mount one or more lazy tool packs. The new tools become callable in the next turn. Available packs:\n${available}`,
    parameters: {
      type: 'object',
      properties: {
        packs: { type: 'array', items: { type: 'string' }, description: 'Pack names to load' },
      },
      required: ['packs'],
    },
    async execute(args) {
      const packs = (args.packs as string[] | undefined) ?? []
      const newlyAdded: string[] = []
      const added: Tool[] = []
      const errors: string[] = []
      for (const name of packs) {
        if (loaded.has(name)) continue
        const pack = loadable[name]
        if (!pack) { errors.push(`unknown pack: ${name}`); continue }
        try {
          const ts = await pack.load()
          added.push(...ts)
          loaded.add(name)
          newlyAdded.push(name)
        } catch (err) {
          errors.push(`failed to load ${name}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (added.length) onLoad(added, newlyAdded)
      return {
        loaded: newlyAdded,
        addedTools: added.map((t) => t.name),
        errors: errors.length ? errors : undefined,
      }
    },
  }
}

/**
 * Drive an OpenAI-style chat completion + tool-call loop.
 *
 * The function mutates `messages` so callers can keep the running history
 * around (e.g. for a chat UI). Returns the same array on completion.
 */
export async function runAgent(
  messages: ChatMessage[],
  options: RunAgentOptions,
): Promise<ChatMessage[]> {
  const { tools, loadable, preloadedPacks, maxIterations = DEFAULT_MAX_ITERATIONS, onEvent, ...llm } = options
  const toolMap = new Map<string, Tool>(tools.map((t) => [t.name, t]))
  const loaded = new Set<string>()

  // Inject the meta-tool when lazy packs are available.
  if (loadable && Object.keys(loadable).length > 0) {
    const loadTool = buildLoadToolsTool(loadable, loaded, (newTools, names) => {
      for (const t of newTools) toolMap.set(t.name, t)
      onEvent?.({ type: 'tools_loaded', loaded: names })
    })
    toolMap.set(loadTool.name, loadTool)
  }

  // Re-mount packs the session loaded in earlier turns so their tools survive
  // across user messages. Without this, a tool loaded in a previous turn (e.g.
  // `set_server_eula` from the `server` pack) would be "unknown" the next time
  // the user replies, since this fresh `runAgent` only knows `tools`.
  if (loadable && preloadedPacks?.length) {
    for (const name of preloadedPacks) {
      if (loaded.has(name)) continue
      const pack = loadable[name]
      if (!pack) continue
      try {
        const ts = await pack.load()
        for (const t of ts) toolMap.set(t.name, t)
        loaded.add(name)
      } catch (err) {
        console.error(`[agent] failed to re-mount pack "${name}"`, err)
      }
    }
  }

  for (let i = 0; i < maxIterations; i++) {
    const toolDefs = toToolDefinitions([...toolMap.values()])
    const res = await chat(messages, toolDefs, llm)

    messages.push({
      role: 'assistant',
      content: res.content,
      tool_calls: res.toolCalls.length
        ? res.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.arguments) },
        }))
        : undefined,
    })

    if (res.content) onEvent?.({ type: 'assistant', content: res.content })

    if (res.toolCalls.length === 0) {
      onEvent?.({ type: 'done', finalText: res.content ?? '' })
      return messages
    }

    // Tool calls — execute sequentially. Parallelizing readonly tools is a
    // future optimization; sequential keeps the trace easy to follow.
    for (const call of res.toolCalls) {
      onEvent?.({ type: 'tool_call', toolCall: call })
      const tool = toolMap.get(call.name)
      let resultText: string
      let isError = false
      if (!tool) {
        resultText = `Error: unknown tool "${call.name}"`
        isError = true
      } else {
        try {
          const value = await tool.execute(call.arguments, llm.signal ?? new AbortController().signal)
          resultText = stringifyResult(value)
        } catch (err) {
          resultText = `Error: ${err instanceof Error ? err.message : String(err)}`
          isError = true
        }
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.name,
        content: resultText,
      })
      onEvent?.({ type: 'tool_result', toolResult: { id: call.id, name: call.name, result: resultText, isError } })
    }
  }

  const stopMsg = `Agent stopped: exceeded ${maxIterations} iterations`
  onEvent?.({ type: 'error', error: stopMsg })
  throw new Error(stopMsg)
}
