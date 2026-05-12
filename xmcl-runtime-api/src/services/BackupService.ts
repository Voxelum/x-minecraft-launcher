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
  /**
   * Whether to restore instances.
   * If undefined, falls back to the value stored in the backup metadata.
   */
  restoreInstances?: boolean
  /**
   * Whether to restore settings.
   * If undefined, falls back to the value stored in the backup metadata.
   */
  restoreSettings?: boolean
  /**
   * Whether to restore screenshots.
   * If undefined, falls back to the value stored in the backup metadata.
   */
  restoreScreenshots?: boolean
  /**
   * If true, skip instances whose folder name already exists under
   * `destinationPath/instances/` instead of overwriting them.
   */
  skipExistingInstances?: boolean
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
  /**
   * List of instance folder names found inside the backup.
   */
  instances?: string[]
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
   * Archive progress percentage (0-100)
   */
  archiveProgress?: number
  /**
   * Bytes processed during archiving
   */
  processedBytes?: number
  /**
   * Total bytes to process during archiving
   */
  totalBytes?: number
  /**
   * Number of entries processed during archiving
   */
  entriesProcessed?: number
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

export interface RestoreBackupTask extends Task {
  type: 'restoreBackup'
  /**
   * Current phase of the restore operation
   */
  phase: 'extracting' | 'scanning' | 'restoring-instances' | 'restoring-settings' | 'restoring-screenshots' | 'finalizing'
  /**
   * Current file being restored (optional)
   */
  currentFile?: string
  /**
   * Total files to restore
   */
  totalFiles?: number
  /**
   * Files restored so far
   */
  copiedFiles?: number
  /**
   * Instance folder names discovered in the backup during the scanning phase.
   */
  scannedInstances?: string[]
  /**
   * Instance folder names that were skipped because they already exist
   * in the destination (only populated when `skipExistingInstances` is true).
   */
  skippedInstances?: string[]
  /**
   * Log messages from restore operation
   */
  logs?: Array<{ type: 'info' | 'warn' | 'error'; message: string; timestamp: number }>
}

export const BackupServiceKey: ServiceKey<BackupService> = 'BackupService'

