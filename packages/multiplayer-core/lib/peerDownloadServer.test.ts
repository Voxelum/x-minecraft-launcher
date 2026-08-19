import { describe, expect, it, vi } from 'vitest'
import type { TransferWritable } from './fileTransfer'
import type { LocalNetwork, LocalServer, LocalSocket } from './localNetwork'
import { createPeerDownloadServer } from './peerDownload'

describe('peer download server', () => {
  it('forwards an HTTP peer request and gracefully ends the response', async () => {
    let accept!: (socket: LocalSocket) => void
    let receive!: (data: ArrayBuffer) => void
    const writes: ArrayBuffer[] = []
    const socket: LocalSocket = {
      id: 'socket',
      write: vi.fn((data) => {
        writes.push(data)
        return true
      }),
      end: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      close: vi.fn(),
      onData: vi.fn((listener) => { receive = listener }),
      onWrite: vi.fn(),
      onDrain: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    }
    const server: LocalServer = {
      id: 'server',
      port: 25_566,
      close: vi.fn(),
      onConnection: vi.fn((listener) => { accept = listener }),
    }
    const localNetwork: LocalNetwork = {
      listen: vi.fn(async () => server),
      connect: vi.fn(),
      discoverLan: vi.fn(),
      broadcastLan: vi.fn(),
    }
    const peer = {
      getSharedFileSize: vi.fn(() => 3),
      download: vi.fn(async (_path: string, destination: TransferWritable) => {
        destination.write(new TextEncoder().encode('abc').buffer)
        destination.end()
      }),
    }

    await createPeerDownloadServer(localNetwork, (id) => id === 'peer-id' ? peer : undefined)
    expect(localNetwork.listen).toHaveBeenCalledWith(25_566, true)
    accept(socket)
    const path = '/sharing/mods/example.jar'
    const encodedPath = btoa(path).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const request = new TextEncoder().encode(
      `GET /files/peer-id?path=${encodedPath} HTTP/1.1\r\nHost: localhost\r\n\r\n`,
    )
    receive(request.buffer as ArrayBuffer)
    await vi.waitFor(() => expect(peer.download).toHaveBeenCalled())

    expect(peer.getSharedFileSize).toHaveBeenCalledWith(path)
    expect(peer.download).toHaveBeenCalledWith(path, expect.any(Object))
    expect(new TextDecoder().decode(writes[0])).toContain('Content-Length: 3')
    expect(new TextDecoder().decode(writes[1])).toBe('abc')
    expect(socket.end).toHaveBeenCalledOnce()
  })
})