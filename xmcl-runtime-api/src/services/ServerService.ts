import { ServiceKey } from './Service'
import type { LaunchOptions } from './LaunchService'

export type ServerServiceTarget = 'local' | 'remote'
export type ServerServiceManager = 'windows-service' | 'systemd-user'

export interface ServerServiceStatus {
  supported: boolean
  manager?: ServerServiceManager
  installed: boolean
  active: boolean
  pid?: number
  requiresElevation?: boolean
  error?: string
}

export interface ServerServiceActionResult {
  ok: boolean
  message?: string
}

export interface InstallServerServiceOptions {
  instancePath: string
  target: ServerServiceTarget
  name: string
  startCommand?: string
  /** Required for local services so the launcher can resolve the exact JVM command. */
  launchOptions?: LaunchOptions
}

/** Target-independent lifecycle management for a dedicated server OS service. */
export interface ServerService {
  getStatus(instancePath: string, target: ServerServiceTarget): Promise<ServerServiceStatus>
  install(options: InstallServerServiceOptions): Promise<ServerServiceActionResult>
  uninstall(instancePath: string, target: ServerServiceTarget): Promise<ServerServiceActionResult>
  start(instancePath: string, target: ServerServiceTarget): Promise<ServerServiceActionResult>
  stop(instancePath: string, target: ServerServiceTarget): Promise<ServerServiceActionResult>
  restart(instancePath: string, target: ServerServiceTarget): Promise<ServerServiceActionResult>
}

export const ServerServiceKey: ServiceKey<ServerService> = 'ServerService'