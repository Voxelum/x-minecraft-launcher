import { describe, expect, test } from 'vitest'
import { actionObjectSchema } from './toolSupport'

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
