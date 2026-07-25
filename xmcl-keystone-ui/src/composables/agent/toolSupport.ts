import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'

export interface AgentToolDefinition {
  name: string
  label?: string
  description: string
  readonly?: boolean
  parameters: Record<string, unknown>
  execute(args: any, signal?: AbortSignal): Promise<unknown> | unknown
}

export function textResult<T>(value: T): AgentToolResult<T> {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return {
    content: [{ type: 'text', text: text ?? 'null' }],
    details: value,
  }
}

export function createAgentTools(definitions: AgentToolDefinition[]): AgentTool[] {
  return definitions.map(definition => ({
    name: definition.name,
    label: definition.label ?? definition.name.replaceAll('_', ' '),
    description: definition.description,
    parameters: Type.Unsafe(definition.parameters),
    executionMode: definition.readonly ? 'parallel' : 'sequential',
    async execute(_toolCallId, args, signal) {
      return textResult(await definition.execute(args, signal))
    },
  }))
}
