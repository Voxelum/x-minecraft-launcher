// types.ts
export interface Logger {
  log: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
}

export interface BoreClientOptions {
  localHost?: string
  localPort: number
  to?: string
  secret?: string
  controlPort?: number
  logger?: Logger
}

export interface AuthenticateMessage {
  Authenticate: string
}

export interface HelloMessage {
  Hello: number
}

export interface AcceptMessage {
  Accept: string // UUID
}

export type ClientMessage = AuthenticateMessage | HelloMessage | AcceptMessage

export interface ChallengeMessage {
  Challenge: string // UUID
}

export interface HelloResponse {
  Hello: number
}

export interface HeartbeatMessage {
  Heartbeat: any // Probably empty or null
}

export interface ConnectionMessage {
  Connection: string // UUID
}

export interface ErrorMessage {
  Error: string
}

export type ServerMessage =
  | ChallengeMessage
  | HelloResponse
  | HeartbeatMessage
  | ConnectionMessage
  | ErrorMessage

export class AuthenticationError extends Error {
  name: 'AuthenticationError'
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class ConnectionError extends Error {
  name: 'ConnectionError'
  constructor(message: string) {
    super(message)
    this.name = 'ConnectionError'
  }
}

export class ProtocolError extends Error {
  name: 'ProtocolError'
  constructor(message: string) {
    super(message)
    this.name = 'ProtocolError'
  }
}
