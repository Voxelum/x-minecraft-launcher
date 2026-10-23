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
  restoredSettings: boolean
  restoredCollections: boolean
  restoredThemes: boolean
  restoredInstances: string[]
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

export interface RestoreProgress {
  phase: 'reading' | 'settings' | 'collections' | 'themes' | 'instances' | 'complete'
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
}

export interface BackupService extends GenericEventEmitter<BackupServiceEventMap> {
  createBackup(options: BackupOptions): Promise<string>
  loadBackupManifest(backupPath: string): Promise<BackupManifest>
  restoreBackup(options: RestoreBackupOptions): Promise<RestoreBackupResult>
}

export const BackupServiceKey: ServiceKey<BackupService> = 'BackupService'
