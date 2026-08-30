import { ResourceDomain } from '@xmcl/resource'
import type { ModMetadataFacts } from '@xmcl/runtime-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isResourceTelemetryPayloadKnown, ResourceTelemetryBatch, type ResourceTracingPayload } from './resourceTelemetryBatch'

function createFacts(overrides: Partial<ModMetadataFacts> = {}): ModMetadataFacts {
  return {
    sha1: 'known',
    name: 'example.jar',
    domain: ResourceDomain.Mods,
    forge: [],
    fabric: [],
    modrinth: [],
    curseforge: [],
    ...overrides,
  }
}

describe('resource telemetry deduplication', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps telemetry when it adds metadata to a known checksum', () => {
    const payload: ResourceTracingPayload = {
      sha1: 'known',
      domain: ResourceDomain.Mods,
      modrinth: { projectId: 'project', versionId: 'version' },
    }

    expect(isResourceTelemetryPayloadKnown(payload, createFacts())).toBe(false)
    expect(isResourceTelemetryPayloadKnown(payload, createFacts({
      modrinth: [{ id: 'project', version: 'version' }],
    }))).toBe(true)
  })

  it('batches lookups, suppresses known payloads, and sends unknown payloads', async () => {
    vi.useFakeTimers()
    const lookup = vi.fn().mockResolvedValue([createFacts()])
    const send = vi.fn()
    const batch = new ResourceTelemetryBatch(lookup, send, vi.fn())

    batch.enqueue({ sha1: 'known', domain: ResourceDomain.Mods })
    batch.enqueue({ sha1: 'unknown', domain: ResourceDomain.Mods })

    await vi.advanceTimersByTimeAsync(1_000)
    await batch.flush()

    expect(lookup).toHaveBeenCalledOnce()
    expect(lookup).toHaveBeenCalledWith(['known', 'unknown'])
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0][0].payload.sha1).toBe('unknown')
  })

  it('processes an identical payload only once per process', async () => {
    const lookup = vi.fn().mockResolvedValue(undefined)
    const send = vi.fn()
    const batch = new ResourceTelemetryBatch(lookup, send, vi.fn())
    const payload = { sha1: 'unknown', domain: ResourceDomain.Mods } as const

    batch.enqueue(payload)
    batch.enqueue(payload)
    await batch.flush()
    batch.enqueue(payload)
    await batch.flush()

    expect(lookup).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledOnce()
  })

  it('falls back to sending the batch when the local lookup fails', async () => {
    const error = new Error('database is corrupt')
    const lookup = vi.fn().mockRejectedValue(error)
    const send = vi.fn()
    const onLookupError = vi.fn()
    const batch = new ResourceTelemetryBatch(lookup, send, onLookupError)

    batch.enqueue({ sha1: 'unknown', domain: ResourceDomain.Mods })
    await batch.flush()

    expect(onLookupError).toHaveBeenCalledWith(error)
    expect(send).toHaveBeenCalledOnce()
  })
})
