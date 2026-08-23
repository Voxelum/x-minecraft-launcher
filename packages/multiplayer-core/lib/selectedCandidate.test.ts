import { describe, expect, it } from 'vitest'
import { getSelectedCandidatePair } from './selectedCandidate'

describe('getSelectedCandidatePair', () => {
  it('normalizes the node-datachannel selected pair', async () => {
    const connection = {
      selectedCandidatePair: () => ({
        local: {
          address: '192.0.2.10',
          port: 50_000,
          type: 'relay',
          transportType: 'udp',
        },
        remote: {
          address: '198.51.100.20',
          port: 34_789,
          type: 'srflx',
          transportType: 'udp',
        },
      }),
    }

    await expect(getSelectedCandidatePair(connection as unknown as RTCPeerConnection)).resolves.toEqual({
      local: {
        address: '192.0.2.10',
        port: 50_000,
        type: 'relay',
        transportType: 'udp',
      },
      remote: {
        address: '198.51.100.20',
        port: 34_789,
        type: 'srflx',
        transportType: 'udp',
      },
    })
  })

  it('reads the transport-selected pair from WebRTC stats', async () => {
    const stats = new Map<string, any>([
      ['local', { type: 'local-candidate', address: '192.0.2.1', port: 40_000, candidateType: 'host', protocol: 'udp' }],
      ['remote', { type: 'remote-candidate', address: '198.51.100.1', port: 40_001, candidateType: 'relay', protocol: 'tcp' }],
      ['pair', { type: 'candidate-pair', localCandidateId: 'local', remoteCandidateId: 'remote', state: 'succeeded', nominated: true }],
      ['transport', { type: 'transport', selectedCandidatePairId: 'pair' }],
    ])
    const connection = { getStats: async () => stats }

    await expect(getSelectedCandidatePair(connection as unknown as RTCPeerConnection)).resolves.toEqual({
      local: { address: '192.0.2.1', port: 40_000, type: 'host', transportType: 'udp' },
      remote: { address: '198.51.100.1', port: 40_001, type: 'relay', transportType: 'tcp' },
    })
  })
})
