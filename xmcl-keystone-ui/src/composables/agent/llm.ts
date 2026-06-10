/**
 * OpenAI-compatible chat client for the renderer-side agent loop.
 *
 * Wire format docs: https://apihub.agnes-ai.com (model `agnes-2.0-flash`).
 * Streaming is intentionally omitted from the skeleton — the loop needs the
 * full tool-call payload before it can dispatch, and the UI does not yet
 * render partial assistant text.
 */

export interface TextContentPart {
  type: 'text'
  text: string
}

export interface ImageContentPart {
  type: 'image_url'
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' }
}

export type ContentPart = TextContentPart | ImageContentPart

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentPart[] | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export interface LLMResponse {
  content: string | null
  toolCalls: ToolCall[]
  model?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMOptions {
  apiKey: string
  endpoint?: string
  model?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export const DEFAULT_AGNES_ENDPOINT = 'https://apihub.agnes-ai.com/v1/chat/completions'
export const DEFAULT_AGNES_MODEL = 'agnes-2.0-flash'

export async function chat(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  options: LLMOptions,
): Promise<LLMResponse> {
  if (!options.apiKey) {
    throw new Error('Agent: API key is not configured')
  }

  const endpoint = options.endpoint ?? DEFAULT_AGNES_ENDPOINT
  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_AGNES_MODEL,
    messages,
    stream: false,
  }
  if (options.temperature !== undefined) body.temperature = options.temperature
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens
  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Agent LLM ${res.status}: ${text || res.statusText}`)
  }

  const data = await res.json() as {
    model?: string
    choices: Array<{
      message: {
        content: string | null
        tool_calls?: Array<{
          id: string
          type: 'function'
          function: { name: string; arguments: string }
        }>
      }
    }>
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }

  const msg = data.choices[0]?.message
  if (!msg) throw new Error('Agent LLM: no choices in response')

  const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((c) => {
    let args: Record<string, unknown> = {}
    try { args = c.function.arguments ? JSON.parse(c.function.arguments) : {} }
    catch { /* leave empty — surface parse errors as empty args */ }
    return { id: c.id, name: c.function.name, arguments: args }
  })

  return {
    content: msg.content ?? null,
    toolCalls,
    model: data.model,
    usage: data.usage && {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  }
}
