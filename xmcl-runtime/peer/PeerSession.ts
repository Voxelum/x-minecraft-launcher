import { ConnectionUserInfo } from '@xmcl/runtime-api'
import { ServerProxy } from './ServerProxy'
import { Readable } from 'stream'
import { MessageType } from './messages/message'

export interface PeerSession {
  readonly id: string
  connection: RTCPeerConnection
  /**
   * The peer client id
   */
  remoteId: string
  lastGameChannelId: undefined | number
  remoteInfo: ConnectionUserInfo | undefined
  readonly proxies: ServerProxy[]

  initiate(): Promise<void>

  setConnection(connection: RTCPeerConnection): void

  createReadStream(file: string): Readable

  readonly isClosed: boolean

  close(): void

  send<T>(type: MessageType<T>, data: T): void
}
