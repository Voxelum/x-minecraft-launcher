import { ServiceKey } from './Service'
import { Task } from '../task'

export interface BackupOptions {
  /**
   * The destination path for the backup file
   */
  destinationPath: string
  /**
   * Include instances in the backup
   * @default true
   */
  includeInstances?: boolean
  /**
   * Specific instances to include in the backup.
   * If empty and includeInstances is true, all instances will be included.
   */
  selectedInstances?: string[]
  /**
   * Include settings in the backup
   * @default true
   */
  includeSettings?: boolean
  /**
   * Include screenshots in the backup
   * @default false
   */
  includeScreenshots?: boolean
}

export interface RestoreOptions {
  /**
   * The path to the backup file
   */
  backupPath: string
  /**
   * The destination data root path
   */
  destinationPath: string
}

export interface BackupInfo {
  name: string

  createdAt: number
  size: number
  instanceCount: number
  launcherVersion: string
  includeInstances?: boolean
  includeSettings?: boolean
  includeScreenshots?: boolean
}

export interface CreateBackupTask extends Task {
  type: 'createBackup'
  /**
   * Current phase of backup creation
   */
  phase: 'copying-instances' | 'copying-settings' | 'copying-screenshots' | 'creating-archive' | 'finalizing'
  /**
   * Current file being copied (optional)
   */
  currentFile?: string
  /**
   * Total files to copy
   */
  totalFiles?: number
  /**
   * Files copied so far
   */
  copiedFiles?: number
  /**
   * Log messages from backup operation
   */
  logs?: Array<{ type: 'info' | 'warn' | 'error'; message: string; timestamp: number }>
}

/**
 * Provide the abilities to create and restore launcher backups
 */
export interface BackupService {
  /**
   * Create a backup of the launcher data
   * @param options Backup options
   * @returns The path to the created backup file
   */
  createBackup(options: BackupOptions): Promise<string>

  /**
   * Restore launcher data from a backup
   * @param options Restore options
   */
  restoreBackup(options: RestoreOptions): Promise<void>

  /**
   * Get backup info from a backup file
   * @param backupPath Path to the backup file
   */
  getBackupInfo(backupPath: string): Promise<BackupInfo>
}

export const BackupServiceKey: ServiceKey<BackupService> = 'BackupService'

