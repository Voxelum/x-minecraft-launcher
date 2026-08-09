import type { AfterToolCallContext, AgentTool, AgentToolResult, BeforeToolCallContext } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'
import type { AgentArtifactInfo } from '@xmcl/runtime-api'

export const AGENT_TOOL_RESULT_INLINE_LIMIT = 32_000
export const AGENT_TOOL_RESULT_PREVIEW_LIMIT = 4_000

export interface AgentToolDefinition {
  name: string
  label?: string
  description: string
  readonly?: boolean
  parameters: Record<string, unknown>
  execute(args: any, signal?: AbortSignal): Promise<unknown> | unknown
}

export function serializeAgentToolValue(value: unknown): string {
  if (typeof value === 'string') return value
  const seen = new WeakSet<object>()
  const serialized = JSON.stringify(value, (_key, entry) => {
    if (entry instanceof Error) return { name: entry.name, message: entry.message }
    if (typeof entry === 'bigint') return entry.toString()
    if (entry && typeof entry === 'object') {
      if (seen.has(entry)) return '[Circular]'
      seen.add(entry)
    }
    return entry
  })
  return serialized ?? 'null'
}

export function textResult<T>(value: T): AgentToolResult<T> {
  return {
    content: [{ type: 'text', text: serializeAgentToolValue(value) }],
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

export function normalizeAgentToolError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)
  if (error === undefined || error === null) return new Error('Tool execution failed without error details.')
  try {
    const serialized = serializeAgentToolValue(error)
    return new Error(serialized === '{}' ? 'Tool execution failed with an empty error object.' : serialized)
  } catch {
    return new Error('Tool execution failed with an unreadable error value.')
  }
}

export function wrapAgentToolsWithErrorNormalization(tools: AgentTool[]): AgentTool[] {
  return tools.map((tool) => {
    const execute = tool.execute
    return {
      ...tool,
      async execute(toolCallId, params, signal, onUpdate) {
        try {
          return await execute(toolCallId, params, signal, onUpdate)
        } catch (error) {
          throw normalizeAgentToolError(error)
        }
      },
    }
  })
}

export function stringifyAgentToolEventResult(value: unknown): string {
  if (Array.isArray((value as any)?.content)) {
    return (value as any).content
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => serializeAgentToolValue(part.text ?? ''))
      .join('')
  }
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message || value.name
  if (value && typeof value === 'object' && typeof (value as any).message === 'string') {
    return (value as any).message
  }
  if (value !== undefined) {
    try {
      const serialized = serializeAgentToolValue(value)
      if (serialized && serialized !== '{}') return serialized
    } catch {
      // Fall through to String for non-serializable values.
    }
  }
  return String(value ?? '')
}

function isAgentToolResultFailure(value: unknown) {
  if (value instanceof Error) return true
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return result.ok === false || Boolean(result.error)
}

export function createAgentToolFailureGuard(tools: readonly AgentTool[]) {
  let mutatingToolFailed = false
  const isMutating = (name: string) => tools.find(tool => tool.name === name)?.executionMode !== 'parallel'
  const recordToolResult = (name: string, isError: boolean) => {
    if (isError && isMutating(name)) mutatingToolFailed = true
  }
  return {
    beginToolBatch() {
      mutatingToolFailed = false
    },
    recordToolResult,
    async beforeToolCall(context: BeforeToolCallContext) {
      if (!mutatingToolFailed || !isMutating(context.toolCall.name)) return undefined
      return {
        block: true,
        reason: 'Skipped because an earlier mutating tool call in this assistant batch failed.',
      }
    },
    async afterToolCall(context: AfterToolCallContext) {
      const isError = context.isError || isAgentToolResultFailure(context.result.details)
      recordToolResult(context.toolCall.name, isError)
      return isError === context.isError ? undefined : { isError }
    },
  }
}

export interface AgentToolResultSpillOptions {
  inlineLimit?: number
  previewLimit?: number
}

export async function spillAgentToolResult(
  result: AgentToolResult<unknown>,
  toolName: string,
  writeArtifact: (content: string, toolName: string) => Promise<AgentArtifactInfo>,
  options: AgentToolResultSpillOptions = {},
): Promise<AgentToolResult<unknown>> {
  const inlineLimit = options.inlineLimit ?? AGENT_TOOL_RESULT_INLINE_LIMIT
  const previewLimit = options.previewLimit ?? AGENT_TOOL_RESULT_PREVIEW_LIMIT
  const text = result.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
  if (text.length <= inlineLimit) return result

  const artifact = await writeArtifact(text, toolName)
  const preview = text.slice(0, previewLimit)
  const notice = [
    `Tool output was too large to return inline and was saved to ${artifact.path}.`,
    `Total length: ${artifact.length} characters. Showing the first ${preview.length} characters below.`,
    '',
    preview,
    '',
    `Read more with vfs_read using path "${artifact.path}", offset ${preview.length}, and a limit up to 24000.`,
    `Search it with grep: grep <pattern> ${artifact.path} (case-insensitive: grep -i <pattern> ${artifact.path})`,
  ].join('\n')
  return {
    ...result,
    content: [{ type: 'text', text: notice }, ...result.content.filter(part => part.type !== 'text')],
    details: { artifact, previewLength: preview.length },
  }
}

export function wrapAgentToolsWithResultSpill(
  tools: AgentTool[],
  writeArtifact: (content: string, toolName: string) => Promise<AgentArtifactInfo>,
  options?: AgentToolResultSpillOptions,
): AgentTool[] {
  return tools.map((tool) => {
    const execute = tool.execute
    return {
      ...tool,
      async execute(toolCallId, params, signal, onUpdate) {
        const result = await execute(toolCallId, params, signal, onUpdate)
        return spillAgentToolResult(result, tool.name, writeArtifact, options)
      },
    }
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
