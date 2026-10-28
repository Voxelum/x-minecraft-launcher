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
import {
  close as closeFs,
  ensureDir,
  existsSync,
  lstat,
  open as openFs,
  readdir,
  readFile,
  readJson,
  stat,
  unlink,
  writeFile,
  writeJson,
} from 'fs-extra'
import filenamify from 'filenamify'
import { basename, dirname, join, normalize, relative } from 'path'
import { pipeline } from 'stream/promises'
import { ZipFile } from 'yazl'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import { CollectionService } from '~/collection/CollectionService'
import { InstanceService } from '~/instance/InstanceService'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kSettings } from '~/settings'
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

async function readZipEntryAsBuffer(zipFile: any, entry: ZipEntry): Promise<Buffer> {
  const readable = await openEntryReadStream(zipFile, entry)
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

@ExposeServiceKey(BackupServiceKey)
export class BackupService extends AbstractService implements IBackupService {
  private autoBackupConfig: AutoBackupConfig | null = null
  private autoBackupTimer: ReturnType<typeof setInterval> | null = null
  private isAutoBackupRunning = false

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(ThemeService) private themeService: ThemeService,
    @Inject(CollectionService) private collectionService: CollectionService,
  ) {
    super(app, async () => {
      await this.loadAutoBackupConfig()
      this.scheduleAutoBackupTimer()
    })
  }

  async createBackup(options: BackupOptions): Promise<string> {
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
        const safeFolderName = filenamify(rawName, { replacement: '_' })
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

    await writeZipFile(
      zipFile,
      destination,
      undefined,
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
    const entries = await readAllEntries(zipFile)
    const manifestEntry = entries.find((e) => e.fileName === 'manifest.json')

    if (!manifestEntry) {
      throw new Error('Invalid backup file: manifest.json not found')
    }

    const buffer = await readZipEntryAsBuffer(zipFile, manifestEntry)
    const manifest = JSON.parse(buffer.toString('utf-8')) as BackupManifest

    if (!manifest.version || !manifest.includes) {
      throw new Error('Invalid backup manifest format')
    }

    return manifest
  }

  async restoreBackup(options: RestoreBackupOptions): Promise<RestoreBackupResult> {
    this.emit('restore-progress', {
      phase: 'reading',
      percent: 5,
      message: 'Reading backup archive manifest...',
    })

    const manifest = await this.loadBackupManifest(options.backupPath)
    const zipFile = await open(options.backupPath)
    const entries = await readAllEntries(zipFile)

    const result: RestoreBackupResult = {
      restoredSettings: false,
      restoredCollections: false,
      restoredThemes: false,
      restoredInstances: [],
      skippedInstances: [],
    }

    // 1. Settings
    if (options.restoreSettings && manifest.includes.settings) {
      this.emit('restore-progress', {
        phase: 'settings',
        percent: 20,
        message: 'Restoring launcher settings...',
      })
      const settingEntry = entries.find((e) => e.fileName === 'settings/setting.json' || e.fileName === 'setting.json')
      if (settingEntry) {
        try {
          const buf = await readZipEntryAsBuffer(zipFile, settingEntry)
          const parsed = JSON.parse(buf.toString('utf-8'))
          const validated = SettingSchema.parse(parsed)
          const settingsState = await this.app.registry.get(kSettings)
          settingsState.config(validated)
          result.restoredSettings = true
          this.log('Settings restored successfully from backup')
        } catch (e) {
          this.warn(`Failed to restore settings: ${e}`)
        }
      }
    }

    // 2. Collections
    if (options.restoreCollections && manifest.includes.collections) {
      this.emit('restore-progress', {
        phase: 'collections',
        percent: 35,
        message: 'Restoring saved collections...',
      })
      const colEntry = entries.find((e) => e.fileName === 'collections/collections.json' || e.fileName === 'collections.json')
      if (colEntry) {
        try {
          const buf = await readZipEntryAsBuffer(zipFile, colEntry)
          const parsed = JSON.parse(buf.toString('utf-8'))
          const validated = CollectionsFileSchema.parse(parsed)

          for (const col of validated.collections) {
            this.collectionService.state.collectionUpsert(col)
          }
          result.restoredCollections = true
          this.log(`Restored ${validated.collections.length} collections from backup`)
        } catch (e) {
          this.warn(`Failed to restore collections: ${e}`)
        }
      }
    }

    // 3. Themes
    if (options.restoreThemes && manifest.includes.themes) {
      this.emit('restore-progress', {
        phase: 'themes',
        percent: 50,
        message: 'Restoring custom themes and media...',
      })
      const themeEntry = entries.find((e) => e.fileName === 'themes/theme.json' || e.fileName === 'theme.json')
      if (themeEntry) {
        try {
          const buf = await readZipEntryAsBuffer(zipFile, themeEntry)
          const themeData = JSON.parse(buf.toString('utf-8'))

          const themeMediaFolder = this.getAppDataPath('theme-media')
          await ensureDir(themeMediaFolder)

          for (const entry of entries) {
            if (entry.fileName.startsWith('themes/theme-media/')) {
              const relName = entry.fileName.substring('themes/theme-media/'.length)
              if (!relName || relName.endsWith('/')) continue
              const outPath = join(themeMediaFolder, relName)
              // zip-slip check
              if (!normalize(outPath).startsWith(normalize(themeMediaFolder))) continue

              await ensureDir(dirname(outPath))
              const readable = await openEntryReadStream(zipFile, entry)
              await pipeline(readable, createWriteStream(outPath))
            } else if (entry.fileName === 'themes/theme.css' || entry.fileName === 'theme.css') {
              const cssBuf = await readZipEntryAsBuffer(zipFile, entry)
              await writeFile(this.getAppDataPath('theme.css'), cssBuf)
            }
          }

          await this.themeService.setCurrentTheme(themeData)
          result.restoredThemes = true
          this.log('Themes restored successfully from backup')
        } catch (e) {
          this.warn(`Failed to restore themes: ${e}`)
        }
      }
    }

    // 4. Instances
    const instancesToRestore = options.instances || []
    if (instancesToRestore.length > 0) {
      const instancesRoot = this.getPath('instances')
      await ensureDir(instancesRoot)

      const totalInst = instancesToRestore.length
      for (let i = 0; i < totalInst; i++) {
        const instFolderName = instancesToRestore[i]
        const instPercent = Math.round(55 + ((i) / totalInst) * 40)
        this.emit('restore-progress', {
          phase: 'instances',
          currentInstance: instFolderName,
          currentInstanceIndex: i + 1,
          totalInstances: totalInst,
          percent: instPercent,
          message: `Restoring instance: ${instFolderName} (${i + 1}/${totalInst})`,
        })
        const prefix = `instances/${instFolderName}/`
        const instEntries = entries.filter((e) => e.fileName.startsWith(prefix) && !e.fileName.endsWith('/'))
        if (instEntries.length === 0) continue

        let targetDir = join(instancesRoot, instFolderName)
        const conflict = options.instanceConflictStrategy || 'rename'

        if (existsSync(targetDir)) {
          if (conflict === 'skip') {
            this.log(`Skipping already existing instance folder: ${instFolderName}`)
            result.skippedInstances?.push(instFolderName)
            continue
          }
          if (conflict === 'rename') {
            let counter = 1
            let candidate = `${instFolderName}-restored`
            while (existsSync(join(instancesRoot, candidate))) {
              counter++
              candidate = `${instFolderName}-restored-${counter}`
            }
            targetDir = join(instancesRoot, candidate)
          }
          // If 'overwrite', targetDir remains the same
        }

        await ensureDir(targetDir)

        for (const entry of instEntries) {
          const relPath = entry.fileName.substring(prefix.length)
          const destPath = join(targetDir, relPath)

          // zip-slip check
          if (!normalize(destPath).startsWith(normalize(targetDir))) {
            continue
          }

          await ensureDir(dirname(destPath))
          const readable = await openEntryReadStream(zipFile, entry)
          await pipeline(readable, createWriteStream(destPath))
        }

        // If the instance was renamed, update its internal name in instance.json
        const instJsonPath = join(targetDir, 'instance.json')
        if (existsSync(instJsonPath)) {
          try {
            const data = await readJson(instJsonPath)
            if (targetDir !== join(instancesRoot, instFolderName)) {
              data.name = `${data.name || instFolderName} (Restored)`
              await writeJson(instJsonPath, data, { spaces: 2 })
            }
          } catch {
            // Ignore error updating name
          }
        }

        // Load into InstanceService
        try {
          await this.instanceService.loadInstance(targetDir)
          result.restoredInstances.push(targetDir)
          this.log(`Restored instance: ${targetDir}`)
        } catch (e) {
          this.warn(`Failed to load restored instance at ${targetDir}: ${e}`)
        }
      }
    }

    this.emit('restore-progress', {
      phase: 'complete',
      percent: 100,
      message: 'Restore completed successfully!',
    })

    return result
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

      const createdPath = await this.createBackup({
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
      })

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
      if (f.startsWith('xmcl-auto-backup-') && (f.endsWith('.xmclbackup') || f.endsWith('.zip'))) {
        const full = join(destDir, f)
        const s = await stat(full).catch(() => undefined)
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
        const s = await stat(full).catch(() => undefined)
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
    const cfg = await this.loadAutoBackupConfig()
    const destDir = normalize(cfg.destinationDir || this.getAppDataPath('backups'))
    const target = normalize(filePath)
    if (!target.startsWith(destDir)) {
      throw new Error('Cannot delete file outside auto-backup directory')
    }
    if (!target.endsWith('.xmclbackup') && !target.endsWith('.zip')) {
      throw new Error('Invalid backup archive extension')
    }
    if (existsSync(target)) {
      await unlink(target)
    }
  }
}
