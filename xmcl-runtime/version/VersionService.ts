import { LibraryInfo, ResolvedVersion, Version, VersionParseError } from '@xmcl/core'
import { VersionService as IVersionService, LocalVersionHeader, LocalVersions, MutableState, ResolvedServerVersion, VersionServiceKey, filterForgeVersion, filterOptifineVersion, findLabyModVersion, findNeoForgedVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary, isQuiltLibrary } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { FSWatcher, existsSync } from 'fs'
import { ensureDir, readFile, readFileSync, readdir, rm } from 'fs-extra'
import watch from 'node-watch'
import { basename, dirname, join, relative, sep } from 'path'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { ResourceWorker, kResourceWorker } from '~/resource'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { TaskFn, kTaskExecutor } from '~/task'
import { LauncherApp } from '../app/LauncherApp'
import { isDirectory, missing, readdirEnsured } from '../util/fs'
import { isNonnull } from '../util/object'
import { InstallProfile } from '@xmcl/installer'

export interface VersionResolver {
  (version: ResolvedVersion): Promise<void> | void
}

/**
 * The local version service maintains the installed versions on disk
 */
@ExposeServiceKey(VersionServiceKey)
export class VersionService extends StatefulService<LocalVersions> implements IVersionService {
  private watcher: FSWatcher | undefined
  private resolvers: VersionResolver[] = []

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(kResourceWorker) private worker: ResourceWorker,
  ) {
    super(app, () => store.registerStatic(new LocalVersions(), VersionServiceKey), async () => {
      await this.refreshVersions()
      const versions = this.getPath('versions')
      await ensureDir(versions)
      this.watcher = watch(versions, {
        encoding: 'utf-8',
        recursive: true,
        filter(file, skip) {
          const relativePath = relative(versions, file)
          const splitted = relativePath.split(sep)
          if (splitted.length === 1) {
            // watch but no update
            return false
          }
          if (splitted.length > 2) {
            // ignore depth
            return skip
          }
          const versionFile = splitted[1]
          if (versionFile.endsWith('.json')) {
            return true
          }
          // skip other
          return skip
        },
      })
      this.watcher.on('change', (event, file) => {
        const id = basename(dirname(file as string))
        if (event === 'update') {
          if ((file as string).endsWith('server.json')) {
            this.refreshServerVersion(id)
          } else {
            this.refreshVersion(id)
          }
        } else if (event === 'remove') {
          if ((file as string).endsWith('server.json')) {
            this.refreshServerVersion(file as string)
          } else {
            this.refreshVersion(id)
          }
          // this.state.localVersionRemove(basename(dirname(file as string)))
        }
      })
    })
    this.app.registryDisposer(async () => {
      this.watcher?.close()
    })
  }

  registerResolver(resolver: VersionResolver) {
    this.resolvers.push(resolver)
  }

  async getLocalVersions(): Promise<MutableState<LocalVersions>> {
    return this.state
  }

  /**
   * Scan .minecraft folder and copy libraries/assets/versions files from it to launcher managed place.
   *
   * This will not replace the existed files
   */
  async migrateMinecraftFile(mcPath: string = this.getMinecraftPath()) {
    if (await missing(mcPath)) return
    const root = this.getPath()
    if (mcPath === root) return
    this.log(`Try to migrate the version from ${mcPath}`)
    const copyTask = task('cloneMinecraft', async () => {
      await this.worker.copyPassively([
        { src: join(mcPath, 'libraries'), dest: join(root, 'libraries') },
        { src: join(mcPath, 'assets'), dest: join(root, 'assets') },
        { src: join(mcPath, 'versions'), dest: join(root, 'versions') },
      ])
    })
    Reflect.set(copyTask, '_from', mcPath)
    await this.submit(copyTask)
  }

  private getHeader(ver: ResolvedVersion): LocalVersionHeader {
    return {
      id: ver.id,
      path: ver.pathChain[0],
      inheritances: ver.inheritances,
      minecraft: ver.minecraftVersion,
      neoForged: findNeoForgedVersion(ver.minecraftVersion, ver),
      forge: filterForgeVersion(ver.libraries.find(isForgeLibrary)?.version ?? ''),
      fabric: ver.libraries.find(isFabricLoaderLibrary)?.version ?? '',
      optifine: filterOptifineVersion(ver.libraries.find(isOptifineLibrary)?.version ?? ''),
      quilt: ver.libraries.find(isQuiltLibrary)?.version ?? '',
      labyMod: findLabyModVersion(ver),
      liteloader: '',
    }
  }

  public async resolveLocalVersion(versionId: string, root: string = this.getPath()): Promise<ResolvedVersion> {
    try {
      const resolved = await Version.parse(root, versionId)
      for (const resolver of this.resolvers) {
        try {
          await resolver(resolved)
        } catch (e) {
          this.warn(`An error occurred during post resolve version ${versionId}`)
          if (e instanceof Error) {
            this.error(e)
          }
        }
      }
      return Object.freeze(resolved)
    } catch (e) {
      if (e instanceof Error && e.name === 'MissingVersionJson') {
        Object.assign(e, {
          files: await readdir(join(root, 'versions', versionId)).catch(() => []),
        })
      }
      throw e
    }
  }

  public getLocalVersion(versionId: string) {
    return this.state.local.find(v => v.id === versionId)
  }

  /**
   * Refresh a version in the version folder.
   * @param versionFolder The version folder name. It must existed under the `versions` folder.
   */
  @Singleton(v => v)
  async refreshVersion(versionFolder: string) {
    try {
      const version = await this.resolveLocalVersion(versionFolder)
      this.log(`Refresh local version ${versionFolder}`)
      this.state.localVersionAdd(this.getHeader(version))
    } catch (e) {
      this.state.localVersionRemove(versionFolder)
      const err = e as VersionParseError
      if ('err' in err && err.err === 'MissingVersionJson') {
        this.warn(`Missing version json for ${versionFolder}`)
      } else {
        this.warn(`An error occurred during refresh local version ${versionFolder}`)
        this.warn(e)
      }
    }
  }

  async resolveServerVersion(id: string): Promise<ResolvedServerVersion> {
    const filePath = this.getPath('versions', id, 'server.json')
    const content = await readFile(filePath, 'utf-8')
    const profile = JSON.parse(content) as Version
    if (!profile._minecraftVersion) {
      throw new Error('Missing minecraft version in server profile')
    }
    return {
      id,
      minecraftVersion: profile._minecraftVersion,
      mainClass: profile.mainClass,
      jar: profile.jar,
      libraries: profile.libraries.map(l => Version.resolveLibrary(l)).filter(isNonnull),
      arguments: profile.arguments as any,
    }
  }

  async refreshServerVersion(id: string) {
    try {
      const filePath = this.getPath('versions', id, 'server.json')
      const content = await readFile(filePath, 'utf-8')
      const profile = JSON.parse(content) as Version
      if (profile._minecraftVersion) {
        this.state.serverProfileAdd({
          id,
          type: !profile._forgeVersion && !profile._fabricLoaderVersion ? 'vanilla' : profile._forgeVersion ? 'forge' : 'fabric',
          minecraft: profile._minecraftVersion,
          version: profile._forgeVersion ?? profile._fabricLoaderVersion,
        })
      } else {
        this.warn(`Missing minecraft version in ${id}`)
      }
    } catch (e) {
      this.state.serverProfileRemove(id)
    }
  }

  @Singleton()
  async refreshVersions() {
    const dir = this.getPath('versions')
    let files = await readdirEnsured(dir)
    this.log(`Scan ${dir} versions`)

    files = files.filter(f => !f.startsWith('.'))

    const versions: ResolvedVersion[] = (await Promise.all(files.map(async (versionId) => {
      try {
        const realPath = join(dir, versionId)
        if (await isDirectory(realPath)) {
          const version = await this.resolveLocalVersion(versionId)
          this.refreshServerVersion(versionId)
          return version
        }
      } catch (e) {
        const err = e as VersionParseError
        if ('error' in err && err.name === 'MissingVersionJson') {
          this.warn(`Missing version json for ${versionId}`)
        } else {
          this.warn(`An error occurred during load local version ${versionId}`)
          this.warn(e)
        }
      }
    }))).filter(isNonnull)

    if (versions.length !== 0) {
      this.state.localVersions(versions.map(this.getHeader))
      this.log(`Found ${versions.length} local game versions.`)
    } else {
      this.log('No local game version found.')
    }
  }

  async deleteVersion(version: string) {
    const path = this.getPath('versions', version)
    await rm(path, { recursive: true, force: true })
    this.state.localVersions(this.state.local.filter(v => v.id !== version))
  }

  async showVersionsDirectory() {
    const path = this.getPath('versions')
    return this.app.shell.openDirectory(path)
  }

  async showVersionDirectory(version: string) {
    const path = this.getPath('versions', version)
    return this.app.shell.openDirectory(path)
  }
}
