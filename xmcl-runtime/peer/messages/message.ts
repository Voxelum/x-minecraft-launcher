import { PeerSession } from '../connection'

export interface MessageEntry<T> {
  type: MessageType<T>
  handler: MessageHandler<T>
}

export type MessageHandler<T> = (this: PeerSession, message: T) => void

export interface MessageType<T> extends String { }

export function defineMessage<T>(type: MessageType<T>, handler: MessageHandler<T>):MessageEntry<T> {
  return {
    type,
    handler,
  }
}
