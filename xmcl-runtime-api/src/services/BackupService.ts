import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'

export interface BackupInstanceOptions {
  instancePath: string
  includeConfigs?: boolean
  includeSaves?: boolean
  includeResourcePacks?: boolean
  includeShaderPacks?: boolean
  includeMods?: boolean
  modListOnly?: boolean
}

export interface BackupOptions {
  destinationPath: string
  includeSettings?: boolean
  includeCollections?: boolean
  includeThemes?: boolean
  instances?: BackupInstanceOptions[]
  silent?: boolean
}

export interface AutoBackupConfig {
  enabled: boolean
  instancePaths: string[]
  intervalMinutes: number
  maxBackups: number
  destinationDir: string
  includeSaves: boolean
  includeConfigs: boolean
  includeMods: boolean
  modListOnly: boolean
  includeResourcePacks: boolean
  includeShaderPacks: boolean
  includeSettings: boolean
  lastBackupAt?: number
  lastBackupPath?: string
  lastError?: string
}

export interface AutoBackupFileEntry {
  fileName: string
  filePath: string
  createdAt: number
  sizeBytes: number
}

export interface AutoBackupStatusEvent {
  running: boolean
  config: AutoBackupConfig
}

export interface BackupManifestInstanceItem {
  id: string
  name: string
  folderName: string
  mcVersion?: string
  loader?: string
  includesSaves: boolean
  includesConfigs: boolean
  includesMods: boolean
  includesResourcePacks: boolean
  includesShaderPacks: boolean
  modListOnly?: boolean
  modsCount?: number
}

export interface BackupManifest {
  version: number
  createdAt: number
  appVersion: string
  includes: {
    settings: boolean
    collections: boolean
    themes: boolean
    instances: BackupManifestInstanceItem[]
  }
}

export interface RestoreBackupOptions {
  backupPath: string
  restoreSettings?: boolean
  restoreCollections?: boolean
  restoreThemes?: boolean
  instances?: string[]
  instanceConflictStrategy?: 'rename' | 'overwrite' | 'skip'
}

export interface RestoreBackupResult {
  /** Commit is durable, but retained disposable evidence needs cleanup on restart. */
  cleanupPending?: boolean
  recoveryPath?: string
  restoredSettings: boolean
  restoredCollections: boolean
  restoredThemes: boolean
  restoredInstances: string[]
  skippedInstances?: string[]
}

export interface BackupCategoryCounts {
  current: number
  total: number
}

export interface BackupProgressCounts {
  saves?: BackupCategoryCounts
  mods?: BackupCategoryCounts
  resourcePacks?: BackupCategoryCounts
  shaderPacks?: BackupCategoryCounts
  configs?: BackupCategoryCounts
}

export interface BackupProgress {
  phase: 'preparing' | 'settings' | 'collections' | 'themes' | 'instances' | 'compressing' | 'complete'
  currentInstance?: string
  currentInstanceIndex?: number
  totalInstances?: number
  currentFile?: string
  percent: number
  message: string
  counts?: BackupProgressCounts
}

/** Restore failures requiring manual/restart recovery retain this path in the
 * service error message and recovery-required progress event. */
export interface RestoreFailure {
  recoveryPath?: string
}

export interface RestoreProgress {
  recoveryPath?: string
  phase: 'reading' | 'settings' | 'collections' | 'themes' | 'instances' | 'committing' | 'rolling-back' | 'recovery-required' | 'complete'
  currentInstance?: string
  currentInstanceIndex?: number
  totalInstances?: number
  currentFile?: string
  percent: number
  message: string
}

export interface BackupServiceEventMap {
  'backup-progress': BackupProgress
  'restore-progress': RestoreProgress
  'auto-backup-status': AutoBackupStatusEvent
}

export interface BackupService extends GenericEventEmitter<BackupServiceEventMap> {
  /** True: staging cancellation requested. False: idle or commit/rollback must finish. */
  cancelBackupOperation(): Promise<boolean>
  createBackup(options: BackupOptions): Promise<string>
  loadBackupManifest(backupPath: string): Promise<BackupManifest>
  restoreBackup(options: RestoreBackupOptions): Promise<RestoreBackupResult>
  getAutoBackupConfig(): Promise<AutoBackupConfig>
  setAutoBackupConfig(config: Partial<AutoBackupConfig>): Promise<AutoBackupConfig>
  runAutoBackupNow(): Promise<string | undefined>
  listAutoBackups(): Promise<AutoBackupFileEntry[]>
  deleteAutoBackup(filePath: string): Promise<void>
}

export const BackupServiceKey: ServiceKey<BackupService> = 'BackupService'
