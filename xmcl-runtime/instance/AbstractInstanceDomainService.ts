import { InstallMarketOptionWithInstance, LockKey, UpdateInstanceResourcesOptions } from '@xmcl/runtime-api'
import { ensureDir, mkdir, stat, unlink } from 'fs-extra'
import { basename, join } from 'path'
import { LauncherApp } from '~/app'
import { InstanceService } from '~/instance'
import { kMarketProvider } from '~/market'
import { ResourceDomain } from '@xmcl/resource'
import { kResourceManager } from '~/resource'
import { AbstractService, ServiceStateManager } from '~/service'
import { isSystemError } from '@xmcl/utils'
import { linkDirectory, linkWithTimeoutOrCopy } from '../util/fs'
import { readlinkSafe } from './utils/readLinkSafe'

function getMigrateLegacy(domain: ResourceDomain) {
  if (domain === ResourceDomain.ResourcePacks || domain === ResourceDomain.ShaderPacks) {
    return async (instancePath: string) => {
      const destPath = join(instancePath, domain)
      const linkedPath = await readlinkSafe(destPath)
      if (linkedPath) {
        await unlink(destPath)
        await mkdir(destPath)
      }
    }
  }
  return (_: string) => Promise.resolve()
}

export abstract class AbstractInstanceDomainService extends AbstractService {
  onMigrateLegacy: (instancePath: string) => Promise<void>

  constructor(app: LauncherApp, protected domain: ResourceDomain) {
    super(app)
    this.onMigrateLegacy = getMigrateLegacy(domain)
  }

  async install({ files, path }: UpdateInstanceResourcesOptions) {
    this.log(`Install ${files.length} to ${path}/${this.domain}`)
    const dir = join(path, this.domain)
    return await Promise.all(files.map(async (src) => {
      const dest = join(dir, basename(src))
      if (src === dest) {
        return dest
      }
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest).catch(() => undefined)])

      try {
        if (!destStat) {
          if (srcStat.isDirectory()) {
            await linkDirectory(src, dest, this.logger)
          } else {
            await linkWithTimeoutOrCopy(src, dest)
          }
        } else if (srcStat.ino !== destStat.ino) {
          await unlink(dest).then(() => linkWithTimeoutOrCopy(src, dest))
        }
        return dest
      } catch (e) {
        if (isSystemError(e)) {
          Object.assign(e, {
            name: 'ResourceInstallError',
            domain: this.domain,
          })
        }
        throw e
      }
    }))
  }

  async uninstall({ files, path }: UpdateInstanceResourcesOptions) {
    await Promise.all(files.map(async (f) => {
      const dest = join(path, this.domain, basename(f))
      await unlink(dest).catch(() => { })
    }))
  }

  async watch(instancePath: string) {
    const key = `instance-${this.domain}://${instancePath}`

    await this.onMigrateLegacy(instancePath)
    const resourceManager = await this.app.registry.get(kResourceManager)
    if (!resourceManager || !resourceManager.context) {
      throw new Error('ResourceManager is not properly initialized')
    }
    const store = await this.app.registry.get(ServiceStateManager)
    return store.registerOrGet(key, async ({ doAsyncOperation }) => {
      const lock = this.mutex.of(LockKey.instance(instancePath))
      const basePath = join(instancePath, this.domain)

      await ensureDir(basePath)
      const { dispose, revalidate, state } = resourceManager.watch({ directory: basePath, domain: this.domain, processUpdate: (func) => doAsyncOperation(lock.waitForUnlock().then(func)) })

      const instanceService = await this.app.registry.get(InstanceService)
      instanceService.registerRemoveHandler(instancePath, dispose)

      this.log(`Mounted on instance ${this.domain}: ${basePath}`)

      return [state, dispose, revalidate]
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
