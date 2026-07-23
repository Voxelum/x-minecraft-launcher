import type { BackupFormat, LayeredLinearBackupObject, LinearBackupObject } from '@xmcl/instance'
import type { ServiceKey } from './Service'

/**
 * M6-local client proposal v1. It intentionally lives beside the desktop IPC
 * service until the shared world-backups REST contract is published.
 */
export const WORLD_BACKUP_CLIENT_PROPOSAL_VERSION = 1
/** Consumes xmcl-web-api/contracts/shared/v1 without redefining its schema. */
export const WORLD_BACKUP_SHARED_CONTRACT_VERSION = 1
export const WORLD_BACKUP_FREE_BYTES = 1_073_741_824
export const WORLD_BACKUP_SETTLEMENT_INTERVAL_SECONDS = 3_600

export type BackupSourceType = 'client_world'
export type WorldBackupStatus = 'creating' | 'uploading' | 'ready' | 'restoring' | 'failed' | 'deleted'

export interface WorldBackupResource {
  backupId: string
  sourceType: BackupSourceType
  sourceId: string
  worldId: string
  format: BackupFormat
  formatVersion: number
  parentBackupId?: string
  status: WorldBackupStatus
  statusVersion: number
  sizeBytes?: number
  sha256?: string
  updatedAt: string
}

export interface WorldBackupStorageUsage {
  policy: {
    freeBytes: typeof WORLD_BACKUP_FREE_BYTES
    policyVersion: 1
  }
  usedBytes: number
  overageBytes: number
  lastSettledAt: string
  settlementIntervalSeconds: typeof WORLD_BACKUP_SETTLEMENT_INTERVAL_SECONDS
  countedObjects: Array<{
    objectId: string
    storageOwnerAccountId: string
    physicalBytes: number
    activeReferenceCount: number
    verified: true
  }>
  settlement?: {
    currency: string
    amount: string
    retentionStartsAt: string
  }
  uploadBlockedReason?: 'insufficient_balance'
}

export interface WorldBackupUploadGrant {
  backupId: string
  url: string
  expiresAt: string
  contentLength: number
  sha256: string
  requiredHeaders: Record<string, string>
}

export interface WorldBackupTask {
  taskId: string
  requestId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  error?: { error: string; message: string; requestId: string }
}

export interface PreparedClientWorldBackup {
  snapshotId: string
  sourceId: string
  worldId: string
  object: LinearBackupObject | LayeredLinearBackupObject
}

export interface PrepareClientWorldBackupOptions {
  instancePath: string
  /** The selected direct child of this instance's `saves` directory. */
  saveName: string
  format: BackupFormat
  parentBackupId?: string
  idempotencyKey: string
}

export interface ClientWorldBackupSource {
  instancePath: string
  saveName: string
}

export interface CreateWorldBackupOptions {
  sourceId: string
  worldId: string
  object: LinearBackupObject | LayeredLinearBackupObject
  idempotencyKey: string
}

export interface RestoreClientWorldBackupOptions {
  backupId: string
  instancePath: string
  saveName: string
  /**
   * Restore may only replace the selected `saves/<saveName>` player world.
   * Callers must explicitly opt into that overwrite.
   */
  overwriteSelectedWorld: true
  idempotencyKey: string
}

/**
 * Desktop boundary for manual player-world backups. The implementation owns
 * temporary snapshots and signed-URL requests; renderer callers only receive
 * compressed-object metadata and never a raw world directory, region file, or
 * ZIP payload. Hosted-server backups are intentionally absent: those belong
 * on the server-management surface.
 */
export interface WorldBackupService {
  listClientWorldBackups(source: ClientWorldBackupSource): Promise<WorldBackupResource[]>
  getClientWorldBackupStorageUsage(): Promise<WorldBackupStorageUsage>
  prepareClientWorldBackup(options: PrepareClientWorldBackupOptions): Promise<PreparedClientWorldBackup>
  createWorldBackup(options: CreateWorldBackupOptions): Promise<WorldBackupResource>
  requestWorldBackupUpload(backupId: string, object: LinearBackupObject | LayeredLinearBackupObject, idempotencyKey: string): Promise<WorldBackupUploadGrant>
  uploadPreparedWorldBackup(snapshotId: string, grant: WorldBackupUploadGrant): Promise<void>
  completeWorldBackupUpload(backupId: string, object: LinearBackupObject | LayeredLinearBackupObject, idempotencyKey: string): Promise<WorldBackupResource>
  restoreClientWorldBackup(options: RestoreClientWorldBackupOptions): Promise<WorldBackupTask>
}

export const WorldBackupServiceKey: ServiceKey<WorldBackupService> = 'WorldBackupService'
