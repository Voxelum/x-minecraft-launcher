import type { AgentToolDefinition } from '@xmcl/runtime-api'

export interface Tool {
  readonly name: string
  readonly description: string
  readonly parameters: AgentToolDefinition['parameters']
  readonly readonly?: boolean
  readonly timeoutMs?: number
  execute(args: Record<string, unknown>, signal: AbortSignal): Promise<unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface AgentEvent {
  type: 'assistant' | 'tool_call' | 'tool_result' | 'error' | 'done'
  content?: string
  toolCall?: ToolCall
  toolResult?: { id: string; name: string; result: string; isError?: boolean }
  error?: string
  finalText?: string
}

export interface RunAgentOptions {
  maxIterations?: number
  onEvent?: (event: AgentEvent) => void
}
