import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { GetManifestOptions, InstanceManifestService as IInstanceManifestService, InstanceFile, InstanceIOException, InstanceManifest, InstanceManifestServiceKey, Resource } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceManager, ResourceWorker, kResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { AnyError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { isNonnull } from '../util/object'
import { decoareteInstanceFileFromResourceCache, discover } from './InstanceFileDiscover'
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
      const fileWithStats = await discover(instancePath, logger)

      await Promise.all(
        fileWithStats.map(([file, status]) => decoareteInstanceFileFromResourceCache(file, status, instancePath, worker, resourceManager, pendingResourceUpdates, options?.hashes)
          .catch((e) => {
            logger.error(new AnyError('InstanceManifestResolveResourceError', 'Fail to get manifest data for instance file', { cause: e }, file))
          })),
      )

      if (options.hashes) {
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
      }

      files = fileWithStats.map(([file]) => file)

      await this.yield(resolveTask).catch(() => undefined)
    }).startAndWait()

    const updates = [...pendingResourceUpdates].map((file) => {
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
