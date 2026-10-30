import {
  AutoBackupConfig,
  AutoBackupFileEntry,
  BackupManifest,
  BackupManifestInstanceItem,
  BackupOptions,
  BackupProgressCounts,
  BackupService as IBackupService,
  BackupServiceKey,
  CollectionsFileSchema,
  RestoreBackupOptions,
  RestoreBackupResult,
  SettingSchema,
} from '@xmcl/runtime-api'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'

type ZipEntry = Awaited<ReturnType<typeof readAllEntries>>[number]
import { createWriteStream } from 'fs'
import { InstanceSchema } from '@xmcl/instance'
import { Writable } from 'stream'
import { copyFile, link, mkdir, mkdtemp, open as openFile, rm, writeFile } from 'fs/promises'
import { safeBackupPath, validateInstanceFolder } from './safePath'
import { backupByteLimiter, readBackupJSON, readBoundedBackupEntries, validateBackupEntries, validateBackupManifest } from './archiveValidation'
import { RestoreRecoveryError, RestoreTransaction, syncRestoreDirectory } from './restoreTransaction'
import { getE2ERestoreFault } from './e2eRestoreFault'
import { recoverRestore } from '~/infra/recoverRestore'
import { kRestoreMaintenance, type RestorePublishPlan } from './restoreMaintenance'
import {
  close as closeFs,
  ensureDir,
  existsSync,
  lstat,
  open as openFs,
  readdir,
  readFile,
  readJson,
  unlink,
  writeJson,
} from 'fs-extra'
import filenamify from 'filenamify'
import { basename, dirname, join, relative, resolve } from 'path'
import { pipeline } from 'stream/promises'
import { ZipFile } from 'yazl'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import { CollectionService } from '~/collection/CollectionService'
import { InstanceService } from '~/instance/InstanceService'
import { AbstractService, ExposeServiceKey } from '~/service'
import { ThemeService } from '~/theme/ThemeService'
import { writeZipFile } from '~/util/zip'
import { LauncherApp } from '../app/LauncherApp'

const WINDOWS_RESERVED_NAMES = new Set([
  'pagefile.sys',
  'hiberfil.sys',
  'swapfile.sys',
  'dumpstack.log',
  'dumpstack.log.tmp',
  'system volume information',
  '$recycle.bin',
  '$winreagent',
  '$sysreset',
  '$getcurrent',
])

function isExcludedPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase()
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return false

  const fileName = segments[segments.length - 1]

  if (
    fileName === '.ds_store' ||
    fileName === '.gitignore' ||
    fileName === 'thumbs.db' ||
    fileName === 'desktop.ini' ||
    fileName === 'session.lock' ||
    fileName.endsWith('.lock') ||
    fileName.endsWith('.lck') ||
    fileName.endsWith('.tmp')
  ) {
    return true
  }

  for (const seg of segments) {
    if (WINDOWS_RESERVED_NAMES.has(seg)) return true
    if (
      seg === '.fabric' ||
      seg === '.quilt' ||
      seg === '.mixin.out' ||
      seg === '.backups' ||
      seg === '.physics_mod_cache'
    ) return true
    // Strictly exclude libraries, assets, versions, logs, and crash reports
    if (seg === 'libraries' || seg === 'assets' || seg === 'versions') return true
    if (seg === 'logs' || seg === 'crash-reports') return true
  }
  return false
}

function isKnownInstanceDir(dir: string): boolean {
  return (
    dir === 'saves' ||
    dir === 'config' ||
    dir === 'defaultconfigs' ||
    dir === 'resourcepacks' ||
    dir === 'shaderpacks' ||
    dir === 'mods' ||
    dir === 'schematics'
  )
}

async function isSafeRegularFile(fullPath: string): Promise<boolean> {
  try {
    const s = await lstat(fullPath)
    if (!s.isFile() || s.isSymbolicLink()) return false
    const fd = await openFs(fullPath, 'r')
    await closeFs(fd)
    return true
  } catch {
    return false
  }
}

async function copyRestoreTree(source: string, destination: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  const info = await lstat(source).catch((e) => {
    if (e.code === 'ENOENT') return undefined
    throw e
  })
  if (!info) { await mkdir(destination, { recursive: true }); return }
  if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) throw new Error(`Unsafe existing restore data: ${source}`)
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true })
    for (const name of await readdir(source)) await copyRestoreTree(join(source, name), join(destination, name), signal)
  } else {
    await copyFile(source, destination)
  }
}
function allowedInstanceEntry(path: string, item: BackupManifestInstanceItem): boolean {
  if (path === 'instance.json') return true
  const dir = path.split('/')[0]
  if (dir === 'saves') return item.includesSaves
  if (dir === 'mods' || path === 'mods-list.json') return item.includesMods
  if (dir === 'resourcepacks') return item.includesResourcePacks
  if (dir === 'shaderpacks') return item.includesShaderPacks
  if (dir === 'config' || dir === 'defaultconfigs' || dir === 'schematics') return item.includesConfigs
  return !path.includes('/') && item.includesConfigs
}

@ExposeServiceKey(BackupServiceKey)
export class BackupService extends AbstractService implements IBackupService {
  private autoBackupConfig: AutoBackupConfig | null = null
  private autoBackupTimer: ReturnType<typeof setInterval> | null = null
  private isAutoBackupRunning = false
  private operation: Promise<unknown> = Promise.resolve()
  private recoveryPath?: string
  private cancellation?: AbortController
  private committing = false

  async cancelBackupOperation(): Promise<boolean> {
    if (!this.cancellation || this.committing) return false
    this.cancellation.abort(new Error('Backup operation cancelled'))
    return true
  }

  private async cancellable<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController()
    this.cancellation = controller
    try { return await run(controller.signal) } finally { this.cancellation = undefined; this.committing = false }
  }

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const guarded = async () => {
      await this.initialize()
      if (this.recoveryPath) throw new RestoreRecoveryError('Backup operations blocked until restart recovery', this.recoveryPath)
      return run()
    }
    const next = this.operation.then(guarded, guarded)
    this.operation = next.catch(() => {})
    return next
  }

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(ThemeService) private themeService: ThemeService,
    @Inject(CollectionService) private collectionService: CollectionService,
  ) {
    super(app, async () => {
      await recoverRestore(app)
      await this.loadAutoBackupConfig()
      this.scheduleAutoBackupTimer()
    })
    app.registryDisposer(() => {
      if (this.autoBackupTimer) clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
      return this.operation.then(() => {})
    })
  }

  async createBackup(options: BackupOptions): Promise<string> {
    return this.exclusive(() => this.cancellable(signal => this.createBackupInternal(options, signal)))
  }

  private async createBackupInternal(options: BackupOptions, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    if (!options.silent) {
      this.emit('backup-progress', {
        phase: 'preparing',
        percent: 2,
        message: 'Preparing backup archive...',
      })
    }

    const zipFile = new ZipFile()
    const manifestInstances: BackupManifestInstanceItem[] = []
    let totalUncompressedBytes = 0

    // Setup granular counts tracking for UI
    const counts: BackupProgressCounts = {
      saves: options.instances?.some((i) => i.includeSaves) ? { current: 0, total: 0 } : undefined,
      mods: options.instances?.some((i) => i.includeMods) ? { current: 0, total: 0 } : undefined,
      resourcePacks: options.instances?.some((i) => i.includeResourcePacks) ? { current: 0, total: 0 } : undefined,
      shaderPacks: options.instances?.some((i) => i.includeShaderPacks) ? { current: 0, total: 0 } : undefined,
      configs: options.instances?.some((i) => i.includeConfigs) ? { current: 0, total: 0 } : undefined,
    }

    // Quick pre-count for selected instances to provide immediate totals in UI
    if (options.instances && options.instances.length > 0) {
      for (const inst of options.instances) {
        if (!existsSync(inst.instancePath)) continue

        const instanceJsonPath = join(inst.instancePath, 'instance.json')
        if (existsSync(instanceJsonPath)) {
          const instData = await readJson(instanceJsonPath).catch(() => undefined)
          if (instData?.edition === 'bedrock') continue
        }

        if (inst.includeSaves && counts.saves) {
          const savesDir = join(inst.instancePath, 'saves')
          const entries = await readdir(savesDir).catch(() => [])
          for (const e of entries) {
            const s = await lstat(join(savesDir, e)).catch(() => undefined)
            if (s?.isDirectory() && !s.isSymbolicLink()) {
              counts.saves.total++
            }
          }
        }

        if (inst.includeMods && counts.mods) {
          const modsDir = join(inst.instancePath, 'mods')
          const entries = await readdir(modsDir).catch(() => [])
          for (const m of entries) {
            if (m.endsWith('.jar') || m.endsWith('.zip')) {
              counts.mods.total++
            }
          }
        }

        if (inst.includeResourcePacks && counts.resourcePacks) {
          const rpDir = join(inst.instancePath, 'resourcepacks')
          const entries = await readdir(rpDir).catch(() => [])
          for (const r of entries) {
            if (!r.startsWith('.')) counts.resourcePacks.total++
          }
        }

        if (inst.includeShaderPacks && counts.shaderPacks) {
          const spDir = join(inst.instancePath, 'shaderpacks')
          const entries = await readdir(spDir).catch(() => [])
          for (const s of entries) {
            if (!s.startsWith('.')) counts.shaderPacks.total++
          }
        }

        if (inst.includeConfigs && counts.configs) {
          const configDir = join(inst.instancePath, 'config')
          const entries = await readdir(configDir).catch(() => [])
          counts.configs.total += entries.length + 3
        }
      }
    }

    // Helper to emit progress with snapshot of counts
    const emitProgress = (payload: {
      phase: any
      percent: number
      message: string
      currentInstance?: string
      currentInstanceIndex?: number
      totalInstances?: number
    }) => {
      if (options.silent) return
      this.emit('backup-progress', {
        ...payload,
        counts: {
          saves: counts.saves ? { ...counts.saves } : undefined,
          mods: counts.mods ? { ...counts.mods } : undefined,
          resourcePacks: counts.resourcePacks ? { ...counts.resourcePacks } : undefined,
          shaderPacks: counts.shaderPacks ? { ...counts.shaderPacks } : undefined,
          configs: counts.configs ? { ...counts.configs } : undefined,
        },
      })
    }

    emitProgress({
      phase: 'preparing',
      percent: 4,
      message: 'Preparing backup archive...',
    })

    // 1. Settings
    let includedSettings = false
    if (options.includeSettings) {
      emitProgress({
        phase: 'settings',
        percent: 6,
        message: 'Backing up launcher settings...',
      })
      const settingJsonPath = this.getAppDataPath('setting.json')
      if (existsSync(settingJsonPath)) {
        try {
          const content = await readFile(settingJsonPath)
          zipFile.addBuffer(content, 'settings/setting.json')
          totalUncompressedBytes += content.length
          includedSettings = true
        } catch (e) {
          this.warn(`Failed to read setting.json for backup: ${e}`)
        }
      }
    }

    // 2. Collections
    let includedCollections = false
    if (options.includeCollections) {
      emitProgress({
        phase: 'collections',
        percent: 9,
        message: 'Backing up saved collections...',
      })
      const collectionsJsonPath = this.getAppDataPath('collections.json')
      if (existsSync(collectionsJsonPath)) {
        try {
          const content = await readFile(collectionsJsonPath)
          zipFile.addBuffer(content, 'collections/collections.json')
          totalUncompressedBytes += content.length
          includedCollections = true
        } catch (e) {
          this.warn(`Failed to read collections.json for backup: ${e}`)
        }
      }
    }

    // 3. Themes
    let includedThemes = false
    if (options.includeThemes) {
      emitProgress({
        phase: 'themes',
        percent: 12,
        message: 'Backing up custom themes and media...',
      })
      const themeJsonPath = this.getAppDataPath('theme.json')
      const themeCssPath = this.getAppDataPath('theme.css')
      const themeMediaFolder = this.getAppDataPath('theme-media')

      if (existsSync(themeJsonPath)) {
        try {
          const content = await readFile(themeJsonPath)
          zipFile.addBuffer(content, 'themes/theme.json')
          totalUncompressedBytes += content.length
          includedThemes = true
        } catch (e) {
          this.warn(`Failed to read theme.json for backup: ${e}`)
        }
      }

      if (existsSync(themeCssPath)) {
        try {
          const content = await readFile(themeCssPath)
          zipFile.addBuffer(content, 'themes/theme.css')
          totalUncompressedBytes += content.length
        } catch (e) {
          this.warn(`Failed to read theme.css for backup: ${e}`)
        }
      }

      if (existsSync(themeMediaFolder)) {
        try {
          const mediaFiles = await readdir(themeMediaFolder)
          for (const file of mediaFiles) {
            const filePath = join(themeMediaFolder, file)
            const safe = await isSafeRegularFile(filePath)
            if (safe) {
              const fstat = await lstat(filePath).catch(() => undefined)
              if (fstat) {
                zipFile.addFile(filePath, `themes/theme-media/${file}`)
                totalUncompressedBytes += fstat.size
              }
            }
          }
        } catch (e) {
          this.warn(`Failed to read theme-media for backup: ${e}`)
        }
      }
    }

    // 4. Instances
    if (options.instances && options.instances.length > 0) {
      const totalInstances = options.instances.length
      for (let instIdx = 0; instIdx < totalInstances; instIdx++) {
        signal?.throwIfAborted()
        const instOpt = options.instances[instIdx]
        const instancePath = instOpt.instancePath
        if (!existsSync(instancePath)) continue

        const instanceJsonPath = join(instancePath, 'instance.json')
        if (!existsSync(instanceJsonPath)) continue

        let instData: any
        try {
          instData = await readJson(instanceJsonPath)
        } catch {
          continue
        }

        // Strictly exclude Bedrock edition instances
        if (instData.edition === 'bedrock') {
          continue
        }

        const rawName = instData.name || basename(instancePath)
        let safeFolderName = filenamify(rawName, { replacement: '_' }) || 'instance'
        const baseName = safeFolderName
        let suffix = 1
        while (manifestInstances.some(i => i.folderName.normalize('NFC').toLowerCase() === safeFolderName.normalize('NFC').toLowerCase())) safeFolderName = `${baseName}-${++suffix}`
        validateInstanceFolder(safeFolderName)
        const zipPrefix = `instances/${safeFolderName}`

        const baseInstPercent = Math.round(15 + (instIdx / totalInstances) * 45)
        emitProgress({
          phase: 'instances',
          currentInstance: rawName,
          currentInstanceIndex: instIdx + 1,
          totalInstances,
          percent: baseInstPercent,
          message: `Archiving instance: ${rawName} (${instIdx + 1}/${totalInstances})`,
        })

        let modsCount = 0
        const modsList: Array<{ fileName: string; size: number }> = []

        const scanAndAddDir = async (currentDir: string) => {
          const entries = await readdir(currentDir).catch(() => [])
          for (const entryName of entries) {
            signal?.throwIfAborted()
            const fullPath = join(currentDir, entryName)
            const relToInst = relative(instancePath, fullPath).replace(/\\/g, '/')

            if (isExcludedPath(relToInst)) {
              continue
            }

            const s = await lstat(fullPath).catch(() => undefined)
            if (!s) continue

            // Strictly never follow directory symlinks or junctions
            if (s.isSymbolicLink()) continue

            const topDir = relToInst.split('/')[0]

            if (s.isDirectory()) {
              if (topDir === 'saves' && !instOpt.includeSaves) continue
              if ((topDir === 'config' || topDir === 'defaultconfigs') && !instOpt.includeConfigs) continue
              if (topDir === 'resourcepacks' && !instOpt.includeResourcePacks) continue
              if (topDir === 'shaderpacks' && !instOpt.includeShaderPacks) continue
              if (topDir === 'mods') {
                if (!instOpt.includeMods) continue
                // If modListOnly, do not recursively zip mods directory files
                if (instOpt.modListOnly) {
                  const modEntries = await readdir(fullPath).catch(() => [])
                  for (const m of modEntries) {
                    const mPath = join(fullPath, m)
                    const ms = await lstat(mPath).catch(() => undefined)
                    if (ms?.isFile() && !ms.isSymbolicLink() && (m.endsWith('.jar') || m.endsWith('.zip'))) {
                      modsCount++
                      modsList.push({ fileName: m, size: ms.size })
                      if (counts.mods) {
                        counts.mods.current++
                      }
                    }
                  }
                  continue
                }
              }

              // Only traverse known instance directories to prevent recursing into external/server folders
              if (!isKnownInstanceDir(topDir)) continue

              // Track save worlds progress
              if (topDir === 'saves' && relToInst.split('/').length === 2 && counts.saves) {
                counts.saves.current++
                emitProgress({
                  phase: 'instances',
                  currentInstance: rawName,
                  currentInstanceIndex: instIdx + 1,
                  totalInstances,
                  percent: baseInstPercent,
                  message: `Adding save: ${entryName}`,
                })
              }

              await scanAndAddDir(fullPath)
            } else if (s.isFile()) {
              // Ensure file is safely readable before adding to zip
              const safe = await isSafeRegularFile(fullPath)
              if (!safe) continue

              if (relToInst === 'instance.json' || relToInst === 'icon.png' || relToInst === 'icon.ico' || relToInst === 'icon.gif') {
                zipFile.addFile(fullPath, `${zipPrefix}/${relToInst}`)
                totalUncompressedBytes += s.size
                continue
              }

              if (topDir === 'saves') {
                if (instOpt.includeSaves) {
                  zipFile.addFile(fullPath, `${zipPrefix}/${relToInst}`)
                  totalUncompressedBytes += s.size
                }
                continue
              }

              if (topDir === 'config' || topDir === 'defaultconfigs' || relToInst === 'options.txt' || relToInst === 'servers.dat' || relToInst === 'servers.dat_old') {
                if (instOpt.includeConfigs) {
                  zipFile.addFile(fullPath, `${zipPrefix}/${relToInst}`)
                  totalUncompressedBytes += s.size
                  if (counts.configs) {
                    counts.configs.current++
                  }
                }
                continue
              }

              if (topDir === 'resourcepacks') {
                if (instOpt.includeResourcePacks) {
                  zipFile.addFile(fullPath, `${zipPrefix}/${relToInst}`)
                  totalUncompressedBytes += s.size
                  if (counts.resourcePacks && (relToInst.endsWith('.zip') || relToInst.endsWith('.png'))) {
                    counts.resourcePacks.current++
                    emitProgress({
                      phase: 'instances',
                      currentInstance: rawName,
                      currentInstanceIndex: instIdx + 1,
                      totalInstances,
                      percent: baseInstPercent,
                      message: `Adding resource pack: ${entryName}`,
                    })
                  }
                }
                continue
              }

              if (topDir === 'shaderpacks') {
                if (instOpt.includeShaderPacks) {
                  zipFile.addFile(fullPath, `${zipPrefix}/${relToInst}`)
                  totalUncompressedBytes += s.size
                  if (counts.shaderPacks && relToInst.endsWith('.zip')) {
                    counts.shaderPacks.current++
                    emitProgress({
                      phase: 'instances',
                      currentInstance: rawName,
                      currentInstanceIndex: instIdx + 1,
                      totalInstances,
                      percent: baseInstPercent,
                      message: `Adding shader pack: ${entryName}`,
                    })
                  }
                }
                continue
              }

              if (topDir === 'mods') {
                if (instOpt.includeMods) {
                  if (entryName.endsWith('.jar') || entryName.endsWith('.zip')) {
                    modsCount++
                    modsList.push({ fileName: entryName, size: s.size })
                    if (counts.mods) {
                      counts.mods.current++
                      emitProgress({
                        phase: 'instances',
                        currentInstance: rawName,
                        currentInstanceIndex: instIdx + 1,
                        totalInstances,
                        percent: baseInstPercent,
                        message: `Adding mod: ${entryName}`,
                      })
                    }
                  }
                  if (!instOpt.modListOnly) {
                    zipFile.addFile(fullPath, `${zipPrefix}/${relToInst}`)
                    totalUncompressedBytes += s.size
                  }
                }
                continue
              }

              // Other root config or meta files (e.g. servers.dat, modpack-metadata.json, mod-groups.json)
              if (instOpt.includeConfigs && (relToInst.endsWith('.json') || relToInst.endsWith('.txt'))) {
                zipFile.addFile(fullPath, `${zipPrefix}/${relToInst}`)
                totalUncompressedBytes += s.size
                if (counts.configs) {
                  counts.configs.current++
                }
              }
            }
          }
        }

        await scanAndAddDir(instancePath)

        // Write mods-list.json if mods were scanned
        if (instOpt.includeMods && modsList.length > 0) {
          const buf = Buffer.from(JSON.stringify(modsList, null, 2))
          zipFile.addBuffer(buf, `${zipPrefix}/mods-list.json`)
          totalUncompressedBytes += buf.length
        }

        manifestInstances.push({
          id: safeFolderName,
          name: rawName,
          folderName: safeFolderName,
          mcVersion: instData.runtime?.minecraft,
          loader: instData.runtime?.forge
            ? `Forge ${instData.runtime.forge}`
            : instData.runtime?.fabricLoader
              ? `Fabric ${instData.runtime.fabricLoader}`
              : instData.runtime?.neoForged
                ? `NeoForge ${instData.runtime.neoForged}`
                : instData.runtime?.quiltLoader
                  ? `Quilt ${instData.runtime.quiltLoader}`
                  : undefined,
          includesSaves: !!instOpt.includeSaves,
          includesConfigs: !!instOpt.includeConfigs,
          includesMods: !!instOpt.includeMods,
          includesResourcePacks: !!instOpt.includeResourcePacks,
          includesShaderPacks: !!instOpt.includeShaderPacks,
          modListOnly: !!instOpt.modListOnly,
          modsCount,
        })
      }
    }

    const manifest: BackupManifest = {
      version: 1,
      createdAt: Date.now(),
      appVersion: this.app.version,
      includes: {
        settings: includedSettings,
        collections: includedCollections,
        themes: includedThemes,
        instances: manifestInstances,
      },
    }

    const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2))
    zipFile.addBuffer(manifestBuf, 'manifest.json')
    totalUncompressedBytes += manifestBuf.length

    let destination = options.destinationPath
    if (!destination.endsWith('.xmclbackup') && !destination.endsWith('.zip')) {
      destination += '.xmclbackup'
    }

    emitProgress({
      phase: 'compressing',
      percent: 60,
      message: 'Compressing and writing backup archive...',
    })

    const estimatedCompressedBytes = Math.max(1024 * 1024, totalUncompressedBytes * 0.75)
    let lastProgressEmit = Date.now()

    await ensureDir(dirname(destination))
    destination = await safeBackupPath(dirname(destination), basename(destination))
    if (existsSync(destination)) throw new Error('Backup destination already exists')
    const pending = await mkdtemp(join(dirname(destination), '.xmcl-backup-pending-'))
    const pendingFile = join(pending, 'archive.partial')
    try {
    await writeZipFile(
      zipFile,
      pendingFile,
      signal,
      undefined,
      (writtenBytes) => {
        const now = Date.now()
        if (now - lastProgressEmit >= 300) {
          lastProgressEmit = now
          const ratio = Math.min(1, writtenBytes / estimatedCompressedBytes)
          const compressPercent = Math.min(99, Math.round(60 + ratio * 39))
          const mbWritten = (writtenBytes / 1024 / 1024).toFixed(1)
          emitProgress({
            phase: 'compressing',
            percent: compressPercent,
            message: `Writing archive (${mbWritten} MB)...`,
          })
        }
      },
    )

    signal?.throwIfAborted()
    await this.loadBackupManifest(pendingFile)
    const handle = await openFile(pendingFile, 'r')
    try { await handle.sync() } finally { await handle.close() }
    // link is a no-clobber publication in the same destination filesystem. No
    // completed service name is ever visible while the archive is being written.
    signal?.throwIfAborted()
    this.committing = true
    await link(pendingFile, destination)
    await syncRestoreDirectory(dirname(destination))
    } finally { await rm(pending, { recursive: true, force: true }) }

    // Complete all counts to total if any slight discrepancy
    if (counts.saves) counts.saves.current = counts.saves.total
    if (counts.mods) counts.mods.current = counts.mods.total
    if (counts.resourcePacks) counts.resourcePacks.current = counts.resourcePacks.total
    if (counts.shaderPacks) counts.shaderPacks.current = counts.shaderPacks.total
    if (counts.configs) counts.configs.current = counts.configs.total

    emitProgress({
      phase: 'complete',
      percent: 100,
      message: 'Backup archive created successfully!',
    })

    this.log(`Successfully created backup at: ${destination}`)
    return destination
  }

  async loadBackupManifest(backupPath: string): Promise<BackupManifest> {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file does not exist: ${backupPath}`)
    }

    const zipFile = await open(backupPath)
    try {
      const entries = await readBoundedBackupEntries(zipFile)
      validateBackupEntries(entries)
      const manifestEntry = entries.find(e => e.fileName === 'manifest.json')
      if (!manifestEntry) throw new Error('Invalid backup file: manifest.json not found')
      return validateBackupManifest(await readBackupJSON(zipFile, manifestEntry, { bytes: 0 }))
    } finally {
      zipFile.close()
    }
  }

  async restoreBackup(options: RestoreBackupOptions): Promise<RestoreBackupResult> {
    return this.exclusive(() => this.cancellable(signal => this.restoreBackupInternal(options, signal)))
  }

  private async restoreBackupInternal(options: RestoreBackupOptions, signal: AbortSignal): Promise<RestoreBackupResult> {
    signal.throwIfAborted()
    const selected = options.instances || []
    for (const name of selected) validateInstanceFolder(name)
    if (new Set(selected.map(n => n.toLowerCase())).size !== selected.length) throw new Error('Duplicate restore instance selection')
    const maintenance = await this.app.registry.get(kRestoreMaintenance)
    if (!maintenance || typeof maintenance.enter !== 'function') throw new Error('Restore maintenance is unavailable; refusing unsafe restore')
    const lease = await maintenance.enter()
    let recoveryRequired = false
    const zip = await open(options.backupPath).catch(async (e) => { await lease.release(false); throw e })
    let zipClosed = false
    let leaseReleased = false
    try {
      await RestoreTransaction.recover(this.getAppDataPath('restore-transactions'))
      this.emit('restore-progress', { phase: 'reading', percent: 5, message: 'Validating backup and preparing recoverable restore...' })
      const entries = await readBoundedBackupEntries(zip)
      validateBackupEntries(entries)
      const budget = { bytes: 0 }
      const consumed = new Set<ZipEntry>()
      const json = async (entry: ZipEntry) => { consumed.add(entry); return readBackupJSON(zip, entry, budget, signal) }
      const manifestEntry = entries.find(e => e.fileName === 'manifest.json')
      if (!manifestEntry) throw new Error('Invalid backup: manifest.json missing')
      const manifest = validateBackupManifest(await json(manifestEntry))
      for (const name of selected) if (!manifest.includes.instances.some(i => i.folderName === name)) throw new Error(`Unknown backup instance: ${name}`)
      const result: RestoreBackupResult = { restoredSettings: false, restoredCollections: false, restoredThemes: false, restoredInstances: [], skippedInstances: [] }
      const plan: RestorePublishPlan = { instances: [] }
      const targets: { live: string; stage: (candidate: string) => Promise<void> }[] = []
      const find = (...names: string[]) => {
        const found = entries.filter(e => names.includes(e.fileName))
        if (found.length !== 1) throw new Error(`Missing or ambiguous backup entry: ${names[0]}`)
        return found[0]
      }
      const addJSON = (live: string, value: unknown) => targets.push({ live, stage: p => writeFile(p, JSON.stringify(value, null, 2)) })
      const extract = async (entry: ZipEntry, destination: string) => {
        consumed.add(entry)
        await ensureDir(dirname(destination))
        await pipeline(await openEntryReadStream(zip, entry), backupByteLimiter(entry, budget), createWriteStream(destination, { flags: 'w' }), { signal })
      }
      if (options.restoreSettings && manifest.includes.settings) {
        plan.settings = SettingSchema.parse(await json(find('settings/setting.json', 'setting.json')))
        addJSON(await safeBackupPath(this.getAppDataPath(), 'setting.json'), plan.settings)
        result.restoredSettings = true
      }
      if (options.restoreCollections && manifest.includes.collections) {
        const incoming = CollectionsFileSchema.parse(await json(find('collections/collections.json', 'collections.json')))
        const merged = new Map(this.collectionService.state.collections.map(c => [c.id, c]))
        for (const collection of incoming.collections) merged.set(collection.id, collection)
        plan.collections = CollectionsFileSchema.parse({ ...incoming, collections: [...merged.values()] })
        addJSON(await safeBackupPath(this.getAppDataPath(), 'collections.json'), plan.collections)
        result.restoredCollections = true
      }
      if (options.restoreThemes && manifest.includes.themes) {
        const theme = await json(find('themes/theme.json', 'theme.json'))
        if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error('Invalid backup theme JSON')
        addJSON(await safeBackupPath(this.getAppDataPath(), 'theme.json'), theme)
        const css = entries.filter(e => ['themes/theme.css', 'theme.css'].includes(e.fileName))
        if (css.length > 1) throw new Error('Ambiguous theme CSS')
        if (css[0]) {
          if (css[0].uncompressedSize > 1024 * 1024) throw new Error('Theme CSS size limit exceeded')
          targets.push({ live: await safeBackupPath(this.getAppDataPath(), 'theme.css'), stage: p => extract(css[0], p) })
        }
        const media = entries.filter(e => e.fileName.startsWith('themes/theme-media/') && !e.fileName.endsWith('/'))
        if (media.length) {
          const live = await safeBackupPath(this.getAppDataPath(), 'theme-media', 'directory')
          targets.push({ live, stage: async p => {
            await copyRestoreTree(live, p, signal)
            for (const entry of media) await extract(entry, await safeBackupPath(p, entry.fileName.substring('themes/theme-media/'.length)))
          } })
        }
        result.restoredThemes = true
      }
      const instancesRoot = this.getPath('instances')
      for (const name of selected) {
        const item = manifest.includes.instances.find(i => i.folderName === name)!
        let targetName = name
        let live = await safeBackupPath(instancesRoot, targetName, 'directory')
        const conflict = options.instanceConflictStrategy || 'rename'
        if (!['rename', 'skip', 'overwrite'].includes(conflict)) throw new Error('Invalid instance conflict strategy')
        if (existsSync(live)) {
          if (conflict === 'skip') { result.skippedInstances!.push(name); continue }
          if (conflict === 'rename') {
            let count = 1
            targetName = `${name}-restored`
            while (existsSync(join(instancesRoot, targetName))) targetName = `${name}-restored-${++count}`
            live = await safeBackupPath(instancesRoot, targetName, 'directory')
          }
        }
        const prefix = `instances/${name}/`
        const instanceEntries = entries.filter(e => e.fileName.startsWith(prefix) && !e.fileName.endsWith('/'))
        if (!instanceEntries.some(e => e.fileName === `${prefix}instance.json`)) throw new Error(`Missing instance.json: ${name}`)
        for (const entry of instanceEntries) {
          const rel = entry.fileName.substring(prefix.length)
          if (!allowedInstanceEntry(rel, item)) throw new Error(`Entry conflicts with manifest categories: ${entry.fileName}`)
        }
        targets.push({ live, stage: async p => {
          await copyRestoreTree(live, p, signal)
          for (const entry of instanceEntries) await extract(entry, await safeBackupPath(p, entry.fileName.substring(prefix.length)))
          const data = InstanceSchema.parse(await readJson(join(p, 'instance.json')))
          delete data.path
          if (targetName !== name) data.name = `${data.name || name} (Restored)`
          await writeFile(join(p, 'instance.json'), JSON.stringify(data, null, 2))
          plan.instances.push({ path: live, data })
          result.restoredInstances.push(live)
        } })
      }
      if (selected.length > (result.skippedInstances?.length || 0)) {
        targets.push({ live: await safeBackupPath(this.getAppDataPath(), 'instances.json'), stage: async p => { await writeFile(p, await lease.prepareInstances(plan.instances)) } })
      }
      const fault = await getE2ERestoreFault(this.getAppDataPath(), signal)
      const tx = await RestoreTransaction.prepare(this.getAppDataPath('restore-transactions'), targets, async (point, index) => {
        if (point.startsWith('staging-') || point === 'prepared') signal.throwIfAborted()
        await fault?.(point, index)
      })
      try {
        for (const entry of entries) if (!consumed.has(entry) && !entry.fileName.endsWith('/')) {
          await pipeline(await openEntryReadStream(zip, entry), backupByteLimiter(entry, budget), new Writable({ write(_chunk, _encoding, callback) { callback() } }), { signal })
        }
        signal.throwIfAborted()
        zip.close(); zipClosed = true
      } catch (e) {
        await RestoreTransaction.recover(this.getAppDataPath('restore-transactions'))
        throw e
      }
      this.committing = true
      this.emit('restore-progress', { phase: 'committing', percent: 90, message: 'Committing restore. Cancellation is no longer available; failures will roll back.' })
      const completion = await tx.commit(() => lease.publish(plan), () => {
        this.emit('restore-progress', { phase: 'rolling-back', percent: 0, message: 'Restore failed; original data restored. Reverting published state...' })
        return lease.undoPublish()
      })
      if (completion.cleanupPending) {
        result.cleanupPending = true
        result.recoveryPath = completion.recoveryPath
        this.warn(`Restore committed with cleanup pending: ${completion.recoveryPath}`)
      }
      leaseReleased = true
      await lease.release(false)
      this.emit('restore-progress', { phase: 'complete', percent: 100, message: result.cleanupPending ? 'Restore committed; retained transaction cleanup will resume on restart.' : 'Restore completed successfully!', recoveryPath: result.recoveryPath })
      return result
    } catch (e) {
      if (e instanceof RestoreRecoveryError) {
        recoveryRequired = true
        this.recoveryPath = e.recoveryPath
        this.emit('restore-progress', { phase: 'recovery-required', recoveryPath: e.recoveryPath, percent: 0, message: e.message })
      }
      throw e
    } finally {
      if (!zipClosed) zip.close()
      if (!leaseReleased) await lease.release(recoveryRequired)
    }
  }

  private getDefaultAutoBackupConfig(): AutoBackupConfig {
    return {
      enabled: false,
      instancePaths: [],
      intervalMinutes: 60,
      maxBackups: 5,
      destinationDir: this.getAppDataPath('backups'),
      includeSaves: true,
      includeConfigs: true,
      includeMods: true,
      modListOnly: true,
      includeResourcePacks: false,
      includeShaderPacks: false,
      includeSettings: false,
    }
  }

  private async loadAutoBackupConfig(): Promise<AutoBackupConfig> {
    if (this.autoBackupConfig) return this.autoBackupConfig
    const defaults = this.getDefaultAutoBackupConfig()
    const filePath = this.getAppDataPath('auto-backup.json')
    if (existsSync(filePath)) {
      try {
        const raw = await readJson(filePath)
        if (raw && typeof raw === 'object') {
          this.autoBackupConfig = {
            enabled: Boolean(raw.enabled),
            instancePaths: Array.isArray(raw.instancePaths)
              ? raw.instancePaths.filter((p: any): p is string => typeof p === 'string' && p.length > 0)
              : [],
            intervalMinutes: Math.max(5, Number(raw.intervalMinutes) || defaults.intervalMinutes),
            maxBackups: Math.max(1, Number(raw.maxBackups) || defaults.maxBackups),
            destinationDir: typeof raw.destinationDir === 'string' && raw.destinationDir.trim()
              ? raw.destinationDir.trim()
              : defaults.destinationDir,
            includeSaves: raw.includeSaves !== undefined ? Boolean(raw.includeSaves) : defaults.includeSaves,
            includeConfigs: raw.includeConfigs !== undefined ? Boolean(raw.includeConfigs) : defaults.includeConfigs,
            includeMods: raw.includeMods !== undefined ? Boolean(raw.includeMods) : defaults.includeMods,
            modListOnly: raw.modListOnly !== undefined ? Boolean(raw.modListOnly) : defaults.modListOnly,
            includeResourcePacks: raw.includeResourcePacks !== undefined ? Boolean(raw.includeResourcePacks) : defaults.includeResourcePacks,
            includeShaderPacks: raw.includeShaderPacks !== undefined ? Boolean(raw.includeShaderPacks) : defaults.includeShaderPacks,
            includeSettings: raw.includeSettings !== undefined ? Boolean(raw.includeSettings) : defaults.includeSettings,
            lastBackupAt: typeof raw.lastBackupAt === 'number' ? raw.lastBackupAt : undefined,
            lastBackupPath: typeof raw.lastBackupPath === 'string' ? raw.lastBackupPath : undefined,
            lastError: typeof raw.lastError === 'string' ? raw.lastError : undefined,
          }
          return this.autoBackupConfig
        }
      } catch (e) {
        this.warn(`Failed to load auto-backup.json: ${e}`)
      }
    }
    this.autoBackupConfig = defaults
    return this.autoBackupConfig
  }

  private async saveAutoBackupConfig(): Promise<void> {
    if (!this.autoBackupConfig) return
    const filePath = this.getAppDataPath('auto-backup.json')
    await ensureDir(dirname(filePath))
    await writeJson(filePath, this.autoBackupConfig, { spaces: 2 })
  }

  private scheduleAutoBackupTimer(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
    }
    const cfg = this.autoBackupConfig
    if (!cfg || !cfg.enabled) return

    this.autoBackupTimer = setInterval(() => {
      const current = this.autoBackupConfig
      if (!current || !current.enabled || this.isAutoBackupRunning) return
      if (current.instancePaths.length === 0 && !current.includeSettings) return
      const last = current.lastBackupAt || 0
      const intervalMs = Math.max(5, current.intervalMinutes) * 60 * 1000
      if (Date.now() - last >= intervalMs) {
        this.runAutoBackupNow().catch((e) => {
          this.warn(`Background auto-backup failed: ${e}`)
        })
      }
    }, 30_000)

    if (typeof (this.autoBackupTimer as any)?.unref === 'function') {
      (this.autoBackupTimer as any).unref()
    }
  }

  async getAutoBackupConfig(): Promise<AutoBackupConfig> {
    const cfg = await this.loadAutoBackupConfig()
    if (cfg.destinationDir) {
      await ensureDir(cfg.destinationDir).catch(() => {})
    }
    return {
      ...cfg,
      instancePaths: [...cfg.instancePaths],
    }
  }

  async setAutoBackupConfig(patch: Partial<AutoBackupConfig>): Promise<AutoBackupConfig> {
    const current = await this.loadAutoBackupConfig()
    const defaults = this.getDefaultAutoBackupConfig()

    this.autoBackupConfig = {
      ...current,
      enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
      instancePaths: Array.isArray(patch.instancePaths)
        ? patch.instancePaths.filter((p): p is string => typeof p === 'string' && p.length > 0)
        : current.instancePaths,
      intervalMinutes: patch.intervalMinutes !== undefined
        ? Math.max(5, Number(patch.intervalMinutes) || defaults.intervalMinutes)
        : current.intervalMinutes,
      maxBackups: patch.maxBackups !== undefined
        ? Math.max(1, Number(patch.maxBackups) || defaults.maxBackups)
        : current.maxBackups,
      destinationDir: typeof patch.destinationDir === 'string' && patch.destinationDir.trim()
        ? patch.destinationDir.trim()
        : current.destinationDir,
      includeSaves: patch.includeSaves !== undefined ? Boolean(patch.includeSaves) : current.includeSaves,
      includeConfigs: patch.includeConfigs !== undefined ? Boolean(patch.includeConfigs) : current.includeConfigs,
      includeMods: patch.includeMods !== undefined ? Boolean(patch.includeMods) : current.includeMods,
      modListOnly: patch.modListOnly !== undefined ? Boolean(patch.modListOnly) : current.modListOnly,
      includeResourcePacks: patch.includeResourcePacks !== undefined ? Boolean(patch.includeResourcePacks) : current.includeResourcePacks,
      includeShaderPacks: patch.includeShaderPacks !== undefined ? Boolean(patch.includeShaderPacks) : current.includeShaderPacks,
      includeSettings: patch.includeSettings !== undefined ? Boolean(patch.includeSettings) : current.includeSettings,
    }

    await this.saveAutoBackupConfig()
    this.scheduleAutoBackupTimer()
    const snapshot = await this.getAutoBackupConfig()
    this.emit('auto-backup-status', {
      running: this.isAutoBackupRunning,
      config: snapshot,
    })
    return snapshot
  }

  async runAutoBackupNow(): Promise<string | undefined> {
    return this.exclusive(() => this.cancellable(signal => this.runAutoBackupNowInternal(signal)))
  }

  private async runAutoBackupNowInternal(signal: AbortSignal): Promise<string | undefined> {
    if (this.isAutoBackupRunning) return undefined
    const cfg = await this.loadAutoBackupConfig()

    const validInstancePaths: string[] = []
    for (const p of cfg.instancePaths) {
      if (!existsSync(p)) continue
      const instJsonPath = join(p, 'instance.json')
      if (existsSync(instJsonPath)) {
        const instData = await readJson(instJsonPath).catch(() => undefined)
        if (instData?.edition === 'bedrock') continue
      }
      validInstancePaths.push(p)
    }

    if (validInstancePaths.length === 0 && !cfg.includeSettings) {
      return undefined
    }

    this.isAutoBackupRunning = true
    this.emit('auto-backup-status', {
      running: true,
      config: await this.getAutoBackupConfig(),
    })

    try {
      const destDir = cfg.destinationDir || this.getAppDataPath('backups')
      await ensureDir(destDir)

      const now = new Date()
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(now.getMilliseconds()).padStart(3, '0')}`
      const destFile = join(destDir, `xmcl-auto-backup-${stamp}.xmclbackup`)

      const createdPath = await this.createBackupInternal({
        destinationPath: destFile,
        includeSettings: cfg.includeSettings,
        includeCollections: false,
        includeThemes: false,
        silent: true,
        instances: validInstancePaths.map((instancePath) => ({
          instancePath,
          includeSaves: cfg.includeSaves,
          includeConfigs: cfg.includeConfigs,
          includeMods: cfg.includeMods,
          modListOnly: cfg.modListOnly,
          includeResourcePacks: cfg.includeResourcePacks,
          includeShaderPacks: cfg.includeShaderPacks,
        })),
      }, signal)

      await this.rotateAutoBackups(destDir, cfg.maxBackups)

      cfg.lastBackupAt = Date.now()
      cfg.lastBackupPath = createdPath
      cfg.lastError = undefined
      await this.saveAutoBackupConfig()

      this.log(`Background auto-backup completed: ${createdPath}`)
      return createdPath
    } catch (e: any) {
      cfg.lastError = e?.message || String(e)
      await this.saveAutoBackupConfig().catch(() => {})
      throw e
    } finally {
      this.isAutoBackupRunning = false
      const updated = await this.getAutoBackupConfig()
      this.emit('auto-backup-status', {
        running: false,
        config: updated,
      })
    }
  }

  private async rotateAutoBackups(destDir: string, maxBackups: number): Promise<void> {
    const limit = Math.max(1, maxBackups)
    const files = await readdir(destDir).catch(() => [])
    const autoBackups: Array<{ filePath: string; mtimeMs: number }> = []

    for (const f of files) {
      if (/^xmcl-auto-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.xmclbackup$/.test(f)) {
        const full = join(destDir, f)
        const s = await lstat(full).catch(() => undefined)
        if (s && s.isFile()) {
          autoBackups.push({ filePath: full, mtimeMs: s.mtimeMs })
        }
      }
    }

    autoBackups.sort((a, b) => b.mtimeMs - a.mtimeMs)

    for (let i = limit; i < autoBackups.length; i++) {
      await unlink(autoBackups[i].filePath).catch(() => {})
    }
  }

  async listAutoBackups(): Promise<AutoBackupFileEntry[]> {
    const cfg = await this.loadAutoBackupConfig()
    const destDir = cfg.destinationDir || this.getAppDataPath('backups')
    if (!existsSync(destDir)) return []

    const files = await readdir(destDir).catch(() => [])
    const entries: AutoBackupFileEntry[] = []

    for (const f of files) {
      if (f.endsWith('.xmclbackup') || f.endsWith('.zip')) {
        const full = join(destDir, f)
        const s = await lstat(full).catch(() => undefined)
        if (s && s.isFile()) {
          entries.push({
            fileName: f,
            filePath: full,
            createdAt: Math.round(s.mtimeMs),
            sizeBytes: s.size,
          })
        }
      }
    }

    entries.sort((a, b) => b.createdAt - a.createdAt)
    return entries
  }

  async deleteAutoBackup(filePath: string): Promise<void> {
    return this.exclusive(() => this.deleteAutoBackupInternal(filePath))
  }

  private async deleteAutoBackupInternal(filePath: string): Promise<void> {
    const cfg = await this.loadAutoBackupConfig()
    const destDir = resolve(cfg.destinationDir || this.getAppDataPath('backups'))
    const requested = resolve(filePath)
    if (dirname(requested) !== destDir) {
      throw new Error('Cannot delete file outside auto-backup directory')
    }
    const target = await safeBackupPath(destDir, basename(requested))
    if (!target.endsWith('.xmclbackup') && !target.endsWith('.zip')) {
      throw new Error('Invalid backup archive extension')
    }
    if (existsSync(target)) {
      await unlink(target)
    }
  }
}
