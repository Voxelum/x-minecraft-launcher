// BoreClient.ts
import net from 'net'
import { MessageCodec } from './encoder'
import {
  BoreClientOptions,
  ServerMessage,
  HelloMessage,
  AuthenticateMessage,
  AcceptMessage,
  ChallengeMessage,
  ConnectionMessage,
  ErrorMessage,
  AuthenticationError,
  ConnectionError,
  ProtocolError,
  HelloResponse,
  Logger,
} from './types'

export class BoreClient {
  private readonly localHost: string
  private readonly localPort: number
  private readonly to: string
  private readonly secret?: string
  private readonly controlPort: number
  private remotePort?: number
  private controlSocket?: net.Socket
  private isRunning = false
  private messageBuffer = Buffer.alloc(0)
  private logger?: Logger

  constructor(options: BoreClientOptions) {
    this.localHost = options.localHost || 'localhost'
    this.localPort = options.localPort
    this.to = options.to || 'bore.pub'
    this.secret = options.secret
    this.controlPort = options.controlPort || 7835
    this.logger = options.logger
  }

  /**
   * 启动 bore 客户端
   */
  public async start(): Promise<number> {
    if (this.isRunning) {
      throw new Error('Client is already running')
    }

    try {
      // 建立控制连接
      this.controlSocket = await this.createControlConnection()

      // 发送 Hello 消息
      await this.sendHello(this.controlSocket)

      // 等待服务器响应
      const response = await this.waitForHelloResponse(this.controlSocket)
      this.remotePort = response.Hello

      // 开始监听连接请求
      this.listenForConnections(this.controlSocket)
      this.isRunning = true

      this.logger?.log(`Tunnel established: ${this.to}:${this.remotePort}`)
      return this.remotePort
    } catch (error) {
      this.cleanup()
      throw error
    }
  }

  private async sendHello(socket: net.Socket): Promise<void> {
    const helloMessage: HelloMessage = {
      Hello: this.localPort,
    }
    const data = MessageCodec.encode(helloMessage)
    socket.write(data)
  }

  /**
   * 等待 Hello 响应
   */
  private async waitForHelloResponse(socket: net.Socket): Promise<HelloResponse> {
    const response = await MessageCodec.readFromStream(socket)

    if ('Hello' in response) {
      return response as HelloResponse
    } else if ('Challenge' in response) {
      // 如果服务器要求认证
      await this.handleAuthentication(socket, response as ChallengeMessage)
      // 认证后重新等待 Hello 响应
      return this.waitForHelloResponse(socket)
    } else if ('Error' in response) {
      throw new ProtocolError(`Server error: ${(response as ErrorMessage).Error}`)
    } else {
      throw new ProtocolError(`Expected Hello response, got ${Object.keys(response)[0]}`)
    }
  }

  private async handleAuthentication(
    socket: net.Socket,
    challenge: ChallengeMessage,
  ): Promise<void> {
    if (!this.secret) {
      throw new AuthenticationError('Server requires authentication but no secret provided')
    }

    // 生成认证响应（简单实现，根据源码应该是某种 HMAC）
    const authResponse = this.generateAuthResponse(challenge.Challenge)

    const authenticateMessage: AuthenticateMessage = {
      Authenticate: authResponse,
    }

    const data = MessageCodec.encode(authenticateMessage)
    socket.write(data)

    // 等待认证结果
    const authResult = await MessageCodec.readFromStream(socket)

    if ('Error' in authResult) {
      throw new AuthenticationError(`Authentication failed: ${(authResult as ErrorMessage).Error}`)
    }
  }

  /**
   * 生成认证响应
   */
  private generateAuthResponse(challengeUuid: string): string {
    // 这里需要根据 bore 的实际认证算法实现
    // 暂时使用简单的 UUID + secret 组合
    const crypto = require('crypto')
    return crypto.createHmac('sha256', this.secret!).update(challengeUuid).digest('hex')
  }

  /**
   * 监听连接请求
   */
  private listenForConnections(socket: net.Socket): void {
    socket.on('data', (data: Buffer) => {
      this.messageBuffer = Buffer.concat([this.messageBuffer, data])

      try {
        const messages = MessageCodec.decode(this.messageBuffer)
        this.messageBuffer = Buffer.alloc(0) // 清空缓冲区

        for (const message of messages) {
          this.handleServerMessage(message)
        }
      } catch (error) {
        // 消息不完整，继续等待更多数据
      }
    })

    socket.on('close', () => {
      this.logger?.log('Control connection closed')
      this.stop()
    })

    socket.on('error', (error) => {
      this.logger?.error('Control connection error:', error)
      this.stop()
    })
  }

  private handleServerMessage(message: ServerMessage): void {
    if ('Connection' in message) {
      this.createDataTunnel((message as ConnectionMessage).Connection).catch((error) => {
        this.logger?.error('Failed to create data tunnel:', error)
      })
    } else if ('Heartbeat' in message) {
      // 可以发送心跳响应（如果需要）
    } else if ('Error' in message) {
      this.logger?.error('Server error:', (message as ErrorMessage).Error)
      this.stop()
    } else {
      this.logger?.warn('Unhandled message type:', Object.keys(message)[0])
    }
  }

  /**
   * 创建数据隧道
   */
  private async createDataTunnel(uuid: string): Promise<void> {
    try {
      // 建立数据隧道连接
      const tunnelSocket = await this.createControlConnection()

      // 发送 Accept 消息
      const acceptMessage: AcceptMessage = {
        Accept: uuid,
      }
      const data = MessageCodec.encode(acceptMessage)
      tunnelSocket.write(data)

      // 连接本地服务
      const localSocket = await this.connectToLocalService()

      // 双向代理流量
      tunnelSocket.pipe(localSocket)
      localSocket.pipe(tunnelSocket)

      this.logger?.log(`Data tunnel active for UUID: ${uuid}`)

      // 清理连接
      tunnelSocket.on('close', () => localSocket.destroy())
      localSocket.on('close', () => tunnelSocket.destroy())
    } catch (error) {
      this.logger?.error(`Failed to create data tunnel for UUID ${uuid}:`, error)
    }
  }

  /**
   * 创建控制连接
   */
  private async createControlConnection(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()

      const onError = (error: Error) => {
        socket.destroy()
        const connectionError: ConnectionError = new ConnectionError(
          `Failed to connect to ${this.to}:${this.controlPort}: ${error.message}`,
        )
        reject(connectionError)
      }

      socket.on('error', onError)
      socket.connect(this.controlPort, this.to, () => {
        socket.removeListener('error', onError)
        resolve(socket)
      })

      socket.setTimeout(10000, () => {
        socket.destroy()
        onError(new Error('Connection timeout'))
      })
    })
  }

  /**
   * 连接到本地服务
   */
  private async connectToLocalService(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()

      const onError = (error: Error) => {
        socket.destroy()
        reject(
          new Error(
            `Failed to connect to local service ${this.localHost}:${this.localPort}: ${error.message}`,
          ),
        )
      }

      socket.on('error', onError)
      socket.connect(this.localPort, this.localHost, () => {
        socket.removeListener('error', onError)
        resolve(socket)
      })

      socket.setTimeout(5000, () => {
        socket.destroy()
        onError(new Error('Local connection timeout'))
      })
    })
  }

  /**
   * 停止客户端并清理资源
   */
  public stop(): void {
    this.isRunning = false
    this.cleanup()
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.controlSocket) {
      this.controlSocket.destroy()
      this.controlSocket = undefined
    }
    this.messageBuffer = Buffer.alloc(0)
  }

  /**
   * 获取远程端口
   */
  public getRemotePort(): number | undefined {
    return this.remotePort
  }

  /**
   * 检查客户端是否运行中
   */
  public isClientRunning(): boolean {
    return this.isRunning
  }
}
