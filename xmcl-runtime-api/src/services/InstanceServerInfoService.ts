import type { ServerInfo } from '@xmcl/game-data'
import { ServiceKey } from './Service'
import { SharedState } from '../util/SharedState'

export class ServerInfoWithStatus implements ServerInfo {
  readonly acceptTextures
  readonly icon
  readonly ip
  readonly name

  constructor(info: ServerInfo) {
    this.acceptTextures = info.acceptTextures
    this.icon = info.icon
    this.ip = info.ip
    this.name = info.name
  }
}

export function getServerInfoKey(path: string) {
  return 'instance-server-data://' + path
}

export class ServerInfoState {
  /**
   * Cache loaded server info in servers.dat
   */
  serverInfos: ServerInfoWithStatus[] = []
  /**
  * Update server infos in server.dat
  * @param infos The new server infos
  */
  instanceServerInfos(infos: ServerInfo[]): void {
    this.serverInfos = infos.map(m => new ServerInfoWithStatus(m))
  }
}

/**
 * Parse a `host[:port]` string into `{ host, port? }`. Returns `undefined` if
 * the input is empty. Invalid ports are dropped silently.
 */
export function parseServerAddress(input: string): { host: string; port?: number } | undefined {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return undefined
  // IPv6 in brackets: [::1]:25565
  const v6 = /^\[([^\]]+)\](?::(\d+))?$/.exec(trimmed)
  if (v6) {
    const port = v6[2] ? Number(v6[2]) : undefined
    return { host: v6[1], port: Number.isFinite(port!) ? port : undefined }
  }
  const idx = trimmed.lastIndexOf(':')
  if (idx >= 0 && /^\d+$/.test(trimmed.slice(idx + 1))) {
    return { host: trimmed.slice(0, idx), port: Number(trimmed.slice(idx + 1)) }
  }
  return { host: trimmed }
}

/**
 * Format a `{ host, port? }` pair back into a `host[:port]` string.
 */
export function formatServerAddress(server: { host: string; port?: number }): string {
  if (!server.port || server.port === 25565) return server.host
  return `${server.host}:${server.port}`
}

export interface AddInstanceServerOptions {
  instancePath: string
  name?: string
  host: string
  port?: number
  /** Base64 icon payload (no data: prefix), forwarded verbatim to servers.dat. */
  icon?: string
  acceptTextures?: 0 | 1
}

export interface UpdateInstanceServerOptions {
  instancePath: string
  /** Match an existing `servers.dat` row by host + optional port. */
  host: string
  port?: number
  /** When provided, only the row whose `name` also matches is updated. */
  name?: string
  /** New values applied to the matched row. */
  update: Partial<{ host: string; port: number | undefined; name: string; icon: string; acceptTextures: 0 | 1 }>
}

export interface RemoveInstanceServerOptions {
  instancePath: string
  host: string
  port?: number
  name?: string
  /**
   * Optional array index in `servers.dat`. When set, takes precedence over
   * the `(host, port, name)` lookup. Useful for removing corrupt rows whose
   * ip is empty / unparseable.
   */
  index?: number
}

/**
 * Provide the service to access the servers.dat for an instance.
 */
export interface InstanceServerInfoService {
  /**
   * Watch the server info in the instance folder.
   * @param instancePath The instance folder path
   */
  watch(instancePath: string): Promise<SharedState<ServerInfoState>>

  isLinked(instancePath: string): Promise<boolean>

  link(instancePath: string): Promise<void>

  unlink(instancePath: string): Promise<void>

  /** Append a new entry to the instance's `servers.dat`. */
  addServer(options: AddInstanceServerOptions): Promise<void>

  /** Edit the first matching entry in the instance's `servers.dat`. */
  updateServer(options: UpdateInstanceServerOptions): Promise<void>

  /** Remove the first matching entry from the instance's `servers.dat`. */
  removeServer(options: RemoveInstanceServerOptions): Promise<void>
}

export const InstanceServerInfoServiceKey: ServiceKey<InstanceServerInfoService> = 'InstanceServerInfoService'
