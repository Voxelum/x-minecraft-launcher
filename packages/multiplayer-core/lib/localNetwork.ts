export interface LocalSocket {
  readonly id: string
  write(data: ArrayBuffer): boolean
  end(): void
  pause(): void
  resume(): void
  close(): void
  onData(listener: (data: ArrayBuffer) => void): void
  onWrite(listener: (bytes: number) => void): void
  onDrain(listener: () => void): void
  onClose(listener: () => void): void
  onError(listener: (error: Error) => void): void
}

export interface LocalServer {
  readonly id: string
  readonly port: number
  close(): void
  onConnection(listener: (socket: LocalSocket) => void): void
}

export interface LocalLanServer {
  motd: string
  port: number
}

export interface LocalNetwork {
  connect(port: number): Promise<LocalSocket>
  listen(port: number, localOnly?: boolean): Promise<LocalServer>
  discoverLan(listener: (server: LocalLanServer) => void): Promise<void>
  stopLanDiscovery?(listener: (server: LocalLanServer) => void): void
  broadcastLan(server: LocalLanServer): Promise<void>
}

export interface SharedFiles {
  share(instancePath: string | undefined, files: string[]): Promise<void>
  open(path: string): Promise<import('./fileTransfer').TransferReadable>
}
