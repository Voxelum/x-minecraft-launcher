import { describe, expect, it } from 'vitest'
import { TransportFrameDecoder } from './framing'

function frame(payload: Uint8Array) {
  const result = new Uint8Array(payload.byteLength + 4)
  new DataView(result.buffer).setUint32(0, payload.byteLength)
  result.set(payload, 4)
  return result
}

describe('TransportFrameDecoder', () => {
  it('decodes frames across every chunk boundary', () => {
    const expected = [
      new Uint8Array(),
      new TextEncoder().encode('small'),
      new Uint8Array(16 * 1024).map((_, index) => index % 251),
    ]
    const stream = new Uint8Array(expected.reduce((size, value) => size + value.byteLength + 4, 0))
    let offset = 0
    for (const payload of expected) {
      const encoded = frame(payload)
      stream.set(encoded, offset)
      offset += encoded.byteLength
    }

    for (const chunkSize of [1, 2, 3, 4, 7, 64, 4096, stream.byteLength]) {
      const decoder = new TransportFrameDecoder()
      const actual: Uint8Array[] = []
      for (let start = 0; start < stream.byteLength; start += chunkSize) {
        actual.push(...decoder.push(stream.subarray(start, start + chunkSize)))
      }
      expect(actual).toEqual(expected)
    }
  })
})