import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { GetManifestOptions, InstanceManifestService as IInstanceManifestService, InstanceFile, InstanceIOException, InstanceManifest, InstanceManifestServiceKey } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceManager, ResourceWorker, kResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { AnyError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { isNonnull } from '../util/object'
import { decorateInstanceFiles, discover } from './InstanceFileDiscover'
import { ResolveInstanceFileTask } from './ResolveInstanceFileTask'

@ExposeServiceKey(InstanceManifestServiceKey)
export class InstanceManifestService extends AbstractService implements IInstanceManifestService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceManager) private resourceManager: ResourceManager,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(CurseforgeV1Client) private curseforgeClient: CurseforgeV1Client,
    @Inject(ModrinthV2Client) private modrinthClient: ModrinthV2Client,
  ) {
    super(app)
  }

  @Singleton(p => JSON.stringify(p))
  async getInstanceServerManifest(options: GetManifestOptions): Promise<Array<InstanceFile>> {
    const instancePath = options?.path

    const instanceService = await this.app.registry.get(InstanceService)

    const instance = instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    let files = [] as Array<InstanceFile>

    const logger = this
    const fileWithStats = await discover(join(instancePath, 'server'), logger, (filePath) => {
      if (filePath.startsWith('libraries') || filePath.startsWith('versions') || filePath.startsWith('assets')) {
        return true
      }
      if (filePath.endsWith('.DS_Store') || filePath.endsWith('.gitignore')) {
        return true
      }
      return false
    })

    files = fileWithStats.map(([file]) => file)

    return files
  }

  @Singleton(p => JSON.stringify(p))
  async getInstanceManifest(options: GetManifestOptions): Promise<InstanceManifest> {
    const instancePath = options?.path

    const instanceService = await this.app.registry.get(InstanceService)

    const instance = instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    let files = [] as Array<InstanceFile>
    const undecorated = [] as Array<InstanceFile>
    const resolveTask = new ResolveInstanceFileTask(undecorated, this.curseforgeClient, this.modrinthClient)

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const logger = this
    const worker = this.worker
    const resourceManager = this.resourceManager

    /**
     * These files can update its resource metadata
     */
    const pendingResourceUpdates = new Set<InstanceFile>()
    await task('getInstanceManifest', async function () {
      const start = performance.now()
      const fileWithStats = await discover(instancePath, logger, (relativePath, stat) => {
        if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks')) {
          if (relativePath.endsWith('.json') || relativePath.endsWith('.png')) {
            return true
          }
        }
        if (relativePath.startsWith('.backups')) {
          return true
        }
        if (relativePath.endsWith('.DS_Store') || relativePath.endsWith('.gitignore')) {
          return true
        }
        if (relativePath === 'instance.json') {
          return true
        }
        if (relativePath === 'server' && stat.isDirectory()) {
          return true
        }
        // no lib or exe
        if (relativePath.endsWith('.dll') || relativePath.endsWith('.so') || relativePath.endsWith('.exe')) {
          return true
        }
        // do not share versions/libs/assets
        if (relativePath.startsWith('versions') || relativePath.startsWith('assets') || relativePath.startsWith('libraries')) {
          return true
        }
        return false
      })
      const duration = performance.now() - start
      logger.log(`Discover instance files in ${instancePath} in ${duration}ms`)

      const decorateStart = performance.now()
      try {
        await decorateInstanceFiles(fileWithStats, instancePath, worker, resourceManager, pendingResourceUpdates)
      } catch (e) {
        logger.error(new AnyError('InstanceManifestResolveResourceError', 'Fail to get manifest data for instance file', { cause: e }))
      }
      logger.log(`Decorate instance files in ${instancePath} in ${performance.now() - decorateStart}ms`)

      if (options.hashes) {
        const hashStart = performance.now()
        const hashes = options.hashes
        await Promise.all(fileWithStats.filter(([f]) => {
          for (const h of hashes) {
            if (!f.hashes[h]) {
              return true
            }
          }
          return false
        }).map(([f]) => Promise.all(hashes.map(async (a) => {
          if (!f.hashes[a]) {
            f.hashes[a] = await worker.checksum(join(instancePath, f.path), a)
          }
        }))))
        logger.log(`Resolve hashes in ${instancePath} in ${performance.now() - hashStart}ms`)
      }

      files = fileWithStats.map(([file]) => file)

      const resolveStart = performance.now()
      await this.yield(resolveTask).catch(() => undefined)
      logger.log(`Resolve instance files in ${instancePath} in ${performance.now() - resolveStart}ms`)
    }).startAndWait()

    const updates = [...pendingResourceUpdates].map((file) => {
      if (!file.hashes.sha1) return undefined
      return {
        hash: file.hashes.sha1,
        metadata: {
          modrinth: file.modrinth,
          curseforge: file.curseforge,
        },
        uri: file.downloads,
      }
    }).filter(isNonnull)

    this.resourceManager.updateMetadata(updates).catch((e) => {
      this.warn('Fail to update the resources')
      this.warn(e)
    })

    return {
      files,
      name: instance.name,
      description: instance.description,
      mcOptions: instance.mcOptions,
      vmOptions: instance.vmOptions,
      runtime: instance.runtime,
      maxMemory: instance.maxMemory,
      minMemory: instance.minMemory,
    }
  }
}
