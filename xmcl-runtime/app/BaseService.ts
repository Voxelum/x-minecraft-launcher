import {
  BaseServiceKey,
  type Environment,
  type BaseService as IBaseService,
  type InvalidDirectoryErrorCode,
  type MigrateOptions,
  MigrationException,
  type PoolStats,
  Settings,
  type SharedState,
  DownloadUpdateTask,
  NetworkStatus,
} from '@xmcl/runtime-api'
import { readFile, readdir, stat, pathExists, writeFile } from 'fs-extra'
import os, { freemem, totalmem } from 'os'
import { join, resolve } from 'path'
import { Inject, LauncherAppKey, kGameDataPath } from '~/app'
import { kClientToken, kGFW, kLogRoot } from '~/infra'
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

  getSessionId() {
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
      steamDeck: process.env.STEAM_DECK === '1' || process.env.USER === 'deck' || (process.platform === 'linux' && os.release().toLowerCase().includes('steamdeck')),
    }
  }

  async makeDesktopShortcut() {
    const desktopDir = this.app.host.getPath('desktop')
    if (process.platform === 'win32') {
      const shortcutPath = join(desktopDir, 'X Minecraft Launcher.lnk')
      return this.app.shell.createShortcut(shortcutPath, {
        target: this.app.host.getPath('exe'),
        args: process.execArgv.join(' '),
        cwd: process.cwd(),
      })
    }
    return false
  }

  async addSteamShortcut(): Promise<boolean> {
    const parseBinaryVdf = (buffer: Buffer): any => {
      let offset = 0
      const readString = (): string => {
        const start = offset
        while (offset < buffer.length && buffer[offset] !== 0) {
          offset++
        }
        const str = buffer.toString('utf8', start, offset)
        offset++ // skip null terminator
        return str
      }

      const parseMap = (): Record<string, any> => {
        const obj: Record<string, any> = {}
        while (offset < buffer.length) {
          const type = buffer[offset]
          if (type === 0x08) {
            offset++ // skip 0x08
            break
          }
          offset++ // skip type byte
          const key = readString()
          if (type === 0x00) {
            obj[key] = parseMap()
          } else if (type === 0x01) {
            obj[key] = readString()
          } else if (type === 0x02) {
            obj[key] = buffer.readInt32LE(offset)
            offset += 4
          }
        }
        return obj
      }

      if (buffer.length === 0) return {}
      const type = buffer[0]
      if (type !== 0x00) return {}
      offset++
      const rootKey = readString()
      const rootValue = parseMap()
      return { [rootKey]: rootValue }
    }

    const serializeBinaryVdf = (obj: Record<string, any>): Buffer => {
      const chunks: Buffer[] = []
      const writeString = (str: string) => {
        chunks.push(Buffer.from(str, 'utf8'))
        chunks.push(Buffer.from([0]))
      }

      const serializeMap = (map: Record<string, any>) => {
        for (const [key, value] of Object.entries(map)) {
          if (value === null || value === undefined) continue
          if (typeof value === 'object') {
            chunks.push(Buffer.from([0x00]))
            writeString(key)
            serializeMap(value)
          } else if (typeof value === 'string') {
            chunks.push(Buffer.from([0x01]))
            writeString(key)
            writeString(value)
          } else if (typeof value === 'number') {
            chunks.push(Buffer.from([0x02]))
            writeString(key)
            const buf = Buffer.alloc(4)
            buf.writeInt32LE(value, 0)
            chunks.push(buf)
          }
        }
        chunks.push(Buffer.from([0x08]))
      }

      const rootKeys = Object.keys(obj)
      if (rootKeys.length > 0) {
        const rootKey = rootKeys[0]
        chunks.push(Buffer.from([0x00]))
        writeString(rootKey)
        serializeMap(obj[rootKey])
      }
      return Buffer.concat(chunks)
    }

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
                let data: any = { shortcuts: {} }

                if (await pathExists(shortcutsVdfPath)) {
                  try {
                    const buf = await readFile(shortcutsVdfPath)
                    data = parseBinaryVdf(buf)
                    if (!data || !data.shortcuts) {
                      data = { shortcuts: {} }
                    }
                  } catch (e) {
                    data = { shortcuts: {} }
                  }
                }

                const existingList = Object.values(data.shortcuts)
                const alreadyExists = existingList.some(
                  (s: any) => s && (s.AppName === 'X Minecraft Launcher' || s.AppName === 'XMCL')
                )

                if (!alreadyExists) {
                  const nextIdx = Object.keys(data.shortcuts).length.toString()
                  data.shortcuts[nextIdx] = {
                    AppName: 'X Minecraft Launcher',
                    Exe: exePath,
                    StartDir: `"${startDir}"`,
                    icon: exePath,
                    ShortcutPath: '',
                    LaunchOptions: '',
                    IsHidden: 0,
                    AllowDesktopConfig: 1,
                    AllowOverlay: 1,
                    OpenVR: 0,
                    Devkit: 0,
                    DevkitGameID: '',
                    DevkitOverrideAppID: 0,
                    LastPlayTime: 0,
                    FlatpakAppID: '',
                    tags: {
                      '0': 'Launcher'
                    }
                  }

                  const updatedBuf = serializeBinaryVdf(data)
                  await writeFile(shortcutsVdfPath, updatedBuf)
                  shortcutAdded = true
                }
              }
            }
          }
        } catch (err) {
          // ignore error for individual folders
        }
      }
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

    this.log(`Start to download update: ${updateInfo.name} operation=${updateInfo.operation}`)
    const task = this.tasks.create<DownloadUpdateTask>({
      type: 'downloaUpdate',
      key: `download-update-${updateInfo.operation}`,
      operation: updateInfo.operation as 'autoupdater' | 'asar' | 'appx' | 'manual',
      version: updateInfo.name,
    })
    await task.wrap(this.app.updater.downloadUpdate(updateInfo, {
      tracker: getTracker(task),
    }))
    settings.updateStatusSet('ready')
  }

  quit() {
    return this.app.quit()
  }

  exit(code?: number) {
    this.app.exit(code)
  }

  async reportItNow(options: { destination: string }): Promise<void> {
    const zipFile = new ZipFile()
    const logsDir = await this.app.registry.get(kLogRoot)
    const files = await readdir(logsDir)

    for (const file of files) {
      const filePath = join(logsDir, file)
      const fStat = await stat(filePath).catch(() => undefined)
      if (fStat?.isFile()) {
        // Read the log into a buffer first. Log files may still be written to
        // while we export, and yazl's addFile defers reading until the zip is
        // finalized. If the file size changes between stat and read, the entry
        // becomes corrupt. Snapshotting via addBuffer captures size + content
        // atomically and avoids producing a broken zip.
        const content = await readFile(filePath).catch(() => undefined)
        if (content) {
          zipFile.addBuffer(content, join('logs', file))
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

    // Drop any stale `--migrate <path>` left in argv by a previous migration.
    // The relaunched process reads the migration target from argv, so a
    // leftover flag would otherwise win over the new destination and make the
    // migration silently do nothing.
    const argv = process.argv.slice(1)
    const cleaned: string[] = []
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--migrate') {
        i++ // also skip its value
        continue
      }
      cleaned.push(argv[i])
    }

    this.app.relaunch([...cleaned, '--migrate', destination])
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
}
