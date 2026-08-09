import type { InstanceFile, RemoteServerConnection, ServerDeploymentPolicy } from '@xmcl/instance'
import type { LaunchOptions } from './LaunchService'
import { ServiceKey } from './Service'
import { SharedState } from '../util/SharedState'

export type { RemoteServerConnection }

/**
 * Secret half of a remote server connection. Never persisted alongside
 * {@link RemoteServerConnection} — stored in the OS keychain via
 * `SecretStorage`, keyed by instance path.
 */
export interface RemoteServerCredentialsInput {
  /** Required when `authMethod === 'password'`. */
  password?: string
  /** Optional passphrase for an encrypted private key, when `authMethod === 'privateKey'`. */
  passphrase?: string
}

export interface RemoteServerActionResult {
  ok: boolean
  message?: string
}

export type ServerDeploymentCategory = 'config' | 'mods' | 'world' | 'extra'

export interface ServerDeploymentFile extends InstanceFile {
  category: ServerDeploymentCategory
}

export interface ServerDeploymentPlan {
  policies: Record<ServerDeploymentCategory, ServerDeploymentPolicy>
  files: ServerDeploymentFile[]
}

export interface ServerDeploymentPreview {
  add: number
  update: number
  delete: number
  skip: number
  uploadBytes: number
}

export interface RemoteServerStatus {
  connected: boolean
  /** Epoch ms of the last status probe, whether it succeeded or failed. */
  checkedAt: number
  error?: string
  /** Whether the systemd `--user` unit exists on the remote host. */
  serviceInstalled?: boolean
  /** Whether the remote server directory contains files. */
  serverInstalled?: boolean
  /** Whether the target is a supported Linux host. */
  platform?: string
  javaAvailable?: boolean
  systemdAvailable?: boolean
  remotePathWritable?: boolean
  /** Whether a target world already exists and must be preserved by default. */
  worldPresent?: boolean
  /** Last desired-state revision written after a successful reconciliation. */
  appliedRevision?: string
  /** `systemctl --user is-active` result. */
  serviceActive?: boolean
  /** Main PID reported by systemd, when active. */
  pid?: number
  /** 1/5/15-minute load average, read from `/proc/loadavg`. */
  loadAverage?: [number, number, number]
  memoryTotalMB?: number
  memoryUsedMB?: number
  /** Disk usage of the filesystem backing `remotePath`. */
  diskTotalMB?: number
  diskUsedMB?: number
}

export function getRemoteServerKey(instancePath: string) {
  return 'remote-server://' + instancePath
}

export function getRemoteServerLogKey(instancePath: string) {
  return 'remote-server-log://' + instancePath
}

export class RemoteServerStatusState {
  status: RemoteServerStatus = { connected: false, checkedAt: 0 }

  remoteServerStatus(status: RemoteServerStatus): void {
    this.status = status
  }
}

const MAX_LOG_LINES = 2000

export class RemoteServerLogState {
  lines: string[] = []

  remoteServerLogAppend(lines: string[]): void {
    this.lines = this.lines.concat(lines)
    if (this.lines.length > MAX_LOG_LINES) {
      this.lines = this.lines.slice(this.lines.length - MAX_LOG_LINES)
    }
  }

  remoteServerLogReset(): void {
    this.lines = []
  }
}

/**
 * Remote SSH server administration: connection test, `systemd --user`
 * lifecycle control, live status, and log tailing. Non-secret connection
 * metadata (host/port/path/auth method/service name) lives on
 * `instance.remoteServer` (edited via `InstanceService.editInstance`);
 * this service owns only the credential half and the actions that require
 * an SSH session.
 */
export interface RemoteServerService {
  /**
   * Whether credentials have been remembered (OS keychain) for this
   * instance's remote server profile.
   */
  hasCredentials(instancePath: string): Promise<boolean>
  /**
   * Store (or overwrite) the remote server credentials for this instance in
   * the OS keychain. Pass an empty object to keep the profile but forget the
   * secret.
   */
  setCredentials(instancePath: string, credentials: RemoteServerCredentialsInput): Promise<void>
  /**
   * Forget any stored credentials for this instance's remote server profile.
   */
  clearCredentials(instancePath: string): Promise<void>
  /**
   * Open a connection and run a no-op command to verify host/port/auth are
   * correct. Does not throw — failures are reported via `ok: false`.
   */
  testConnection(instancePath: string): Promise<RemoteServerActionResult>
  /** Export the selected local server files and upload them to the configured remote path. */
  uploadServer(instancePath: string, options: LaunchOptions, plan: ServerDeploymentPlan, credentials?: RemoteServerCredentialsInput): Promise<void>
  /** Compare local desired data with the last managed remote deployment. */
  previewServerDeployment(instancePath: string, plan: ServerDeploymentPlan): Promise<ServerDeploymentPreview>
  /** Record the desired-state revision successfully materialized on the target. */
  setDeploymentRevision(instancePath: string, revision: string): Promise<void>
  /**
   * One-shot status probe (connectivity, systemd unit state, load/memory/
   * disk) without subscribing to a live state. Prefer `watchStatus` for UI
   * that stays open; use this for a single snapshot (e.g. from the AI agent).
   */
  getStatus(instancePath: string): Promise<RemoteServerStatus>
  /**
   * Live status: connectivity, systemd unit state, load/memory/disk. Polled
   * on demand via `refreshStatus`; the returned state is otherwise static
   * until then.
   */
  watchStatus(instancePath: string): Promise<SharedState<RemoteServerStatusState>>
  /**
   * Re-probe the remote host and push a new snapshot to any existing
   * `watchStatus` subscribers. No-op if nothing is watching yet.
   */
  refreshStatus(instancePath: string): Promise<void>
  /**
   * Write and enable a `systemd --user` unit on the remote host that runs
   * `remoteServer.startCommand` in `remoteServer.remotePath`. Requires both
   * fields to be set on the connection profile.
   */
  installService(instancePath: string): Promise<RemoteServerActionResult>
  /**
   * Disable and remove the `systemd --user` unit. Does not touch server
   * files.
   */
  uninstallService(instancePath: string): Promise<RemoteServerActionResult>
  startService(instancePath: string): Promise<RemoteServerActionResult>
  stopService(instancePath: string): Promise<RemoteServerActionResult>
  restartService(instancePath: string): Promise<RemoteServerActionResult>
  /**
   * Read an allowlisted top-level file under `remotePath` (server.properties,
   * eula.txt, ops.json, whitelist.json, banned-ips.json, banned-players.json,
   * usercache.json) over SFTP. Returns an empty string if the remote file
   * does not exist yet.
   */
  readRemoteFile(instancePath: string, file: string): Promise<string>
  /**
   * Overwrite an allowlisted top-level file under `remotePath` over SFTP.
   */
  writeRemoteFile(instancePath: string, file: string, content: string): Promise<void>
  /**
   * Stream `<remotePath>/logs/latest.log` (`tail -f`) into a shared state
   * that appends new lines. The SSH stream is closed automatically once the
   * last renderer subscriber unrefs the state.
   */
  watchLog(instancePath: string): Promise<SharedState<RemoteServerLogState>>
  /**
   * One-shot read of the last `lines` (default 200) lines of
   * `<remotePath>/logs/latest.log`. Useful for callers (e.g. the AI agent)
   * that just want a snapshot without subscribing to a live stream.
   */
  tailLog(instancePath: string, lines?: number): Promise<string>
}

export const RemoteServerServiceKey: ServiceKey<RemoteServerService> = 'RemoteServerService'
