import type { TransferDescription } from '@xmcl/runtime-api'
import { describe, expect, it } from 'vitest'
import { decodeDescription, encodeDescription } from './codec'

describe('Together description codec', () => {
  it('round-trips a versioned Web Streams token', async () => {
    const description: TransferDescription = {
      id: 'peer-id',
      session: 'session-id',
      sdp: 'v=0\r\na=ice-ufrag:test\r\n',
      candidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 25565 typ host', mid: '0' }],
    }

    const token = await encodeDescription(description)

    expect(token).toMatch(/^m1\./)
    await expect(decodeDescription(token)).resolves.toEqual(description)
  })

  it('rejects legacy tokens explicitly', async () => {
    await expect(decodeDescription('legacy-token')).rejects.toThrow(
      'multiplayer_incompatible_description',
    )
  })
})