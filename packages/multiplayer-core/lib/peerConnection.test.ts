import { describe, expect, it, vi } from 'vitest'
import { createLocalOffer } from './peerConnection'

function connection(enableIceUdpMux: boolean) {
  const createOffer = vi.fn(async () => ({ type: 'offer' as const, sdp: 'offer' }))
  const setLocalDescription = vi.fn(async () => {})
  return {
    raw: {
      createOffer,
      setLocalDescription,
      getConfiguration: () => ({ enableIceUdpMux }),
    } as unknown as RTCPeerConnection,
    createOffer,
    setLocalDescription,
  }
}

describe('createLocalOffer', () => {
  it('applies the generated offer for a standard peer connection', async () => {
    const peer = connection(false)

    await expect(createLocalOffer(peer.raw)).resolves.toEqual({ type: 'offer', sdp: 'offer' })
    expect(peer.setLocalDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'offer' })
  })

  it('starts native ICE gathering before awaiting the deferred offer', async () => {
    const peer = connection(true)

    await expect(createLocalOffer(peer.raw)).resolves.toEqual({ type: 'offer', sdp: 'offer' })
    expect(peer.setLocalDescription).toHaveBeenCalledWith({ type: 'offer' })
  })
})
