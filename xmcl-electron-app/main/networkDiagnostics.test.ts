import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectNatType } from './networkDiagnostics'

const { getNatInfoUDP } = vi.hoisted(() => ({
  getNatInfoUDP: vi.fn(),
}))

vi.mock('@xmcl/nat-api', () => ({
  createSsdp: vi.fn().mockRejectedValue(new Error('unavailable')),
  UpnpClient: vi.fn(),
}))

vi.mock('@xmcl/stun-client', () => ({
  getNatInfoUDP,
  sampleNatType: vi.fn(),
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('detectNatType', () => {
  it('finishes when one STUN probe never responds', async () => {
    vi.useFakeTimers()
    getNatInfoUDP
      .mockResolvedValueOnce({ type: 'Blocked' })
      .mockImplementationOnce(() => new Promise(() => {}))

    const result = detectNatType([{ urls: ['stun:blocked.test', 'stun:hanging.test'] }])
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(result).resolves.toEqual({ ips: [], natType: 'Blocked' })
  })
})
