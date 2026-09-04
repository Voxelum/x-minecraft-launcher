import type { TransferWritable } from './fileTransfer'
import type { LocalNetwork, LocalSocket } from './localNetwork'

export interface DownloadPeer {
  download(path: string, destination: TransferWritable): Promise<void>
  getSharedFileSize(path: string): number | null | undefined
}

const maxRequestHeaderSize = 16 * 1024

export async function createPeerDownloadServer(
  localNetwork: LocalNetwork,
  getPeer: (id: string) => DownloadPeer | undefined,
  port = 25_566,
) {
  const server = await localNetwork.listen(port, true)
  server.onConnection((socket) => handleConnection(socket, getPeer))
  return server
}

function handleConnection(socket: LocalSocket, getPeer: (id: string) => DownloadPeer | undefined) {
  let request = new Uint8Array()
  let handled = false
  socket.onData((data) => {
    if (handled) return
    request = concat(request, new Uint8Array(data))
    if (request.byteLength > maxRequestHeaderSize) {
      handled = true
      respond(socket, 431, 'Request Header Fields Too Large')
      return
    }
    const headerEnd = findHeaderEnd(request)
    if (headerEnd < 0) return
    handled = true
    const line = new TextDecoder().decode(request.subarray(0, headerEnd)).split('\r\n', 1)[0]
    const match = /^GET\s+(\S+)\s+HTTP\/1\.[01]$/.exec(line)
    if (!match) {
      respond(socket, 400, 'Bad Request')
      return
    }
    let url: URL
    try {
      url = new URL(match[1], 'http://localhost')
    } catch {
      respond(socket, 400, 'Bad Request')
      return
    }
    const parts = url.pathname.split('/')
    const peer = parts[1] === 'files' ? getPeer(decodeURIComponent(parts[2] ?? '')) : undefined
    const encodedPath = url.searchParams.get('path')
    const path = encodedPath ? decodeBase64Url(encodedPath) : undefined
    if (!peer || path === undefined) {
      respond(socket, 404, 'Not Found')
      return
    }
    const size = peer.getSharedFileSize(path)
    if (size === undefined) {
      respond(socket, 404, 'Not Found')
      return
    }
    const contentLength = typeof size === 'number' ? `Content-Length: ${size}\r\n` : ''
    socket.write(encode(
      `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\n${contentLength}Connection: close\r\n\r\n`,
    ))
    void peer.download(path, socketWritable(socket)).catch(() => socket.close())
  })
  socket.onError(() => socket.close())
}

function socketWritable(socket: LocalSocket): TransferWritable {
  return {
    write: (data) => socket.write(data),
    end: () => socket.end(),
    destroy: () => socket.close(),
    onDrain: (listener) => socket.onDrain(listener),
  }
}

function respond(socket: LocalSocket, status: number, reason: string) {
  socket.write(encode(
    `HTTP/1.1 ${status} ${reason}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`,
  ))
  socket.end()
}

function encode(value: string) {
  const data = new TextEncoder().encode(value)
  return data.buffer as ArrayBuffer
}

function decodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
    return new TextDecoder().decode(Uint8Array.from(decoded, (character) => character.charCodeAt(0)))
  } catch {
    return undefined
  }
}

function concat(left: Uint8Array, right: Uint8Array) {
  const result = new Uint8Array(left.byteLength + right.byteLength)
  result.set(left)
  result.set(right, left.byteLength)
  return result
}

function findHeaderEnd(data: Uint8Array) {
  for (let index = 3; index < data.byteLength; index++) {
    if (
      data[index - 3] === 13 &&
      data[index - 2] === 10 &&
      data[index - 1] === 13 &&
      data[index] === 10
    ) return index + 1
  }
  return -1
}