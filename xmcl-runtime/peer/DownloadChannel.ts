import { Readable, Writable } from 'stream'

export class DownloadChannel {
  private destination: Writable | undefined

  constructor(readonly channel: RTCDataChannel, createStream: (path: string) => Readable | string, maxChunk: number) {
    channel.onmessage = (msg) => {
      if (typeof msg.data === 'string') {
        if (msg.data === 'end') {
          this.destination?.end()
          this.destination = undefined
          this.onStateChanged(false)
        } else if (msg.data.startsWith('error:')) {
          const errorMsg = msg.data.substring(6)
          this.destination?.destroy(new Error(errorMsg))
          this.destination = undefined
          this.onStateChanged(false)
        } else if (msg.data.startsWith('download:')) {
          const path = msg.data.substring(9)
          const result = createStream(path)
          if (typeof result === 'string') {
            // reject the file
            console.log(`Reject peer file request ${path} due to ${result}`)
            channel.send(result)
            channel.close()
          } else {
            console.log(`Process peer file request: ${path}`)
            result.on('data', (data: Buffer) => {
              if (data.length > maxChunk) {
                let pivot = 0
                while (pivot < data.length) {
                  const sub = data.subarray(pivot, pivot + maxChunk)
                  channel.send(sub)
                  pivot += sub.length
                }
              } else {
                channel.send(data.buffer)
              }
            })
            result.on('end', () => {
              channel.send('end')
            })
          }
        }
      } else {
        this.destination?.write(Buffer.from(msg.data))
      }
    }
  }

  onStateChanged = (isBusy: boolean) => { }

  get isBusy(): boolean {
    return this.destination !== undefined
  }

  start(file: string, destination: Writable) {
    this.destination = destination
    this.onStateChanged(true)
    this.channel.send(`download:${file}`)
  }
}