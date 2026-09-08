export class TransportFrameDecoder {
  private readonly chunks: Uint8Array[] = []
  private offset = 0
  private available = 0
  private frameLength: number | undefined

  push(chunk: Uint8Array) {
    if (chunk.byteLength > 0) {
      this.chunks.push(chunk)
      this.available += chunk.byteLength
    }

    const frames: Uint8Array[] = []
    while (true) {
      if (this.frameLength === undefined) {
        if (this.available < 4) break
        const header = this.read(4)
        this.frameLength = new DataView(header.buffer, header.byteOffset, 4).getUint32(0)
      }
      if (this.available < this.frameLength) break
      frames.push(this.read(this.frameLength))
      this.frameLength = undefined
    }
    return frames
  }

  private read(length: number) {
    if (length === 0) return new Uint8Array()
    const first = this.chunks[0]
    const remaining = first.byteLength - this.offset
    if (remaining >= length) {
      const result = first.subarray(this.offset, this.offset + length)
      this.offset += length
      this.available -= length
      if (this.offset === first.byteLength) {
        this.chunks.shift()
        this.offset = 0
      }
      return result
    }

    const result = new Uint8Array(length)
    let written = 0
    while (written < length) {
      const current = this.chunks[0]
      const size = Math.min(current.byteLength - this.offset, length - written)
      result.set(current.subarray(this.offset, this.offset + size), written)
      written += size
      this.offset += size
      if (this.offset === current.byteLength) {
        this.chunks.shift()
        this.offset = 0
      }
    }
    this.available -= length
    return result
  }
}