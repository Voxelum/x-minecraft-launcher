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
  type: 'assistant' | 'tool_call' | 'tool_result' | 'error' | 'done'
  content?: string
  toolCall?: ToolCall
  toolResult?: { id: string; name: string; result: string; isError?: boolean }
  error?: string
  /** Final assistant text on `done`. */
  finalText?: string
}

export interface RunAgentOptions extends LLMOptions {
  tools: Tool[]
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
  const { tools, maxIterations = DEFAULT_MAX_ITERATIONS, onEvent, ...llm } = options
  const toolMap = new Map<string, Tool>(tools.map((t) => [t.name, t]))

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
