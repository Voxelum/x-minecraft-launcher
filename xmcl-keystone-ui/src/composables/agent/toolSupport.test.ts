import { describe, expect, test, vi } from 'vitest'
import { actionObjectSchema, createAgentToolFailureGuard, serializeAgentToolValue, spillAgentToolResult, stringifyAgentToolEventResult, textResult, wrapAgentToolsWithErrorNormalization } from './toolSupport'

describe('actionObjectSchema', () => {
  const schema = actionObjectSchema(
    ['navigate', 'confirm'],
    { path: { type: 'string' }, message: { type: 'string' } },
    'Which UI operation to run.',
  ) as any

  // DeepSeek rejects a tool whose schema has no top-level `type` with
  // "schema must be a JSON Schema of 'type: object'". A Type.Union of per-action
  // objects emits a bare `anyOf`, which is exactly that failure.
  test('is a root object schema, not a bare anyOf', () => {
    expect(schema.type).toBe('object')
    expect(schema.anyOf).toBeUndefined()
    expect(schema.oneOf).toBeUndefined()
  })

  test('requires only the action discriminator', () => {
    expect(schema.required).toEqual(['action'])
  })

  test('exposes the actions as a string enum', () => {
    expect(schema.properties.action).toMatchObject({
      type: 'string',
      enum: ['navigate', 'confirm'],
    })
  })

  test('keeps the per-action fields as optional siblings', () => {
    expect(schema.properties.path).toEqual({ type: 'string' })
    expect(schema.properties.message).toEqual({ type: 'string' })
  })
})

describe('Agent tool event result serialization', () => {
  test('preserves structured errors without producing object coercion noise', () => {
    expect(stringifyAgentToolEventResult({ error: new Error('Unknown flag --game-version') }))
      .toBe('{"error":{"name":"Error","message":"Unknown flag --game-version"}}')
    expect(stringifyAgentToolEventResult({ message: 'Invalid install ref' })).toBe('Invalid install ref')
    expect(stringifyAgentToolEventResult(textResult({ ok: false, reason: 'bad input' })))
      .toBe('{"ok":false,"reason":"bad input"}')
  })

  test('serializes structured and circular command results as useful JSON', () => {
    const result = { ok: true, applied: 2, removed: 1, modDiagnosis: { status: 'issues' } } as Record<string, unknown>
    result.self = result

    expect(serializeAgentToolValue(result)).toBe('{"ok":true,"applied":2,"removed":1,"modDiagnosis":{"status":"issues"},"self":"[Circular]"}')
    expect(textResult({ ok: true, applied: 2 }).content[0]).toEqual({ type: 'text', text: '{"ok":true,"applied":2}' })
  })

  test('preserves structured details from non-Error tool failures', async () => {
    const [tool] = wrapAgentToolsWithErrorNormalization([{
      name: 'vfs_read',
      executionMode: 'sequential',
      execute: async () => { throw { code: 'ENOENT', message: 'Config file not found', path: 'config/neoforge.toml' } },
    } as any])

    await expect(tool.execute('call-1', {}, undefined)).rejects.toThrow(
      '{"code":"ENOENT","message":"Config file not found","path":"config/neoforge.toml"}',
    )
  })
})

describe('Agent mutating tool failure guard', () => {
  const tools = [
    { name: 'vfs_read', executionMode: 'parallel' },
    { name: 'vfs_shell', executionMode: 'sequential' },
    { name: 'edit_instance', executionMode: 'sequential' },
  ] as any

  test('blocks later mutations in one assistant batch but still permits reads and the next batch', async () => {
    const guard = createAgentToolFailureGuard(tools)
    const failedBatch = {} as any
    const nextBatch = {} as any
    guard.beginToolBatch()
    await guard.afterToolCall({ assistantMessage: failedBatch, toolCall: { name: 'vfs_shell' }, isError: true } as any)

    await expect(guard.beforeToolCall({ assistantMessage: failedBatch, toolCall: { name: 'vfs_read' } } as any)).resolves.toBeUndefined()
    await expect(guard.beforeToolCall({ assistantMessage: failedBatch, toolCall: { name: 'edit_instance' } } as any)).resolves.toEqual({
      block: true,
      reason: 'Skipped because an earlier mutating tool call in this assistant batch failed.',
    })
    guard.beginToolBatch()
    await expect(guard.beforeToolCall({ assistantMessage: nextBatch, toolCall: { name: 'edit_instance' } } as any)).resolves.toBeUndefined()
  })

  test('does not block a mutation after a failed read-only tool', async () => {
    const guard = createAgentToolFailureGuard(tools)
    const batch = {} as any
    guard.beginToolBatch()
    await guard.afterToolCall({ assistantMessage: batch, toolCall: { name: 'vfs_read' }, isError: true } as any)

    await expect(guard.beforeToolCall({ assistantMessage: batch, toolCall: { name: 'edit_instance' } } as any)).resolves.toBeUndefined()
  })

  test('blocks a mutation after an argument-validation failure reported by the event stream', async () => {
    const guard = createAgentToolFailureGuard(tools)
    guard.beginToolBatch()
    guard.recordToolResult('edit_instance', true)

    await expect(guard.beforeToolCall({ assistantMessage: {}, toolCall: { name: 'vfs_shell' } } as any)).resolves.toMatchObject({ block: true })
  })

  test.each([
    { error: 'install failed' },
    { ok: false, reason: 'permission denied' },
  ])('marks a semantic mutation failure as an error and blocks the next mutation', async (details) => {
    const guard = createAgentToolFailureGuard(tools)
    guard.beginToolBatch()

    await expect(guard.afterToolCall({
      assistantMessage: {},
      toolCall: { name: 'vfs_shell' },
      result: textResult(details),
      isError: false,
    } as any)).resolves.toEqual({ isError: true })
    await expect(guard.beforeToolCall({ assistantMessage: {}, toolCall: { name: 'edit_instance' } } as any)).resolves.toMatchObject({ block: true })
  })
})

describe('Agent tool result spilling', () => {
  test('keeps small results inline and spills large results with a readable preview', async () => {
    const writeArtifact = vi.fn(async (content: string) => ({
      path: 'artifacts/modrinth-tags-1.json',
      length: content.length,
      createdAt: 1,
    }))
    const small = textResult({ ok: true })
    await expect(spillAgentToolResult(small, 'vfs_shell', writeArtifact, { inlineLimit: 20 })).resolves.toBe(small)
    expect(writeArtifact).not.toHaveBeenCalled()

    const large = textResult('abcdefghijklmnopqrstuvwxyz')
    const spilled = await spillAgentToolResult(large, 'vfs_shell', writeArtifact, { inlineLimit: 20, previewLimit: 8 })
    expect(writeArtifact).toHaveBeenCalledWith('abcdefghijklmnopqrstuvwxyz', 'vfs_shell')
    expect(spilled.content[0]).toMatchObject({ type: 'text' })
    expect(spilled.content[0].type === 'text' ? spilled.content[0].text : '').toContain('artifacts/modrinth-tags-1.json')
    expect(spilled.content[0].type === 'text' ? spilled.content[0].text : '').toContain('abcdefgh')
    expect(spilled.content[0].type === 'text' ? spilled.content[0].text : '').toContain('grep -i <pattern> artifacts/modrinth-tags-1.json')
    expect(spilled.details).toEqual({
      artifact: { path: 'artifacts/modrinth-tags-1.json', length: 26, createdAt: 1 },
      previewLength: 8,
    })
  })
})
