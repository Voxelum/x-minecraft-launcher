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
      if (this.inbound && !this.inbound.responsed && this.channel.readyState === 'open') {
        // keep sending request message to peer
        this.channel.send(`download:${this.inbound.target}`)
      }
    }, 1000)
    channel.bufferedAmountLowThreshold = maxChunk * 4
    channel.onmessage = (msg) => {
      if (typeof msg.data === 'string') {
        if (msg.data === 'end') {
          this.inbound?.stream.end()
          this.inbound = undefined
        } else if (msg.data.startsWith('error:')) {
          const errorMsg = msg.data.substring(6)
          console.error('Error while download stream', errorMsg)
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

          const readable = createStream(path)
          if (typeof readable === 'string') {
            // reject the file
            console.log(`Reject peer file request ${path} due to ${readable}`)
            channel.send(readable)
          } else {
            this.outbound = {
              stream: readable,
              target: path,
            }
            channel.onbufferedamountlow = () => {
              if (readable.isPaused()) {
                readable.resume()
              }
            }
            console.log(`Process peer file request: ${path}`)
            readable.on('data', (data: Buffer) => {
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
              if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
                if (!readable.isPaused()) {
                  readable.pause()
                }
              }
            })
            readable.on('end', () => {
              channel.send('end')
              this.outbound = undefined
            }).on('error', (err) => {
              console.error('Error while reading stream', err)
              channel.send(`error:${err.message}`)
              this.outbound = undefined
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