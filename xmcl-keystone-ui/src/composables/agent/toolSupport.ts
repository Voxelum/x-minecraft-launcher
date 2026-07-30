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

/**
 * Build a flat object schema for a tool that dispatches on an `action` field.
 *
 * A `Type.Union` of per-action objects emits a bare `anyOf` with no top-level
 * `type`, which stricter OpenAI-compatible providers (DeepSeek among them)
 * reject outright with "schema must be a JSON Schema of 'type: object'". So the
 * variants are flattened into one object: `action` becomes an enum and every
 * other field is optional, with the per-action requirements described in the
 * field docs and enforced at runtime by the handler.
 */
export function actionObjectSchema(
  actions: string[],
  properties: Record<string, unknown>,
  actionDescription: string,
) {
  return Type.Unsafe({
    type: 'object',
    required: ['action'],
    properties: {
      action: { type: 'string', enum: actions, description: actionDescription },
      ...properties,
    },
  })
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
