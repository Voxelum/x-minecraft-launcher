/**
 * OpenAI-compatible chat client for the renderer-side agent loop.
 *
 * Wire format docs: https://apihub.agnes-ai.com (model `agnes-2.0-flash`).
 * Streaming is intentionally omitted from the skeleton — the loop needs the
 * full tool-call payload before it can dispatch, and the UI does not yet
 * render partial assistant text.
 */

import { agentDebug, agentDebugEndpoint } from './debug'

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
  const model = options.model ?? DEFAULT_AGNES_MODEL
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  }
  if (options.temperature !== undefined) body.temperature = options.temperature
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens
  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  const startedAt = performance.now()
  const loggedEndpoint = agentDebugEndpoint(endpoint)
  agentDebug('llm.request', {
    endpoint: loggedEndpoint,
    model,
    messageCount: messages.length,
    tools: tools.map((tool) => tool.function.name),
    body,
  })

  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    })
  } catch (error) {
    agentDebug('llm.fetch_error', {
      endpoint: loggedEndpoint,
      model,
      durationMs: Math.round(performance.now() - startedAt),
      error,
    })
    throw error
  }

  const responseText = await res.text()
  const durationMs = Math.round(performance.now() - startedAt)
  if (!res.ok) {
    agentDebug('llm.http_error', {
      endpoint: loggedEndpoint,
      model,
      status: res.status,
      statusText: res.statusText,
      durationMs,
      body: responseText,
    })
    throw new Error(`Agent LLM ${res.status}: ${responseText || res.statusText}`)
  }

  let data: {
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
  try {
    data = JSON.parse(responseText)
  } catch (error) {
    agentDebug('llm.parse_error', {
      endpoint: loggedEndpoint,
      model,
      status: res.status,
      durationMs,
      body: responseText,
      error,
    })
    throw error
  }

  agentDebug('llm.response', {
    endpoint: loggedEndpoint,
    model: data.model ?? model,
    status: res.status,
    durationMs,
    body: data,
  })

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
