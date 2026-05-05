import { ClientMessage, ServerMessage } from './types'

// MessageCodec.ts
export class MessageCodec {
  private static readonly DELIMITER = '\0'

  /**
   * 编码消息为 null 分隔的 JSON
   */
  public static encode(message: ClientMessage): Buffer {
    const json = JSON.stringify(message)
    return Buffer.from(json + this.DELIMITER)
  }

  /**
   * 从缓冲区解码消息
   */
  public static decode(buffer: Buffer): ServerMessage[] {
    const messages: ServerMessage[] = []
    const parts = buffer.toString().split(this.DELIMITER)

    // 最后一个空字符串是由于分隔符产生的
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i].trim()) {
        try {
          const message = JSON.parse(parts[i])
          messages.push(message)
        } catch (error) {
          throw new Error(`Failed to parse message: ${parts[i]}`)
        }
      }
    }

    return messages
  }

  /**
   * 从流中读取消息
   */
  public static async readFromStream(socket: import('net').Socket): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const buffer: Buffer[] = []

      const onData = (data: Buffer) => {
        buffer.push(data)
        const combined = Buffer.concat(buffer)

        try {
          const messages = this.decode(combined)
          if (messages.length > 0) {
            socket.removeListener('data', onData)
            socket.removeListener('error', onError)
            resolve(messages[0]) // 返回第一个完整消息
          }
        } catch (error) {
          socket.removeListener('data', onData)
          socket.removeListener('error', onError)
          reject(error)
        }
      }

      const onError = (error: Error) => {
        socket.removeListener('data', onData)
        socket.removeListener('error', onError)
        reject(error)
      }

      socket.on('data', onData)
      socket.on('error', onError)

      // 3秒超时（与 bore 源码一致）
      setTimeout(() => {
        socket.removeListener('data', onData)
        socket.removeListener('error', onError)
        reject(new Error('Message read timeout'))
      }, 3000)
    })
  }
}
