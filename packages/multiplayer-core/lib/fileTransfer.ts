export interface TransferReadable {
  pause(): void
  resume(): void
  close(): void
  onData(listener: (data: ArrayBuffer) => void): void
  onClose(listener: () => void): void
  onError(listener: (error: Error) => void): void
}

export interface TransferWritable {
  write(data: ArrayBuffer): boolean
  end(): void
  destroy(error: Error): void
  onDrain(listener: () => void): void
}

export type TransferSource =
  | { size: number; data: ArrayBuffer }
  | { size: number; stream: TransferReadable }

type ControlMessage =
  | { type: 'request'; id: number; path: string }
  | { type: 'response'; id: number; ok: boolean; size?: number; error?: string }
  | { type: 'end'; id: number }
  | { type: 'pause'; id: number }
  | { type: 'resume'; id: number }

interface PendingDownload {
  id: number
  path: string
  destination: TransferWritable
  resolve(): void
  reject(error: Error): void
  started: boolean
}

const defaultChunkSize = 16 * 1024

export class FileTransferChannel {
  private nextRequestId = 0
  private downloadQueue = Promise.resolve()
  private uploadQueue = Promise.resolve()
  private activeDownload: PendingDownload | undefined
  private activeUpload: { id: number; stream?: TransferReadable } | undefined
  private readonly openPromise: Promise<void>
  private resolveOpen!: () => void
  private rejectOpen!: (error: Error) => void
  private closed = false

  constructor(
    readonly channel: RTCDataChannel,
    private readonly openSource: (path: string) => Promise<TransferSource | undefined>,
    maxMessageSize?: number,
  ) {
    const negotiatedSize = Number.isFinite(maxMessageSize) && Number(maxMessageSize) > 0
      ? Number(maxMessageSize)
      : defaultChunkSize
    this.chunkSize = Math.max(1, Math.min(defaultChunkSize, negotiatedSize))
    this.openPromise = new Promise<void>((resolve, reject) => {
      this.resolveOpen = resolve
      this.rejectOpen = reject
    })
    void this.openPromise.catch(() => {})
    channel.binaryType = 'arraybuffer'
    channel.bufferedAmountLowThreshold = this.chunkSize * 4
    channel.onopen = () => this.resolveOpen()
    channel.onmessage = ({ data }) => this.handleMessage(data)
    channel.onbufferedamountlow = () => this.activeUpload?.stream?.resume()
    channel.onerror = () => this.close(new Error('multiplayer_file_channel_error'))
    channel.onclose = () => this.close(new Error('multiplayer_file_channel_closed'))
    if (channel.readyState === 'open') this.resolveOpen()
  }

  readonly chunkSize: number

  download(path: string, destination: TransferWritable) {
    const operation = () => this.startDownload(path, destination)
    const result = this.downloadQueue.then(operation, operation)
    this.downloadQueue = result.catch(() => {})
    return result
  }

  close(error = new Error('multiplayer_file_channel_closed')) {
    if (this.closed) return
    this.closed = true
    this.rejectOpen(error)
    this.activeUpload?.stream?.close()
    this.activeUpload = undefined
    const download = this.activeDownload
    this.activeDownload = undefined
    if (download) {
      download.destination.destroy(error)
      download.reject(error)
    }
    if (this.channel.readyState !== 'closed') this.channel.close()
  }

  private async startDownload(path: string, destination: TransferWritable) {
    await this.openPromise
    if (this.closed) throw new Error('multiplayer_file_channel_closed')
    return new Promise<void>((resolve, reject) => {
      const request: PendingDownload = {
        id: ++this.nextRequestId,
        path,
        destination,
        resolve,
        reject,
        started: false,
      }
      this.activeDownload = request
      destination.onDrain(() => {
        if (this.activeDownload === request) this.sendControl({ type: 'resume', id: request.id })
      })
      this.sendControl({ type: 'request', id: request.id, path })
    })
  }

  private handleMessage(data: unknown) {
    if (typeof data === 'string') {
      let message: ControlMessage
      try {
        message = JSON.parse(data) as ControlMessage
      } catch {
        this.close(new Error('multiplayer_file_channel_invalid_message'))
        return
      }
      this.handleControl(message)
      return
    }
    const chunk = toArrayBuffer(data)
    const download = this.activeDownload
    if (!chunk || !download?.started) {
      this.close(new Error('multiplayer_file_channel_unexpected_data'))
      return
    }
    if (!download.destination.write(chunk)) {
      this.sendControl({ type: 'pause', id: download.id })
    }
  }

  private handleControl(message: ControlMessage) {
    if (!message || typeof message !== 'object' || !Number.isSafeInteger(message.id)) return
    if (message.type === 'request' && typeof message.path === 'string') {
      const operation = () => this.sendSource(message.id, message.path)
      const result = this.uploadQueue.then(operation, operation)
      this.uploadQueue = result.catch(() => {})
      return
    }
    if (message.type === 'pause' && this.activeUpload?.id === message.id) {
      this.activeUpload.stream?.pause()
      return
    }
    if (message.type === 'resume' && this.activeUpload?.id === message.id) {
      this.activeUpload.stream?.resume()
      return
    }
    const download = this.activeDownload
    if (!download || download.id !== message.id) return
    if (message.type === 'response') {
      if (!message.ok) {
        const error = new Error(message.error || 'multiplayer_file_not_found')
        this.activeDownload = undefined
        download.destination.destroy(error)
        download.reject(error)
      } else {
        download.started = true
      }
    } else if (message.type === 'end' && download.started) {
      this.activeDownload = undefined
      download.destination.end()
      download.resolve()
    }
  }

  private async sendSource(id: number, path: string) {
    await this.openPromise
    if (this.closed) return
    let source: TransferSource | undefined
    try {
      source = await this.openSource(path)
    } catch (error) {
      this.sendControl({
        type: 'response',
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }
    if (!source) {
      this.sendControl({ type: 'response', id, ok: false, error: 'multiplayer_file_not_found' })
      return
    }
    this.activeUpload = { id, stream: 'stream' in source ? source.stream : undefined }
    this.sendControl({ type: 'response', id, ok: true, size: source.size })
    if ('data' in source) {
      await this.sendBuffer(source.data)
      this.finishUpload(id)
      return
    }
    await new Promise<void>((resolve, reject) => {
      source.stream.onData((data) => {
        this.sendBufferNow(data)
        if (this.channel.bufferedAmount > this.channel.bufferedAmountLowThreshold) {
          source.stream.pause()
        }
      })
      source.stream.onError((error) => {
        source.stream.close()
        reject(error)
      })
      source.stream.onClose(resolve)
      source.stream.resume()
    }).then(
      () => this.finishUpload(id),
      (error) => {
        this.activeUpload = undefined
        this.sendControl({
          type: 'response',
          id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      },
    )
  }

  private async sendBuffer(data: ArrayBuffer) {
    const bytes = new Uint8Array(data)
    for (let offset = 0; offset < bytes.byteLength; offset += this.chunkSize) {
      while (this.channel.bufferedAmount > this.channel.bufferedAmountLowThreshold) {
        await new Promise<void>((resolve) => {
          const previous = this.channel.onbufferedamountlow
          this.channel.onbufferedamountlow = (event) => {
            previous?.call(this.channel, event)
            resolve()
          }
        })
      }
      this.channel.send(bytes.slice(offset, offset + this.chunkSize).buffer)
    }
  }

  private sendBufferNow(data: ArrayBuffer) {
    const bytes = new Uint8Array(data)
    for (let offset = 0; offset < bytes.byteLength; offset += this.chunkSize) {
      this.channel.send(bytes.slice(offset, offset + this.chunkSize).buffer)
    }
  }

  private finishUpload(id: number) {
    if (this.activeUpload?.id !== id) return
    this.activeUpload = undefined
    this.sendControl({ type: 'end', id })
  }

  private sendControl(message: ControlMessage) {
    if (!this.closed && this.channel.readyState === 'open') {
      this.channel.send(JSON.stringify(message))
    }
  }
}

function toArrayBuffer(data: unknown) {
  if (data instanceof ArrayBuffer) return data
  if (ArrayBuffer.isView(data)) {
    return Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).buffer
  }
  return undefined
}