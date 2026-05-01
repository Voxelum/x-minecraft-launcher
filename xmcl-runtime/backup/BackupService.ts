import {
  BackupService as IBackupService,
  BackupOptions,
  RestoreOptions,
  BackupInfo,
  BackupServiceKey,
  CreateBackupTask,
} from '@xmcl/runtime-api'
import { AbstractService, ExposeServiceKey } from '~/service'
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join, basename, dirname } from 'path'
import archiver from 'archiver'
import extract from 'extract-zip'
import { createWriteStream } from 'fs'
import { copy, ensureDir, readdir } from 'fs-extra'
import { Inject, LauncherAppKey } from '~/app'
import { LauncherApp } from '../app/LauncherApp'
import { BaseService } from '~/app'
import { kTasks, type Tasks } from '~/infra'

@ExposeServiceKey(BackupServiceKey)
export class BackupService extends AbstractService implements IBackupService {
  private backupLogs: Array<{ type: 'info' | 'warn' | 'error'; message: string; timestamp: number }> = []

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(kTasks) private tasks: Tasks,
  ) {
    super(app)
  }

  private addLog(type: 'info' | 'warn' | 'error', message: string, task?: any) {
    const log = { type, message, timestamp: Date.now() }
    this.backupLogs.push(log)
    if (task) {
      task.substate = { ...task.substate, logs: [...this.backupLogs] }
    }
    if (type === 'info') {
      this.log(message)
    } else if (type === 'warn') {
      this.warn(message)
    } else {
      this.error(new Error(message))
    }
  }
  async createBackup(options: BackupOptions): Promise<string> {
    const {
      destinationPath,
      includeInstances = true,
      selectedInstances = [],
      includeSettings = true,
      includeScreenshots = false,
    } = options

    // Reset logs
    this.backupLogs = []

    this.log(`Starting backup to ${destinationPath}`)
    this.log(`Options: instances=${includeInstances}, selectedInstances=${selectedInstances.length}, settings=${includeSettings}, screenshots=${includeScreenshots}`)

    // Create task for progress tracking
    const task = this.tasks.create<CreateBackupTask>({
      type: 'createBackup',
      key: `create-backup-${Date.now()}`,
      phase: 'copying-instances',
    })

    let wasCancelled = false
    let tempDir = ''

    try {
      // Ensure destination directory exists
      const destDir = dirname(destinationPath)
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
      }

      // Get data root from settings
      const dataRoot = await this.baseService.getGameDataDirectory()
      const appDataRoot = this.app.appDataPath

      this.log(`Data root: ${dataRoot}`)
      this.log(`App data root: ${appDataRoot}`)

      // Create a temporary directory for backup content
      tempDir = join(dataRoot, '.backup-temp')
      if (existsSync(tempDir)) {
        await this.safeRemoveDir(tempDir)
      }
      mkdirSync(tempDir, { recursive: true })

      // Count total files for progress tracking
      let totalFiles = 0
      let copiedFiles = 0

      this.addLog('info', 'Counting files for backup...', task)

      if (includeInstances) {
        const instancesDir = join(dataRoot, 'instances')
        if (existsSync(instancesDir)) {
          // Count files excluding libraries and versions
          const allFolders = readdirSync(instancesDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => e.name)
          
          for (const folder of allFolders) {
            const folderPath = join(instancesDir, folder)
            const folderFiles = await this.countFilesExcluding(folderPath, ['libraries', 'versions', 'jre', 'java_versions'])
            totalFiles += folderFiles
          }
          this.addLog('info', `Found ${totalFiles} files in instances (excluding libraries/versions)`, task)
        }
      }

      if (includeSettings) {
        const settingsItems = [
          'settings.json',
          'setting.json',
          'theme.json',
          'theme-media',
          'themes',
          'instances.json',
          'launcher_profiles.json',
          'usercache.json',
          'launcher.json',
          'accounts.json',
          'config',
          'crash-reports',
          'logs',
          'plugins',
          'resources',
          'caches',
          'plugin-settings',
          'resource-images',
          'user.json',
          'java.json',
          'db.sqlite',
          'ely-authlib.json',
        ]
        for (const item of settingsItems) {
          // Check both dataRoot and appDataRoot
          const srcPath1 = join(dataRoot, item)
          const srcPath2 = join(appDataRoot, item)
          
          for (const srcPath of [srcPath1, srcPath2]) {
            if (existsSync(srcPath)) {
              const stat = statSync(srcPath)
              if (stat.isDirectory()) {
                totalFiles += await this.countFiles(srcPath)
              } else {
                totalFiles++
              }
              break // Only count once
            }
          }
        }
      }

      if (includeScreenshots) {
        // Count screenshots in each instance folder
        const instancesDir = join(dataRoot, 'instances')
        if (existsSync(instancesDir)) {
          const instanceFolders = readdirSync(instancesDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => e.name)

          for (const instanceName of instanceFolders) {
            const instanceScreenshotsDir = join(instancesDir, instanceName, 'screenshots')
            if (existsSync(instanceScreenshotsDir)) {
              totalFiles += await this.countFiles(instanceScreenshotsDir)
            }
          }
        }
      }

      // Ensure totalFiles is at least 1 to avoid division by zero
      if (totalFiles === 0) {
        totalFiles = 1
      }

      task.substate = { type: 'copying-instances', totalFiles, copiedFiles: 0 }
      task.progress = { total: totalFiles, progress: 0 }

      try {
        // Copy instances
        if (includeInstances) {
          const instancesDir = join(dataRoot, 'instances')
          if (existsSync(instancesDir)) {
            const allInstanceFolders = readdirSync(instancesDir, { withFileTypes: true })
              .filter(e => e.isDirectory())
              .map(e => e.name)
            
            // Use selected instances if provided, otherwise use all
            const instancesToBackup = selectedInstances.length > 0 
              ? selectedInstances.map(p => {
                  // Extract folder name from path
                  const folderName = p.split(/[\\/]/).pop() || p
                  return allInstanceFolders.find(f => f === folderName)
                }).filter(Boolean) as string[]
              : allInstanceFolders
            
            if (instancesToBackup.length > 0) {
              const destInstancesDir = join(tempDir, 'instances')
              await ensureDir(destInstancesDir)
              
              // Count files for selected instances only
              let totalInstanceFiles = 0
              for (const folderName of instancesToBackup) {
                const fullPath = join(instancesDir, folderName)
                if (existsSync(fullPath)) {
                  totalInstanceFiles += await this.countFiles(fullPath)
                }
              }
              
              // Copy each selected instance
              for (const folderName of instancesToBackup) {
                if (task.controller.signal.aborted) {
                  wasCancelled = true
                  throw new Error('Backup cancelled by user')
                }
                const srcPath = join(instancesDir, folderName)
                const destPath = join(destInstancesDir, folderName)
                if (existsSync(srcPath)) {
                  this.addLog('info', `Backing up instance: ${folderName}`, task)
                  await ensureDir(destPath)
                  
                  // Copy instance EXCLUDING libraries folder completely
                  await this.copyDirectoryWithProgress(
                    srcPath,
                    destPath,
                    (file) => {
                      copiedFiles++
                      task.substate = { type: 'copying-instances', totalFiles, copiedFiles }
                      task.progress = { total: totalFiles, progress: copiedFiles }
                    },
                    ['libraries', 'versions', 'jre', 'java_versions', '.fabric', '.quilt', 'natives'], // EXCLUDE libraries completely
                    task,
                  )
                  this.addLog('info', `Completed: ${folderName} (libraries excluded)`, task)
                }
              }
            }
          }
        }

        // Check if cancelled
        if (task.controller.signal.aborted) {
          wasCancelled = true
          throw new Error('Backup cancelled by user')
        }

        // Copy settings - copy entire settings directory structure
        task.substate = { type: 'copying-settings', totalFiles, copiedFiles }
        this.addLog('info', 'Copying settings...', task)
        if (includeSettings) {
          const settingsDir = join(tempDir, 'settings')
          await ensureDir(settingsDir)

          // Copy all settings files and directories from data root
          const settingsItems = [
            'settings.json',
            'setting.json',
            'theme.json',
            'theme-media',
            'themes',
            'instances.json',
            'launcher_profiles.json',
            'usercache.json',
            'launcher.json',
            'accounts.json',
            'config',
            'crash-reports',
            'logs',
            'plugins',
            'resources',
            'caches',
            'plugin-settings',
            'resource-images',
            'user.json',
            'db.sqlite',
            'ely-authlib.json',
          ]

          for (const item of settingsItems) {
            if (task.controller.signal.aborted) {
              wasCancelled = true
              throw new Error('Backup cancelled by user')
            }
            // Check both dataRoot and appDataRoot
            const srcPath1 = join(dataRoot, item)
            const srcPath2 = join(appDataRoot, item)
            
            let srcPath = existsSync(srcPath1) ? srcPath1 : (existsSync(srcPath2) ? srcPath2 : null)
            if (!srcPath) continue
            
            try {
              const destPath = join(settingsDir, item)
              const stat = statSync(srcPath)
              if (stat.isDirectory()) {
                await copy(srcPath, destPath, {
                  overwrite: true,
                  dereference: true,
                })
                const dirCount = await this.countFiles(srcPath)
                copiedFiles += dirCount
              } else {
                await copy(srcPath, destPath, { overwrite: true })
                copiedFiles++
              }
              task.substate = { type: 'copying-settings', totalFiles, copiedFiles }
              task.progress = { total: totalFiles, progress: copiedFiles }
            } catch (err: any) {
              this.warn(`Failed to copy settings item ${item}:`, err.message)
            }
          }
        }

        // Check if cancelled
        if (task.controller.signal.aborted) {
          wasCancelled = true
          throw new Error('Backup cancelled by user')
        }

        // Copy screenshots - from each instance's screenshots folder
        task.substate = { type: 'copying-screenshots', totalFiles, copiedFiles }
        this.addLog('info', 'Copying screenshots...', task)
        if (includeScreenshots) {
          const instancesDir = join(dataRoot, 'instances')
          if (existsSync(instancesDir)) {
            const instanceFolders = readdirSync(instancesDir, { withFileTypes: true })
              .filter(e => e.isDirectory())
              .map(e => e.name)

            for (const instanceName of instanceFolders) {
              if (task.controller.signal.aborted) {
                wasCancelled = true
                throw new Error('Backup cancelled by user')
              }
              const instanceScreenshotsDir = join(instancesDir, instanceName, 'screenshots')
              if (existsSync(instanceScreenshotsDir)) {
                const destScreenshotsDir = join(tempDir, 'instances', instanceName, 'screenshots')
                await ensureDir(destScreenshotsDir)
                try {
                  await this.copyDirectoryWithProgress(
                    instanceScreenshotsDir,
                    destScreenshotsDir,
                    (file) => {
                      copiedFiles++
                      task.substate = { type: 'copying-screenshots', totalFiles, copiedFiles }
                      task.progress = { total: totalFiles, progress: copiedFiles }
                    },
                    undefined,
                    task,
                  )
                } catch (err: any) {
                  this.warn(`Failed to copy screenshots for ${instanceName}:`, err.message)
                }
              }
            }
          }
        }

        // Check if cancelled
        if (task.controller.signal.aborted) {
          wasCancelled = true
          throw new Error('Backup cancelled by user')
        }

        // Create backup metadata
        task.substate = { type: 'creating-archive', totalFiles, copiedFiles }
        this.addLog('info', 'Creating backup metadata...', task)
        const metadata = {
          version: '1.0',
          createdAt: Date.now(),
          launcherVersion: this.getVersion(),
          includeInstances,
          includeSettings,
          includeScreenshots,
          instanceCount: includeInstances ? this.countInstances(dataRoot) : 0,
          wasCancelled,
        }

        writeFileSync(
          join(tempDir, 'backup.json'),
          JSON.stringify(metadata, null, 2),
        )

        // Create zip archive - this is the finalizing phase
        task.substate = { type: 'finalizing', totalFiles, copiedFiles: totalFiles }
        task.progress = { total: totalFiles, progress: totalFiles }
        
        this.addLog('info', 'Creating compressed archive...', task)
        const archiveStart = Date.now()
        await this.createZip(tempDir, destinationPath)
        const archiveDuration = Date.now() - archiveStart
        this.addLog('info', `Archive created in ${archiveDuration}ms`, task)

        if (wasCancelled) {
          task.fail(new Error('Backup cancelled by user'))
          throw new Error('Backup cancelled by user')
        }

        task.complete()
        this.addLog('info', 'Backup completed successfully!', task)
        return destinationPath
      } catch (error: any) {
        if (error.message === 'Backup cancelled by user') {
          wasCancelled = true
          // Still try to create archive with what we have
          try {
            task.substate = { type: 'finalizing', totalFiles, copiedFiles }
            const metadata = {
              version: '1.0',
              createdAt: Date.now(),
              launcherVersion: this.getVersion(),
              includeInstances,
              includeSettings,
              includeScreenshots,
              instanceCount: includeInstances ? this.countInstances(dataRoot) : 0,
              wasCancelled: true,
            }

            writeFileSync(
              join(tempDir, 'backup.json'),
              JSON.stringify(metadata, null, 2),
            )

            await this.createZip(tempDir, destinationPath)
            this.log('Partial backup saved due to user cancellation')
          } catch (archiveError) {
            this.warn('Failed to create partial backup archive:', archiveError)
          }
          task.fail(error)
        } else {
          task.fail(error)
        }
        throw error
      }
    } finally {
      // Cleanup temp directory with retries
      const dataRoot = await this.baseService.getGameDataDirectory()
      const cleanupTempDir = join(dataRoot, '.backup-temp')
      if (existsSync(cleanupTempDir)) {
        await this.safeRemoveDir(cleanupTempDir)
      }
    }
  }

  async restoreBackup(options: RestoreOptions): Promise<void> {
    const { backupPath, destinationPath } = options

    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }

    // Get app data path for theme/settings restoration
    const appDataPath = this.app.appDataPath

    this.log(`Restoring backup to game data: ${destinationPath}`)
    this.log(`App data path: ${appDataPath}`)

    // Create a temporary directory for extraction
    const tempDir = join(destinationPath, '.restore-temp')
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mkdirSync(tempDir, { recursive: true })

    try {
      // Extract backup
      await extract(backupPath, { dir: tempDir })

      // Read metadata
      const metadataPath = join(tempDir, 'backup.json')
      if (!existsSync(metadataPath)) {
        throw new Error('Invalid backup file: missing backup.json')
      }

      const metadata: BackupInfo = JSON.parse(
        readFileSync(metadataPath, 'utf-8'),
      )

      // Restore instances
      if (metadata.includeInstances) {
        const instancesDir = join(tempDir, 'instances')
        if (existsSync(instancesDir)) {
          const destInstancesDir = join(destinationPath, 'instances')
          await ensureDir(destInstancesDir)
          await this.copyDirectory(instancesDir, destInstancesDir)
        }
      }

      // Restore settings - to both game data and app data directories
      if (metadata.includeSettings) {
        const settingsDir = join(tempDir, 'settings')
        if (existsSync(settingsDir)) {
          const settingsItems = readdirSync(settingsDir, { withFileTypes: true })
          for (const item of settingsItems) {
            const srcPath = join(settingsDir, item.name)
            
            // Determine the correct destination based on the item type
            // Theme-related files go to appDataPath, instance-related files go to destinationPath
            let destPath: string
            
            // Files that should go to app data directory
            const appDataItems = [
              'theme.json',
              'theme-media',
              'themes',
              'settings.json',
              'setting.json',
              'plugins',
              'resources',
              'caches',
              'plugin-settings',
              'resource-images',
              'user.json',
              'db.sqlite',
              'ely-authlib.json',
            ]
            
            if (appDataItems.includes(item.name)) {
              destPath = join(appDataPath, item.name)
            } else {
              destPath = join(destinationPath, item.name)
            }
            
            try {
              if (item.isDirectory()) {
                await copy(srcPath, destPath, {
                  overwrite: true,
                  dereference: true,
                })
              } else {
                await copy(srcPath, destPath, { overwrite: true })
              }
              this.log(`Restored ${item.name} to ${destPath}`)
            } catch (err: any) {
              this.warn(`Failed to restore settings item ${item.name}:`, err.message)
            }
          }
        }
      }

      // Restore screenshots - from each instance's screenshots folder in backup
      if (metadata.includeScreenshots) {
        const backupInstancesDir = join(tempDir, 'instances')
        if (existsSync(backupInstancesDir)) {
          const backupInstanceFolders = readdirSync(backupInstancesDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => e.name)

          for (const instanceName of backupInstanceFolders) {
            const backupScreenshotsDir = join(backupInstancesDir, instanceName, 'screenshots')
            if (existsSync(backupScreenshotsDir)) {
              const destScreenshotsDir = join(destinationPath, 'instances', instanceName, 'screenshots')
              await ensureDir(destScreenshotsDir)
              try {
                await this.copyDirectory(backupScreenshotsDir, destScreenshotsDir)
              } catch (err: any) {
                this.warn(`Failed to restore screenshots for ${instanceName}:`, err.message)
              }
            }
          }
        }
      }
    } finally {
      // Cleanup temp directory
      if (existsSync(tempDir)) {
        await this.safeRemoveDir(tempDir)
      }
    }
  }

  async getBackupInfo(backupPath: string): Promise<BackupInfo> {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }

    // Create a temporary directory for extraction
    const tempDir = join(dirname(backupPath), '.backup-info-temp')
    if (existsSync(tempDir)) {
      await this.safeRemoveDir(tempDir)
    }
    mkdirSync(tempDir, { recursive: true })

    try {
      // Extract the backup
      await extract(backupPath, { dir: tempDir })

      const metadataPath = join(tempDir, 'backup.json')
      if (!existsSync(metadataPath)) {
        throw new Error('Invalid backup file: missing backup.json')
      }

      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
      const stats = statSync(backupPath)

      return {
        name: basename(backupPath),
        createdAt: metadata.createdAt,
        size: stats.size,
        instanceCount: metadata.instanceCount || 0,
        launcherVersion: metadata.launcherVersion || 'unknown',
      }
    } finally {
      // Cleanup temp directory
      if (existsSync(tempDir)) {
        await this.safeRemoveDir(tempDir)
      }
    }
  }

  private async copyDirectoryWithProgress(
    src: string,
    dest: string,
    onFileCopied?: (file: string) => void,
    excludeFolders?: string[],
    task?: any,
  ): Promise<number> {
    let copiedCount = 0

    const copyRecursive = async (source: string, destination: string): Promise<void> => {
      const entries = await readdir(source, { withFileTypes: true })

      for (const entry of entries) {
        // Skip excluded folders (libraries, versions)
        if (entry.isDirectory() && excludeFolders?.includes(entry.name)) {
          this.addLog('info', `Skipping excluded folder: ${entry.name} (saves space)`, task)
          continue
        }

        // Skip symlinks to avoid copying global libraries/versions
        if (entry.isSymbolicLink()) {
          this.addLog('info', `Skipping symlink: ${entry.name}`, task)
          continue
        }

        const srcPath = join(source, entry.name)
        const destPath = join(destination, entry.name)

        if (entry.isDirectory()) {
          await ensureDir(destPath)
          await copyRecursive(srcPath, destPath)
        } else {
          try {
            await copy(srcPath, destPath, {
              overwrite: false,
              errorOnExist: false,
              dereference: true,
            })
            copiedCount++
            if (onFileCopied) {
              onFileCopied(srcPath)
            }
          } catch (error: any) {
            // Log warning but continue - some files might be locked or inaccessible
            this.warn(`Failed to copy file ${srcPath} to ${destPath}: ${error.message}`)
          }
        }
      }
    }

    await copyRecursive(src, dest)
    return copiedCount
  }

  private async countFiles(dir: string): Promise<number> {
    let count = 0
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        count += await this.countFiles(fullPath)
      } else {
        count++
      }
    }

    return count
  }

  private async countFilesExcluding(dir: string, excludeFolders: string[]): Promise<number> {
    let count = 0
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      // Skip excluded folders
      if (entry.isDirectory() && excludeFolders.includes(entry.name)) {
        continue
      }
      
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        count += await this.countFilesExcluding(fullPath, excludeFolders)
      } else {
        count++
      }
    }

    return count
  }

  private async getFolderSize(dir: string): Promise<number> {
    let size = 0
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        try {
          const stat = await statSync(fullPath)
          if (entry.isDirectory()) {
            size += await this.getFolderSize(fullPath)
          } else {
            size += stat.size
          }
        } catch {
          // Ignore errors
        }
      }
    } catch {
      // Ignore errors
    }

    return size
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    try {
      await copy(src, dest, {
        overwrite: false,
        errorOnExist: false,
        dereference: true,
      })
    } catch (error: any) {
      // Log warning but continue - some files might be locked or inaccessible
      this.warn(`Failed to copy directory ${src} to ${dest}: ${error.message}`)
    }
  }

  private async createZip(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath)
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
        forceZip64: true, // Support large files
      })

      output.on('close', async () => {
        this.log(`Backup archive created successfully at ${outputPath}`)
        // Wait a bit to ensure all file handles are released (especially on Windows)
        await new Promise(resolve => setTimeout(resolve, 500))
        resolve()
      })
      
      archive.on('error', (err: any) => {
        this.error(new Error(`Archive error: ${err}`))
        reject(err)
      })

      archive.on('warning', (warn: any) => {
        this.warn(`Archive warning: ${warn}`)
      })

      archive.on('finish', () => {
        this.log('Archive finished')
      })

      archive.pipe(output)
      archive.directory(sourceDir, false)
      archive.finalize()
    })
  }

  /**
   * Safely remove directory with retries (especially for Windows)
   */
  private async safeRemoveDir(dirPath: string, maxRetries = 5, delayMs = 1000): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (existsSync(dirPath)) {
          rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
          this.log(`Successfully removed directory: ${dirPath}`)
        }
        return
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries
        const errorCode = error.code || ''
        const errorMessage = error.message || ''

        // Check for common Windows/filesystem errors
        if (errorCode === 'ENOTEMPTY' || errorCode === 'EPERM' || errorCode === 'EBUSY' || 
            errorMessage.includes('ENOTEMPTY') || errorMessage.includes('not empty') ||
            errorMessage.includes('operation not permitted') || errorMessage.includes('resource busy')) {
          
          if (isLastAttempt) {
            this.warn(`Failed to remove directory after ${maxRetries} attempts: ${dirPath}. Error: ${errorMessage}`)
            // Don't throw - just log the warning
            return
          }
          
          this.log(`Attempt ${attempt}/${maxRetries} failed to remove ${dirPath}, retrying in ${delayMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          // Increase delay for next attempt
          delayMs = Math.min(delayMs * 1.5, 5000)
        } else {
          // For other errors, log and return without throwing
          this.warn(`Unexpected error removing directory ${dirPath}: ${errorMessage}`)
          return
        }
      }
    }
  }

  private countInstances(dataRoot: string): number {
    const instancesDir = join(dataRoot, 'instances')
    if (!existsSync(instancesDir)) {
      return 0
    }

    const entries = readdirSync(instancesDir, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).length
  }

  private getVersion(): string {
    try {
      const packageJson = JSON.parse(
        readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
      )
      return packageJson.version || 'unknown'
    } catch {
      return 'unknown'
    }
  }
}





