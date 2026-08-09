import type { PeerSession } from '../connection'

export interface MessageEntry<T> {
  type: MessageType<T>
  handler: MessageHandler<T>
}

export type MessageHandler<T> = (this: PeerSession, message: T) => void

// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
export interface MessageType<T> extends String { }

export function defineMessage<T>(type: MessageType<T>, handler: MessageHandler<T>):MessageEntry<T> {
  return {
    type,
    handler,
  }
}
