import {
  BaseServiceKey,
  type Environment,
  type BaseService as IBaseService,
  type InvalidDirectoryErrorCode,
  type MigrateOptions,
  MigrationException,
  type PoolStats,
  type SystemInfo,
  Settings,
  type SharedState,
  DownloadUpdateTask,
  NetworkStatus,
  ReportPreview,
} from '@xmcl/runtime-api'
import { readFile, readdir, stat, pathExists, unlink, truncate } from 'fs-extra'
import os, { freemem, totalmem } from 'os'
import { statfs } from 'fs/promises'
import { join, resolve, basename } from 'path'
import { open, readAllEntries, readEntry } from '@xmcl/unzip'
import { Inject, LauncherAppKey, kGameDataPath } from '~/app'
import {
  endRendererAction,
  getActiveRendererActionId,
  getActiveTraceparent,
  kClientToken,
  kGFW,
  kLogRoot,
  launcherSessionId,
  setActiveSpanAttributes,
} from '~/infra'
import { kNetworkInterface } from '~/network'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { kSettings } from '~/settings'
import { type Tasks, kTasks } from '~/infra'
import { validateDirectory } from '~/util/validate'
import { writeZipFile } from '../util/zip'
import { LauncherApp } from '../app/LauncherApp'
import { HAS_DEV_SERVER } from '../constant'
import { ZipFile } from 'yazl'
import { getTracker } from '~/util/taskHelper'
import { addSteamShortcutToVdf } from './steamShortcut'
import { writeFile as writeAtomically } from 'atomically'
import { anonymizeIpAddresses } from '~/util/ipAnonymizer'

@ExposeServiceKey(BaseServiceKey)
export class BaseService extends AbstractService implements IBaseService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTasks) private tasks: Tasks,
  ) {
    super(app, async () => {
      this.checkUpdate()
    })
  }

  async getDesktopDirectory(): Promise<string> {
    return this.app.host.getPath('desktop')
  }

  destroyPool(origin: string) {
    return this.app.registry.get(kNetworkInterface).then((s) => s.destroyPool(origin))
  }

  getNetworkStatus(): Promise<NetworkStatus> {
    return this.app.registry.get(kNetworkInterface).then((s) => s.getNetworkStatus())
  }

  async getSessionId() {
    return launcherSessionId
  }

  getDeviceId() {
    return this.app.registry.get(kClientToken)
  }

  getGameDataDirectory(): Promise<string> {
    return this.app.registry.get(kGameDataPath).then((f) => f())
  }

  async getSettings(): Promise<SharedState<Settings>> {
    return this.app.registry.get(kSettings)
  }

  async getEnvironment(): Promise<Environment> {
    const gfw = await this.app.registry.get(kGFW)
    await gfw.signal
    return {
      os: this.app.platform.os,
      arch: this.app.platform.arch,
      osRelease: this.app.platform.osRelease,
      env: this.app.env,
      version: this.app.version,
      build: this.app.build,
      region: this.app.systemLocale,
      gfw: gfw.inside,
      gpu: await this.app.host
        .getGPUInfo('basic')
        .then(
          (info) =>
            info.gpuDevice?.some(
              (g) => g.vendorId === 4318 || g.vendorId === 4098 || g.vendorId === 4203,
            ) ?? false,
        ),
      steamDeck:
        process.env.STEAM_DECK === '1' ||
        process.env.USER === 'deck' ||
        (process.platform === 'linux' && os.release().toLowerCase().includes('steamdeck')),
    }
  }

  async makeDesktopShortcut() {
    const desktopDir = this.app.host.getPath('desktop')
    if (process.platform === 'win32') {
      const shortcutPath = join(desktopDir, 'XMCL.lnk')
      return this.app.shell.createShortcut(shortcutPath, {
        target: this.app.host.getPath('exe'),
        args: process.execArgv.join(' '),
        cwd: process.cwd(),
      })
    }
    return false
  }

  async addSteamShortcut(): Promise<boolean> {
    // Find Steam userdata directory
    const steamPaths: string[] = []
    if (process.platform === 'win32') {
      if (process.env['PROGRAMFILES(X86)']) {
        steamPaths.push(join(process.env['PROGRAMFILES(X86)'], 'Steam'))
      }
      if (process.env.PROGRAMFILES) {
        steamPaths.push(join(process.env.PROGRAMFILES, 'Steam'))
      }
      steamPaths.push('C:\\Program Files (x86)\\Steam')
      steamPaths.push('C:\\Program Files\\Steam')
    } else if (process.platform === 'darwin') {
      steamPaths.push(join(os.homedir(), 'Library/Application Support/Steam'))
    } else {
      // Linux
      steamPaths.push(join(os.homedir(), '.steam/steam'))
      steamPaths.push(join(os.homedir(), '.local/share/Steam'))
    }

    const exePath = this.app.host.getPath('exe')
    const startDir = resolve(exePath, '..')

    let shortcutAdded = false
    let shortcutError: unknown

    for (const steamPath of steamPaths) {
      const userdataPath = join(steamPath, 'userdata')
      if (await pathExists(userdataPath)) {
        try {
          const userDirs = await readdir(userdataPath)
          for (const userDir of userDirs) {
            if (/^\d+$/.test(userDir)) {
              const configDir = join(userdataPath, userDir, 'config')
              if (await pathExists(configDir)) {
                const shortcutsVdfPath = join(configDir, 'shortcuts.vdf')
                const existing = (await pathExists(shortcutsVdfPath))
                  ? await readFile(shortcutsVdfPath)
                  : Buffer.alloc(0)
                const updated = addSteamShortcutToVdf(existing, {
                  executable: `"${exePath}"`,
                  startDir: `"${startDir}"`,
                  icon: exePath,
                })

                if (updated) {
                  await writeAtomically(shortcutsVdfPath, updated)
                  shortcutAdded = true
                }
              }
            }
          }
        } catch (err) {
          this.logger.warn(`Failed to add Steam shortcut for ${steamPath}`)
          this.logger.warn(err)
          shortcutError ??= err
        }
      }
    }

    if (!shortcutAdded && shortcutError) {
      throw shortcutError
    }

    return shortcutAdded
  }

  async handleUrl(url: string) {
    this.emit('url-drop', url)
    const response = await this.app.protocol.handle({ url })
    if (response.status >= 200 && response.status < 300) {
      return true
    }
    return false
  }

  /**
   * A electron provided function to show item in directory
   * @param item The path to the file item
   */
  showItemInDirectory(item: string) {
    this.app.shell.showItemInFolder(item)
  }

  /**
   * A safe method that only open directory. If the `path` is a file, it won't execute it.
   * @param path The directory path.
   */
  openDirectory(path: string) {
    return this.app.shell.openDirectory(path)
  }

  /**
   * Quit and install the update once the update is ready
   */
  @Singleton()
  async quitAndInstall() {
    const settings = await this.getSettings()
    if (settings.updateStatus === 'ready' && settings.updateInfo) {
      const actionId = getActiveRendererActionId()
      if (actionId) {
        endRendererAction({
          id: actionId,
          outcome: 'success',
          attributes: { 'update.phase': 'apply' },
        })
      }
      await this.app.updater.installUpdateAndQuit(settings.updateInfo)
    } else {
      this.warn('There is no update available!')
    }
  }

  /**
   * Check launcher update.
   */
  @Singleton()
  async checkUpdate() {
    if (HAS_DEV_SERVER) return
    try {
      const settings = await this.getSettings()
      this.log('Check update')
      const info = await this.app.updater.checkUpdateTask()
      setActiveSpanAttributes({
        'update.available': info.newUpdate,
        'update.phase': 'check',
      })
      settings.updateInfoSet(info)
      if (info.newUpdate) {
        settings.updateStatusSet('pending')
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'Error') {
        if (e.message === 'No update info found') {
          return
        }
        e.name = 'CheckUpdateError'
      }
      throw e
    }
  }

  /**
   * Download the update if there is available update
   */
  @Singleton()
  async downloadUpdate() {
    const settings = await this.getSettings()
    if (!settings.updateInfo) {
      throw new Error("Cannot download update if we don't check the version update!")
    }
    const updateInfo = settings.updateInfo
    setActiveSpanAttributes({
      'update.operation': updateInfo.operation,
      'update.phase': 'download',
    })

    this.log(`Start to download update: ${updateInfo.name} operation=${updateInfo.operation}`)
    const task = this.tasks.create<DownloadUpdateTask>({
      type: 'downloaUpdate',
      key: `download-update-${updateInfo.operation}`,
      operation: updateInfo.operation as 'autoupdater' | 'asar' | 'appx' | 'manual',
      version: updateInfo.name,
    })
    await task.wrap(
      this.app.updater.downloadUpdate(updateInfo, {
        tracker: getTracker(task),
      }),
    )
    settings.updateStatusSet('ready')
  }

  quit() {
    return this.app.quit()
  }

  exit(code?: number) {
    this.app.exit(code)
  }

  async reportItNow(options: { destination: string; anonymizeIp?: boolean }): Promise<void> {
    const zipFile = new ZipFile()
    const logsDir = await this.app.registry.get(kLogRoot)
    const files = await readdir(logsDir)
    const anonymize = options.anonymizeIp !== false

    for (const file of files) {
      const filePath = join(logsDir, file)
      const fStat = await stat(filePath).catch(() => undefined)
      if (fStat?.isFile()) {
        const content = await readFile(filePath).catch(() => undefined)
        if (content) {
          if (file.endsWith('.zip')) {
            if (anonymize) {
              try {
                const innerZip = await open(filePath)
                const entries = await readAllEntries(innerZip)
                const rezipped = new ZipFile()
                for (const entry of entries) {
                  const buf = await readEntry(innerZip, entry)
                  if (entry.fileName.endsWith('.log') || entry.fileName.endsWith('.txt') || entry.fileName.endsWith('.json')) {
                    try {
                      const text = buf.toString('utf-8')
                      const sanitized = await anonymizeIpAddresses(text)
                      rezipped.addBuffer(Buffer.from(sanitized, 'utf-8'), entry.fileName)
                    } catch {
                      rezipped.addBuffer(buf, entry.fileName)
                    }
                  } else {
                    rezipped.addBuffer(buf, entry.fileName)
                  }
                }
                const chunks: Buffer[] = []
                await new Promise<void>((res, rej) => {
                  rezipped.outputStream.on('data', (c) => chunks.push(c))
                  rezipped.outputStream.on('end', () => res())
                  rezipped.outputStream.on('error', rej)
                  rezipped.end()
                })
                zipFile.addBuffer(Buffer.concat(chunks), join('logs', file))
              } catch {
                zipFile.addBuffer(content, join('logs', file))
              }
            } else {
              zipFile.addBuffer(content, join('logs', file))
            }
          } else if (anonymize && (file.endsWith('.log') || file.endsWith('.txt') || file.endsWith('.json'))) {
            try {
              const text = content.toString('utf-8')
              const sanitized = await anonymizeIpAddresses(text)
              zipFile.addBuffer(Buffer.from(sanitized, 'utf-8'), join('logs', file))
            } catch {
              zipFile.addBuffer(content, join('logs', file))
            }
          } else {
            zipFile.addBuffer(content, join('logs', file))
          }
        }
      }
    }

    const sessionId = await this.app.registry.get(kClientToken)

    zipFile.addBuffer(
      Buffer.from(
        JSON.stringify({
          sessionId,
          platform: os.platform(),
          arch: os.arch(),
          version: os.version(),
          release: os.release(),
          type: os.type(),
        }),
      ),
      'device.json',
    )
    await writeZipFile(zipFile, options.destination)

    this.showItemInDirectory(options.destination)
  }

  async getReportPreview(options?: { anonymizeIp?: boolean }): Promise<ReportPreview> {
    const logsDir = await this.app.registry.get(kLogRoot)
    const files = await readdir(logsDir).catch(() => [] as string[])
    const anonymize = options?.anonymizeIp !== false
    const previewFiles: ReportPreview['files'] = []

    for (const file of files) {
      const filePath = join(logsDir, file)
      const fStat = await stat(filePath).catch(() => undefined)
      if (fStat?.isFile()) {
        if (file.endsWith('.zip')) {
          try {
            const innerZip = await open(filePath)
            const entries = await readAllEntries(innerZip)
            const match = file.match(/(\d{4}-\d{2}-\d{2})T(\d{2})[!:](\d{2})[!:](\d{2})/)
            const dateStr = match ? match[1] : new Date(fStat.mtimeMs).toISOString().split('T')[0]
            const timestamp = match ? new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`).getTime() : fStat.mtimeMs

            for (const entry of entries) {
              if (entry.fileName.endsWith('.log') || entry.fileName.endsWith('.txt') || entry.fileName.endsWith('.json')) {
                const buf = await readEntry(innerZip, entry)
                let text = buf.toString('utf-8')
                if (text.length > 256 * 1024) {
                  text = '... [truncated, showing last 256KB]\n' + text.slice(-256 * 1024)
                }
                if (anonymize) {
                  try {
                    text = await anonymizeIpAddresses(text)
                  } catch {}
                }
                previewFiles.push({
                  name: `${file} (${basename(entry.fileName)})`,
                  size: entry.uncompressedSize,
                  content: text,
                  date: dateStr,
                  timestamp,
                  category: 'archive',
                })
              }
            }
          } catch {}
        } else {
          const content = await readFile(filePath).catch(() => undefined)
          if (content) {
            let text = content.toString('utf-8')
            if (text.length > 256 * 1024) {
              text = '... [truncated, showing last 256KB]\n' + text.slice(-256 * 1024)
            }
            if (anonymize && (file.endsWith('.log') || file.endsWith('.txt') || file.endsWith('.json'))) {
              try {
                text = await anonymizeIpAddresses(text)
              } catch {}
            }
            const dateStr = new Date(fStat.mtimeMs).toISOString().split('T')[0]
            previewFiles.push({
              name: file,
              size: fStat.size,
              content: text,
              date: dateStr,
              timestamp: fStat.mtimeMs,
              category: 'current',
            })
          }
        }
      }
    }

    const sessionId = await this.app.registry.get(kClientToken)

    return {
      timestamp: Date.now(),
      device: {
        sessionId,
        platform: os.platform(),
        arch: os.arch(),
        version: os.version(),
        release: os.release(),
        type: os.type(),
      },
      files: previewFiles,
    }
  }

  async clearLogs(): Promise<void> {
    const logsDir = await this.app.registry.get(kLogRoot)
    const files = await readdir(logsDir).catch(() => [] as string[])
    for (const file of files) {
      const filePath = join(logsDir, file)
      try {
        await unlink(filePath).catch(async () => {
          await truncate(filePath, 0).catch(() => {})
        })
      } catch {}
    }
  }

  async migrate(options: MigrateOptions) {
    const destination = options.destination
    const code = await validateDirectory(this.app.platform, destination)
    if (code) {
      throw new MigrationException({
        type: 'migrationInvalidDestiantion',
        code,
        destination,
      })
    }

    // Nothing to do if the destination is already the current root. Without
    // this guard the launcher would relaunch and re-migrate into itself.
    const current = await this.app.registry.get(kGameDataPath).then((f) => f())
    if (resolve(current) === resolve(destination)) {
      return
    }

    // Drop any stale migration arguments left in argv by a previous migration.
    // The relaunched process reads the migration target from argv, so a
    // leftover flag would otherwise win over the new destination and make the
    // migration silently do nothing.
    const argv = process.argv.slice(1)
    const cleaned: string[] = []
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--migrate' || argv[i] === '--migration-traceparent') {
        i++ // also skip its value
        continue
      }
      cleaned.push(argv[i])
    }

    const actionId = getActiveRendererActionId()
    const traceparent = getActiveTraceparent()
    if (actionId) {
      endRendererAction({
        id: actionId,
        outcome: 'success',
        attributes: { 'migration.phase': 'requested' },
      })
    }
    this.app.relaunch([
      ...cleaned,
      '--migrate',
      destination,
      ...(traceparent ? ['--migration-traceparent', traceparent] : []),
    ])
    this.app.quit()
  }

  async validateDataDictionary(path: string): Promise<InvalidDirectoryErrorCode> {
    return await validateDirectory(this.app.platform, path)
  }

  getMemoryStatus(): Promise<{ total: number; free: number }> {
    return Promise.resolve({
      total: totalmem(),
      free: freemem(),
    })
  }

  async getSystemInfo(diskPath?: string): Promise<SystemInfo> {
    const cpus = os.cpus()
    const [gpuInfo, diskInfo] = await Promise.all([
      this.app.host.getGPUInfo('complete').catch(() => ({ gpuDevice: [] })),
      diskPath ? statfs(diskPath).catch(() => undefined) : undefined,
    ])
    return {
      operatingSystem: {
        name: os.type(),
        platform: this.app.platform.os,
        release: this.app.platform.osRelease,
        arch: this.app.platform.arch,
      },
      cpu: {
        model: cpus[0]?.model.trim() ?? 'unknown',
        logicalCores: cpus.length,
        speedMHz: cpus[0]?.speed ?? 0,
      },
      memory: {
        totalBytes: totalmem(),
        freeBytes: freemem(),
      },
      disk: diskInfo
        ? {
            totalBytes: diskInfo.blocks * diskInfo.bsize,
            freeBytes: diskInfo.bavail * diskInfo.bsize,
          }
        : undefined,
      gpus: (gpuInfo.gpuDevice ?? []).map((gpu) => ({
        active: gpu.active,
        vendorId: gpu.vendorId,
        deviceId: gpu.deviceId,
        name: gpu.deviceString,
        driverVendor: gpu.driverVendor,
        driverVersion: gpu.driverVersion,
      })),
    }
  }
}
