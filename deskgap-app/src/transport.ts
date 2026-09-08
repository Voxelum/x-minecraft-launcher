import { Readable } from 'node:stream'

export const nativeFileHandlePrefix = 'deskgap-file-handle:'
const resourceProtocol = 'xmcl-resource://launcher'
const launcherOrigin = 'http://launcher'

type ResolveFileHandle = (handle: string) => string

export function decodeBrowserValue(value: unknown, resolveFileHandle: ResolveFileHandle): any {
  if (typeof value === 'string') {
    if (value.startsWith(nativeFileHandlePrefix)) {
      return resolveFileHandle(value.substring(nativeFileHandlePrefix.length))
    }
    if (value.startsWith(resourceProtocol)) return launcherOrigin + value.substring(resourceProtocol.length)
    return value
  }
  if (Array.isArray(value)) return value.map(entry => decodeBrowserValue(entry, resolveFileHandle))
  if (value === null || typeof value !== 'object') return value
  const tagged = value as { __xmclTransportType?: string; value?: string }
  if (tagged.__xmclTransportType === 'undefined') return undefined
  if (tagged.__xmclTransportType === 'bigint') return BigInt(tagged.value!)
  if (tagged.__xmclTransportType === 'bytes') return Buffer.from(tagged.value!, 'base64')
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decodeBrowserValue(entry, resolveFileHandle)]))
}

export function encodeBrowserValue(value: unknown, seen = new WeakSet<object>()): any {
  if (value === undefined) return { __xmclTransportType: 'undefined' }
  if (typeof value === 'bigint') return { __xmclTransportType: 'bigint', value: value.toString() }
  if (typeof value === 'string') {
    return value.startsWith(launcherOrigin) ? resourceProtocol + value.substring(launcherOrigin.length) : value
  }
  if (Buffer.isBuffer(value)) return { __xmclTransportType: 'bytes', value: value.toString('base64') }
  if (ArrayBuffer.isView(value)) {
    const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength)
    return { __xmclTransportType: 'bytes', value: bytes.toString('base64') }
  }
  if (value instanceof ArrayBuffer) {
    return { __xmclTransportType: 'bytes', value: Buffer.from(value).toString('base64') }
  }
  if (value instanceof URL) return value.toString()
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) throw new TypeError('Cannot send a cyclic value to the launcher renderer')
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map(entry => encodeBrowserValue(entry, seen))
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        ...(value as Error & { code?: unknown; details?: unknown }).code === undefined
          ? {}
          : { code: encodeBrowserValue((value as Error & { code?: unknown }).code, seen) },
      }
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encodeBrowserValue(entry, seen)]))
  } finally {
    seen.delete(value)
  }
}

export function encodeBrowserFrame(message: unknown) {
  const serialized = JSON.stringify(encodeBrowserValue(message))
  const length = Buffer.byteLength(serialized)
  const frame = Buffer.allocUnsafe(length + 4)
  frame.writeUInt32BE(length, 0)
  frame.write(serialized, 4, length, 'utf8')
  return frame
}

export function toWebResponseBody(body: string | Buffer | Readable | undefined): BodyInit | null {
  if (body === undefined) return null
  if (body instanceof Readable) return Readable.toWeb(body) as unknown as BodyInit
  return body as unknown as BodyInit
}