import { describe, expect, it } from 'vitest'
import { summarizeCandidates, summarizeError, summarizeIceServer } from './logger'

describe('multiplayer logger summaries', () => {
  it('summarizes candidates without retaining addresses or candidate strings', () => {
    const summary = summarizeCandidates([
      { candidate: 'candidate:1 1 udp 1 192.168.1.2 40000 typ host' },
      { candidate: 'candidate:2 1 udp 1 198.51.100.2 40001 typ srflx' },
      { candidate: 'candidate:3 1 tcp 1 203.0.113.2 443 typ relay' },
    ])

    expect(summary).toEqual({ total: 3, host: 1, srflx: 1, prflx: 0, relay: 1, udp: 2, tcp: 1 })
    expect(JSON.stringify(summary)).not.toContain('192.168.1.2')
  })

  it('removes embedded ICE credentials while preserving the endpoint', () => {
    expect(
      summarizeIceServer({
        urls: 'turn:user:password@relay.example.com:3478?transport=udp',
        username: 'user',
        credential: 'password',
      }),
    ).toEqual({
      urls: ['turn:relay.example.com:3478?transport=udp'],
      authenticated: true,
    })
  })

  it('bounds error messages and omits stacks', () => {
    const summary = summarizeError(new Error('x'.repeat(2_000)))

    expect(summary.name).toBe('Error')
    expect(summary.message).toHaveLength(1_024)
    expect(summary).not.toHaveProperty('stack')
  })
})
