import { type AddInstanceServerOptions, InstanceServerInfoServiceKey, type RemoveInstanceServerOptions, ServerInfoState, type UpdateInstanceServerOptions, getServerInfoKey, type InstanceServerInfoService as IInstanceServerInfoService, SharedState } from '@xmcl/runtime-api'
import { readServerInfo, writeServerInfo, ServerInfo } from '@xmcl/game-data'
import { FSWatcher } from 'chokidar'
import { ensureDir, readFile, writeFile } from 'fs-extra'
import { basename, dirname, join } from 'path'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { exists, hardLinkFiles, isHardLinked, unHardLinkFiles } from '../util/fs'

@ExposeServiceKey(InstanceServerInfoServiceKey)
export class InstanceServerInfoService extends AbstractService implements IInstanceServerInfoService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
  }

  async isLinked(instancePath: string): Promise<boolean> {
    const root = this.getPath('servers.dat')
    const instanceDat = join(instancePath, 'servers.dat')

    return isHardLinked(root, instanceDat)
  }

  async link(instancePath: string): Promise<void> {
    const root = this.getPath('servers.dat')
    const instanceDat = join(instancePath, 'servers.dat')

    await hardLinkFiles(root, instanceDat)
  }

  async unlink(instancePath: string): Promise<void> {
    const root = this.getPath('servers.dat')
    const instanceDat = join(instancePath, 'servers.dat')

    return unHardLinkFiles(root, instanceDat)
  }

  async addServer({ instancePath, name, host, port, icon, acceptTextures }: AddInstanceServerOptions): Promise<void> {
    this.log(`addServer called: ${JSON.stringify({ instancePath, name, host, port, hasIcon: !!icon, acceptTextures })}`)
    const infos = await this.read(instancePath)
    const built = buildServerInfo({ name: name ?? host, host, port, icon, acceptTextures })
    this.log(`Built server entry: ${JSON.stringify({ name: built.name, ip: built.ip, ownKeys: Object.keys(built) })}`)
    infos.push(built)
    await this.write(instancePath, infos)
    await this.pushState(instancePath, infos)
  }

  async updateServer({ instancePath, host, port, name, update }: UpdateInstanceServerOptions): Promise<void> {
    const infos = await this.read(instancePath)
    const idx = findServerIndex(infos, host, port, name)
    if (idx < 0) return
    const target = infos[idx]
    const nextIp = update.host !== undefined || update.port !== undefined
      ? composeIp(update.host ?? splitIp(target.ip).host, update.port !== undefined ? update.port : splitIp(target.ip).port)
      : target.ip
    infos[idx] = buildServerInfo({
      name: update.name ?? target.name,
      ip: nextIp,
      icon: update.icon ?? target.icon,
      acceptTextures: (update.acceptTextures ?? target.acceptTextures) as 0 | 1,
    })
    await this.write(instancePath, infos)
    await this.pushState(instancePath, infos)
  }

  async removeServer({ instancePath, host, port, name, index }: RemoveInstanceServerOptions): Promise<void> {
    this.log(`removeServer called: ${JSON.stringify({ instancePath, host, port, name, index })}`)
    const infos = await this.read(instancePath)
    const idx = typeof index === 'number' && index >= 0 && index < infos.length
      ? index
      : findServerIndex(infos, host, port, name)
    this.log(`removeServer matched index: ${idx}, rows: ${JSON.stringify(infos.map(i => ({ name: i.name, ip: i.ip })))}`)
    if (idx < 0) return
    infos.splice(idx, 1)
    await this.write(instancePath, infos)
    await this.pushState(instancePath, infos)
  }

  private async read(instancePath: string): Promise<ServerInfo[]> {
    const serversPath = join(instancePath, 'servers.dat')
    if (!(await exists(serversPath))) {
      this.log(`servers.dat does not exist at ${serversPath}`)
      return []
    }
    try {
      const buf = await readFile(serversPath)
      const infos = await readServerInfo(buf)
      this.log(`Loaded ${infos.length} server(s) from ${serversPath}: ${JSON.stringify(infos.map(i => ({ name: i.name, ip: i.ip })))}`)
      return infos
    } catch (e) {
      this.warn(`Failed to parse servers.dat at ${serversPath}: ${(e as Error)?.message}`)
      return []
    }
  }

  private async write(instancePath: string, infos: ServerInfo[]): Promise<void> {
    const serversPath = join(instancePath, 'servers.dat')
    await ensureDir(dirname(serversPath))
    const buf = await writeServerInfo(infos)
    await writeFile(serversPath, buf)
  }

  /**
   * Explicitly push a new `serverInfos` snapshot to any watching renderer.
   * Chokidar fires on file changes but the renderer should not have to wait
   * for the OS-level event to round-trip after we just wrote the file
   * ourselves. The watcher remains the source of truth for external edits
   * (e.g. Minecraft itself updating `servers.dat`).
   */
  private async pushState(instancePath: string, infos: ServerInfo[]): Promise<void> {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    const state = stateManager.get<SharedState<ServerInfoState>>(getServerInfoKey(instancePath))
    state?.instanceServerInfos(infos)
  }

  async watch(path: string) {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(getServerInfoKey(path), async ({ defineAsyncOperation }) => {
      const state = new ServerInfoState()

      const update = defineAsyncOperation(async () => {
        try {
          const infos = await this.read(path)
          state.instanceServerInfos(infos)
        } catch (e) {
          this.warn(`Failed to load servers.dat for ${path}: ${(e as Error)?.message}`)
        }
      })

      // Watch the instance directory so we still catch the first-time
      // creation of `servers.dat` (chokidar's `add('file')` against a path
      // that doesn't yet exist is not reliable across platforms).
      const watcher = new FSWatcher({
        cwd: path,
        ignorePermissionErrors: true,
        ignoreInitial: true,
        depth: 0,
      })
      watcher.on('all', (_event, file) => {
        if (basename(file) === 'servers.dat') {
          update()
        }
      }).add('.')

      await update()

      return [state, () => {
        watcher.close()
      }, update]
    })
  }
}

function buildServerInfo(input: { name: string; host?: string; port?: number; ip?: string; icon?: string; acceptTextures?: 0 | 1 }): ServerInfo {
  const info = new ServerInfo()
  info.name = input.name ?? ''
  info.ip = input.ip ?? composeIp(input.host ?? '', input.port)
  info.icon = input.icon ?? ''
  info.acceptTextures = input.acceptTextures ?? 0
  return info
}

function composeIp(host: string, port?: number): string {
  if (!host) return ''
  if (!port || port === 25565) return host
  return `${host}:${port}`
}

function splitIp(ip: string): { host: string; port?: number } {
  if (!ip) return { host: '' }
  const v6 = /^\[([^\]]+)\](?::(\d+))?$/.exec(ip)
  if (v6) return { host: v6[1], port: v6[2] ? Number(v6[2]) : undefined }
  const idx = ip.lastIndexOf(':')
  if (idx >= 0 && /^\d+$/.test(ip.slice(idx + 1))) {
    return { host: ip.slice(0, idx), port: Number(ip.slice(idx + 1)) }
  }
  return { host: ip }
}

function findServerIndex(infos: ServerInfo[], host: string, port: number | undefined, name?: string): number {
  const wantedPort = port ?? 25565
  return infos.findIndex((s) => {
    const parsed = splitIp(s.ip)
    if (parsed.host !== host) return false
    if ((parsed.port ?? 25565) !== wantedPort) return false
    if (name !== undefined && s.name !== name) return false
    return true
  })
}
