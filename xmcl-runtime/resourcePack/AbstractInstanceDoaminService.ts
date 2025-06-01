import { InstallMarketOptionWithInstance, ResourceDomain, ResourceState } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { ensureDir, mkdir, readdir, remove, rename, stat, unlink } from 'fs-extra'
import { basename, join } from 'path'
import { LauncherApp, PathResolver } from '~/app'
import { InstanceService } from '~/instance'
import { kMarketProvider } from '~/market'
import { ResourceManager } from '~/resource'
import { AbstractService, ServiceStateManager } from '~/service'
import { AnyError, isSystemError } from '~/util/error'
import { isNotFoundError, linkOrCopyFile } from '../util/fs'
import { isLinked, readdirSafe, tryLink } from '../util/linkResourceFolder'

export abstract class AbstractInstanceDomainService extends AbstractService {
  protected abstract resourceManager: ResourceManager
  protected abstract getPath: PathResolver
  protected abstract instanceService: InstanceService
  protected abstract store: ServiceStateManager
  abstract domain: ResourceDomain

  protected state = new ResourceState()
  protected revalidate = async () => { }

  constructor(
    app: LauncherApp,
  ) {
    super(app, async () => {
      const folder = this.getPath(this.domain)
      await ensureDir(folder)
      const { revalidate } = this.resourceManager.watch(folder, this.domain, (func) => {
        return func()
      }, this.state)

      this.revalidate = revalidate
    })
  }

  async unlink(instancePath: string): Promise<void> {
    const destPath = join(instancePath, this.domain)
    const srcPath = this.getPath(this.domain)

    const linkedStatus = await isLinked(srcPath, destPath)

    const key = `instance-${this.domain}://${instancePath}`

    if (linkedStatus) {
      try {
        await unlink(destPath)
        await mkdir(destPath)

        this.store.get(key)?.revalidate()
      } catch (e) {
        if (isSystemError(e) && e.code === 'EPERM') {
          return
        }
        (e as any).name = 'UnlinkResourceFolderError'
        throw e
      }
    }
  }

  async isLinked(instancePath: string): Promise<boolean> {
    const destPath = join(instancePath, this.domain)
    const srcPath = this.getPath(this.domain)
    const v = await isLinked(srcPath, destPath)
    return !!v
  }

  async link(instancePath: string, force = false): Promise<boolean> {
    if (!instancePath) return false
    const destPath = join(instancePath, this.domain)
    const srcPath = this.getPath(this.domain)
    const key = `instance-${this.domain}://${instancePath}`

    try {
      if (force) {
        const isLinked = await this.isLinked(instancePath)
        if (!isLinked) {
          // Backup the old folder
          try {
            const files = await readdirSafe(destPath)
            if (files.length > 0) {
              const backupDir = join(destPath, '.backup')
              await ensureDir(backupDir)
              for (const f of files) {
                const s = await stat(join(destPath, f))
                if (s.isDirectory()) {
                  // move to backup dir
                  await rename(join(destPath, f), join(backupDir, f))
                }
              }
            }
            await remove(destPath)
          } catch (e) {
            if (e instanceof Error) {
              if (e.name === 'Error') {
                Object.assign(e, { name: 'UnlinkResourceFolderError' })
              }
            }
            throw e
          }
        }
      }
      const isLinked = await tryLink(srcPath, destPath, this, (path) => this.instanceService.isUnderManaged(path))

      this.store.get(key)?.revalidate()

      return isLinked
    } catch (e) {
      this.error(new AnyError('LinkResourceFolderError', `Fail to link ${this.domain} folder under: "${instancePath}"`, { cause: e }))
      return false
    }
  }

  async install(instancePath: string, file: string | string[]) {
    const files = file instanceof Array ? file : [file]
    const result = [] as string[]
    const isLinked = await this.isLinked(instancePath)
    const sharedDir = this.getPath(this.domain)
    for (const file of files) {
      const fileName = basename(file)
      const src = this.getPath(this.domain, fileName)
      const dest = join(instancePath, this.domain, fileName)
      if (dest === src) {
        continue
      }
      if (isLinked && join(sharedDir, fileName) === src) {
        continue
      }
      const fstat = await stat(src).catch(e => {
        if (isNotFoundError(e)) {
          throw Object.assign(new Error(), { name: 'FileNotFound' })
        }
        throw e
      })
      if (fstat.isDirectory()) continue
      const dstat = await stat(dest).catch(_ => undefined)
      if (dstat?.ino === fstat.ino) continue
      if (dstat?.size === fstat.size) continue
      result.push(await linkOrCopyFile(src, dest))
    }
    return result
  }

  async uninstall(instancePath: string, file: string | string[]) {
    const files = file instanceof Array ? file : [file]
    for (const f of files) {
      const dest = join(instancePath, this.domain, basename(f))
      await unlink(dest).catch(() => {})
    }
  }

  async watch(instancePath: string) {
    const key = `instance-${this.domain}://${instancePath}`
    const manager = await this.app.registry.get(ResourceManager)

    return this.store.registerOrGet(key, async () => {
      let watcher: ReturnType<ResourceManager['watchSecondary']> | undefined

      const tryWatch = () => {
        try {
          watcher = manager.watchSecondary(
            instancePath,
            this.domain,
          )
          this.log(`Watching instance ${instancePath} for ${this.domain}`)
        } catch (e) {
          if (isSystemError(e)) {
            if (e.code === 'ENOENT') {
              // ignore
              // this.log(`Instance ${instancePath} not exist. Skip watching.`) // verbose
            } else {
              throw e
            }
          }
        }
      }

      if (!await this.isLinked(instancePath)) {
        tryWatch()
      }

      const instanceService = await this.app.registry.get(InstanceService)
      const dispose = () => {
        watcher?.dispose()
      }
      instanceService.registerRemoveHandler(instancePath, dispose)

      return [this.state, dispose, async () => {
        const isLinked = await this.isLinked(instancePath)
        if (!isLinked && !watcher) {
          tryWatch()
        } else if (isLinked && watcher) {
          watcher.dispose()
          watcher = undefined
        }

        await watcher?.revalidate()

        await this.revalidate()
      }]
    })
  }

  async installFromMarket(options: InstallMarketOptionWithInstance): Promise<string[]> {
    const provider = await this.app.registry.get(kMarketProvider)
    const result = await provider.installInstanceFile({
      ...options,
      domain: this.domain,
      instancePath: options.instancePath,
    })
    return result.map((r) => r.path)
  }

  async showDirectory(path: string): Promise<void> {
    await this.app.shell.openDirectory(join(path, this.domain))
  }
}
