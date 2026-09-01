import { MinecraftLanDiscover } from '@xmcl/client'
import type { TransferReadable } from '@xmcl/multiplayer-core/fileTransfer'
import type {
  LocalLanServer,
  LocalNetwork,
  LocalServer,
  LocalSocket,
  SharedFiles,
} from '@xmcl/multiplayer-core/localNetwork'
import { createReadStream, type ReadStream } from 'fs'
import { realpath } from 'fs/promises'
import { createServer, Socket, type Server } from 'net'
import { isAbsolute, relative, resolve } from 'path'
import { randomUUID } from 'crypto'

type Listener<T> = (value: T) => void

class NodeLocalSocket implements LocalSocket {
  readonly id = randomUUID()
  private readonly writeListeners = new Set<Listener<number>>()

  constructor(
    private readonly socket: Socket,
    private readonly onDisposed: () => void,
  ) {
    socket.once('close', onDisposed)
  }

  write(data: ArrayBuffer) {
    return this.socket.write(Buffer.from(data), () => {
      for (const listener of this.writeListeners) listener(data.byteLength)
    })
  }

  end() {
    this.socket.end()
  }

  pause() {
    this.socket.pause()
  }

  resume() {
    this.socket.resume()
  }

  close() {
    this.socket.destroy()
  }

  onData(listener: Listener<ArrayBuffer>) {
    this.socket.on('data', (data) => listener(Uint8Array.from(data).buffer))
  }

  onWrite(listener: Listener<number>) {
    this.writeListeners.add(listener)
  }

  onDrain(listener: () => void) {
    this.socket.on('drain', listener)
  }

  onClose(listener: () => void) {
    this.socket.on('close', listener)
  }

  onError(listener: Listener<Error>) {
    this.socket.on('error', listener)
  }
}

class NodeLocalServer implements LocalServer {
  readonly id = randomUUID()
  private readonly listeners = new Set<Listener<LocalSocket>>()
  private readonly queued: LocalSocket[] = []
  private closed = false

  constructor(
    private readonly server: Server,
    readonly port: number,
    private readonly onDisposed: () => void,
  ) {}

  accept(socket: LocalSocket) {
    if (this.closed) {
      socket.close()
      return
    }
    if (this.listeners.size === 0) {
      this.queued.push(socket)
      return
    }
    for (const listener of this.listeners) listener(socket)
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.onDisposed()
    for (const socket of this.queued) socket.close()
    this.queued.length = 0
    this.server.close()
  }

  onConnection(listener: Listener<LocalSocket>) {
    this.listeners.add(listener)
    for (const socket of this.queued.splice(0)) listener(socket)
  }
}

export interface MainLocalNetwork extends LocalNetwork {
  dispose(): Promise<void>
}

type LanFamily = 'udp4' | 'udp6'

export function createMainLocalNetwork(
  onLanDiscoveryError?: (family: LanFamily, error: unknown) => void,
): MainLocalNetwork {
  const sockets = new Set<NodeLocalSocket>()
  const servers = new Set<NodeLocalServer>()
  const lanListeners = new Set<Listener<LocalLanServer>>()
  const lanDiscovers = new Map<LanFamily, MinecraftLanDiscover>()
  let lanReady: Promise<void> | undefined

  const wrapSocket = (socket: Socket) => {
    let wrapped!: NodeLocalSocket
    wrapped = new NodeLocalSocket(socket, () => sockets.delete(wrapped))
    sockets.add(wrapped)
    return wrapped
  }

  const ensureLanDiscovery = () => {
    if (lanReady) return lanReady
    const attempts = (['udp4', 'udp6'] as const).map(async (family) => {
      const discover = new MinecraftLanDiscover(family)
      discover.on('discover', (server) => {
        for (const listener of lanListeners) listener(server)
      })
      try {
        await discover.bind()
        lanDiscovers.set(family, discover)
      } catch (error) {
        await discover.destroy().catch(() => {})
        onLanDiscoveryError?.(family, error)
        throw error
      }
    })
    lanReady = Promise.allSettled(attempts)
      .then((results) => {
        if (lanDiscovers.size > 0) return
        const error = results.find((result) => result.status === 'rejected')
        throw error?.status === 'rejected' ? error.reason : new Error('lan_discovery_start_failed')
      })
      .catch((error) => {
        lanReady = undefined
        throw error
      })
    return lanReady
  }

  return {
    connect(port) {
      return new Promise<LocalSocket>((resolveConnection, reject) => {
        const socket = new Socket()
        const onConnect = () => {
          socket.off('error', onError)
          resolveConnection(wrapSocket(socket))
        }
        const onError = (error: Error) => {
          socket.off('connect', onConnect)
          socket.destroy()
          reject(error)
        }
        socket.once('connect', onConnect)
        socket.once('error', onError)
        socket.connect({ host: '127.0.0.1', port })
      })
    },
    async listen(requestedPort, localOnly) {
      let wrapped!: NodeLocalServer
      const server = createServer((socket) => wrapped.accept(wrapSocket(socket)))
      const port = await listen(server, requestedPort, localOnly === true)
      wrapped = new NodeLocalServer(server, port, () => servers.delete(wrapped))
      servers.add(wrapped)
      return wrapped
    },
    async discoverLan(listener) {
      lanListeners.add(listener)
      try {
        await ensureLanDiscovery()
      } catch (error) {
        lanListeners.delete(listener)
        throw error
      }
    },
    stopLanDiscovery(listener) {
      lanListeners.delete(listener)
      if (lanListeners.size === 0 && lanDiscovers.size > 0) {
        const discovers = Array.from(lanDiscovers.values())
        lanDiscovers.clear()
        lanReady = undefined
        for (const discover of discovers) void discover.destroy().catch(() => {})
      }
    },
    async broadcastLan(server) {
      await ensureLanDiscovery()
      const results = await Promise.allSettled(
        Array.from(lanDiscovers.values(), (discover) => discover.broadcast(server)),
      )
      if (results.some((result) => result.status === 'fulfilled')) return
      const error = results.find((result) => result.status === 'rejected')
      throw error?.status === 'rejected' ? error.reason : new Error('lan_broadcast_failed')
    },
    async dispose() {
      for (const server of Array.from(servers)) server.close()
      for (const socket of Array.from(sockets)) socket.close()
      const discovers = Array.from(lanDiscovers.values())
      lanDiscovers.clear()
      lanReady = undefined
      lanListeners.clear()
      await Promise.allSettled(discovers.map((discover) => discover.destroy()))
    },
  }
}

class NodeTransferReadable implements TransferReadable {
  constructor(private readonly stream: ReadStream) {
    stream.pause()
  }

  pause() {
    this.stream.pause()
  }

  resume() {
    this.stream.resume()
  }

  close() {
    this.stream.destroy()
  }

  onData(listener: Listener<ArrayBuffer>) {
    this.stream.on('data', (data) => {
      const bytes = typeof data === 'string' ? Buffer.from(data) : data
      listener(Uint8Array.from(bytes).buffer)
    })
  }

  onClose(listener: () => void) {
    this.stream.on('close', listener)
  }

  onError(listener: Listener<Error>) {
    this.stream.on('error', listener)
  }
}

export function createMainSharedFiles(): SharedFiles {
  let sharedRoot: string | undefined
  let sharedPaths = new Set<string>()
  return {
    async share(instancePath, files) {
      const nextRoot = instancePath ? await realpath(resolve(instancePath)) : undefined
      const nextPaths = new Set(files.map(validateSharedPath))
      sharedRoot = nextRoot
      sharedPaths = nextPaths
    },
    async open(rawPath) {
      const path = validateSharedPath(rawPath)
      const root = sharedRoot
      if (!root || !sharedPaths.has(path)) throw new Error('multiplayer_shared_file_forbidden')
      const fullPath = await realpath(resolve(root, path))
      const childPath = relative(root, fullPath)
      if (!childPath || childPath.startsWith('..') || isAbsolute(childPath)) {
        throw new Error('multiplayer_shared_file_forbidden')
      }
      if (sharedRoot !== root || !sharedPaths.has(path)) {
        throw new Error('multiplayer_shared_file_forbidden')
      }
      return new NodeTransferReadable(createReadStream(fullPath))
    },
  }
}

function validateSharedPath(value: string) {
  if (!value || value.includes('\0') || isAbsolute(value)) {
    throw new Error('multiplayer_shared_file_invalid_path')
  }
  const normalized = value.replace(/\\/g, '/')
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('multiplayer_shared_file_invalid_path')
  }
  return normalized
}

async function listen(server: Server, requestedPort: number, localOnly: boolean) {
  for (let port = requestedPort; port <= 65_535; port++) {
    const listening = await new Promise<boolean>((resolveListen, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('listening', onListening)
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolveListen(false)
        else reject(error)
      }
      const onListening = () => {
        server.off('error', onError)
        resolveListen(true)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen({ host: localOnly ? '127.0.0.1' : '0.0.0.0', port, exclusive: true })
    })
    if (listening) return port
  }
  throw new Error('multiplayer_local_network_no_available_port')
}
