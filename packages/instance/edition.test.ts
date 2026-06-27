import { describe, expect, it } from 'vitest'
import { DEFAULT_INSTANCE_EDITION, InstanceDataSchema, isBedrockInstance } from './instance'

describe('instance edition', () => {
  it('should default to java when edition is absent', () => {
    const parsed = InstanceDataSchema.parse({ name: 'test' })
    expect(parsed.edition).toEqual(DEFAULT_INSTANCE_EDITION)
    expect(parsed.edition).toEqual('java')
  })

  it('should keep a valid bedrock edition', () => {
    const parsed = InstanceDataSchema.parse({ name: 'test', edition: 'bedrock' })
    expect(parsed.edition).toEqual('bedrock')
  })

  it('should fall back to java for an invalid edition value', () => {
    const parsed = InstanceDataSchema.parse({ name: 'test', edition: 'nope' as any })
    expect(parsed.edition).toEqual('java')
  })

  it('isBedrockInstance should detect bedrock instances', () => {
    expect(isBedrockInstance({ edition: 'bedrock' })).toBe(true)
    expect(isBedrockInstance({ edition: 'java' })).toBe(false)
    // Legacy instances created before the edition field existed.
    expect(isBedrockInstance({})).toBe(false)
  })
})
