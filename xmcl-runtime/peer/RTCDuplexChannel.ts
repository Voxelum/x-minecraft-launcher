import { Readable, Writable } from 'stream'

interface Inbound {
  stream: Writable
  /**
   * The requesting target
   */
  target: string

  responsed: boolean
}

interface Outbound {
  stream: Readable
  /**
   * The requesting target
   */
  target: string
}

export class RTCDuplexChannel {
  /**
   * Represent a inbound stream
   */
  private inbound: Inbound | undefined

  /**
   * Represent a outbound stream
   */
  private outbound: Outbound | undefined

  constructor(readonly channel: RTCDataChannel, createStream: (path: string) => Readable | string, maxChunk: number) {
    setInterval(() => {
      if (this.inbound && !this.inbound.responsed) {
        // keep sending request message to peer
        this.channel.send(`download:${this.inbound}`)
      }
    }, 1000)
    channel.onmessage = (msg) => {
      if (typeof msg.data === 'string') {
        if (msg.data === 'end') {
          this.inbound?.stream.end()
          this.inbound = undefined
        } else if (msg.data.startsWith('error:')) {
          const errorMsg = msg.data.substring(6)
          this.inbound?.stream.destroy(new Error(errorMsg))
          this.inbound = undefined
        } else if (msg.data.startsWith('download:')) {
          // Handle outbound file request
          const path = msg.data.substring(9)

          if (this.outbound) {
            if (this.outbound.target !== path) {
              // reject the file
              console.log(`Reject peer file request ${path} due to ${this.outbound.target}`)
              channel.send('error:busy')
            }
            return
          }

          const result = createStream(path)
          if (typeof result === 'string') {
            // reject the file
            console.log(`Reject peer file request ${path} due to ${result}`)
            channel.send(result)
          } else {
            this.outbound = {
              stream: result,
              target: path,
            }
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
        if (this.inbound) {
          this.inbound.responsed = true
          this.inbound.stream.write(Buffer.from(msg.data))
        }
      }
    }
  }

  get isBusy(): boolean {
    return this.inbound !== undefined || this.outbound !== undefined
  }

  download(file: string, destination: Writable) {
    this.inbound = {
      stream: destination,
      target: file,
      responsed: false,
    }
  }
}