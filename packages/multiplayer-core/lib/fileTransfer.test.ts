import { describe, expect, it, vi } from 'vitest'
import { FileTransferChannel, type TransferWritable } from './fileTransfer'

class FakeDataChannel {
  readonly readyState = 'open'
  readonly bufferedAmount = 0
  bufferedAmountLowThreshold = 0
  binaryType: BinaryType = 'arraybuffer'
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onbufferedamountlow: ((event: Event) => void) | null = null
  peer: FakeDataChannel | undefined
  readonly send = vi.fn((data: string | ArrayBuffer) => {
    queueMicrotask(() => this.peer?.onmessage?.({ data } as MessageEvent))
  })
  readonly close = vi.fn()
}

function channelPair() {
  const left = new FakeDataChannel()
  const right = new FakeDataChannel()
  left.peer = right
  right.peer = left
  return [left, right] as const
}

function destination() {
  const chunks: ArrayBuffer[] = []
  let resolve!: (value: Uint8Array) => void
  let reject!: (error: Error) => void
  const result = new Promise<Uint8Array>((res, rej) => {
    resolve = res
    reject = rej
  })
  const writable: TransferWritable = {
    write(data) {
      chunks.push(data)
      return true
    },
    end() {
      const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
      const output = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        output.set(new Uint8Array(chunk), offset)
        offset += chunk.byteLength
      }
      resolve(output)
    },
    destroy: reject,
    onDrain() {},
  }
  return { writable, result }
}

describe('FileTransferChannel', () => {
  it('chunks large payloads and serializes downloads over one channel', async () => {
    const [clientChannel, serverChannel] = channelPair()
    const first = Uint8Array.from({ length: 10_000 }, (_, index) => index % 251)
    const second = new TextEncoder().encode('second file')
    const openSource = vi.fn(async (path: string) => {
      const data = path === '/first' ? first : second
      return { size: data.byteLength, data: data.buffer as ArrayBuffer }
    })
    const client = new FileTransferChannel(
      clientChannel as unknown as RTCDataChannel,
      async () => undefined,
      1_024,
    )
    new FileTransferChannel(
      serverChannel as unknown as RTCDataChannel,
      openSource,
      1_024,
    )
    const firstDestination = destination()
    const secondDestination = destination()

    await Promise.all([
      client.download('/first', firstDestination.writable),
      client.download('/second', secondDestination.writable),
    ])

    await expect(firstDestination.result).resolves.toEqual(first)
    await expect(secondDestination.result).resolves.toEqual(second)
    expect(openSource.mock.calls.map(([path]) => path)).toEqual(['/first', '/second'])
    const chunks = serverChannel.send.mock.calls
      .map(([message]) => message)
      .filter((message): message is ArrayBuffer => message instanceof ArrayBuffer)
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks.every((chunk) => chunk.byteLength <= 1_024)).toBe(true)
  })
})