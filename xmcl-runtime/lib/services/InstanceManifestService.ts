import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { GetManifestOptions, InstanceManifestService as IInstanceManifestService, InstanceFile, InstanceManifest, InstanceManifestServiceKey, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { stat } from 'fs/promises'
import { join, relative } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { ResourceWorker, kResourceWorker } from '../entities/resourceWorker'
import { readdirIfPresent } from '../util/fs'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'
import { ResolveInstanceFileTask } from '../entities/instanceInstall'

@ExposeServiceKey(InstanceManifestServiceKey)
export class InstanceManifestService extends AbstractService implements IInstanceManifestService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(CurseforgeV1Client) private curseforgeClient: CurseforgeV1Client,
    @Inject(ModrinthV2Client) private modrinthClient: ModrinthV2Client,
  ) {
    super(app)
  }

  @Singleton(p => JSON.stringify(p))
  async getInstanceManifest(options: GetManifestOptions): Promise<InstanceManifest> {
    // Ensure the resource service is initialized...
    await this.resourceService.initialize()
    const instancePath = options?.path

    // const instance = this.instanceService.state.all[instancePath]

    const resolveHashes = async (file: string, sha1?: string) => {
      const result: Record<string, string> = {}
      if (options?.hashes) {
        for (const hash of options.hashes) {
          if (hash === 'sha1') {
            if (sha1) {
              result.sha1 = sha1
            } else {
              result[hash] = await this.worker.checksum(file, hash)
            }
            continue
          } else {
            result[hash] = await this.worker.checksum(file, hash)
          }
        }
      }
      return result as any
    }

    // if (!instance) {
    //   throw new Error('Instance not found')
    //   // throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    // }

    const files = [] as Array<InstanceFile>
    const undecorated = [] as Array<InstanceFile>
    const undecoratedResources = new Map<InstanceFile, Resource>()

    const scan = async (p: string) => {
      const status = await stat(p)
      const ino = status.ino
      const isDirectory = status.isDirectory()
      const relativePath = relative(instancePath, p).replace(/\\/g, '/')
      if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks')) {
        if (relativePath.endsWith('.json') || relativePath.endsWith('.png')) {
          return
        }
      }
      if (relativePath === 'instance.json') {
        return
      }
      // no lib or exe
      if (relativePath.endsWith('.dll') || relativePath.endsWith('.so') || relativePath.endsWith('.exe')) {
        return
      }
      // do not share versions/libs/assets
      if (relativePath.startsWith('versions') || relativePath.startsWith('assets') || relativePath.startsWith('libraries')) {
        return
      }

      if (isDirectory) {
        const children = await readdirIfPresent(p)
        await Promise.all(children.map(child => scan(join(p, child)).catch((e) => {
          this.error(new Error('Fail to get manifest data for instance file', { cause: e }))
        })))
      } else {
        const localFile: InstanceFile = {
          path: relativePath,
          size: status.size,
          hashes: {},
        }
        if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks') || relativePath.startsWith('mods')) {
          let resource = await this.resourceService.getReosurceByIno(ino)
          const sha1 = resource?.hash ?? await this.worker.checksum(p, 'sha1')
          if (!resource) {
            resource = await this.resourceService.getResourceByHash(sha1)
          }
          if (resource?.metadata.modrinth) {
            localFile.modrinth = {
              projectId: resource.metadata.modrinth.projectId,
              versionId: resource.metadata.modrinth.versionId,
            }
          }
          if (resource?.metadata.curseforge) {
            localFile.curseforge = {
              projectId: resource.metadata.curseforge.projectId,
              fileId: resource.metadata.curseforge.fileId,
            }
          }
          localFile.downloads = resource?.uris && resource.uris.some(u => u.startsWith('http')) ? resource.uris.filter(u => u.startsWith('http')) : undefined
          localFile.hashes = await resolveHashes(p, sha1)

          // No download url...
          if ((!localFile.downloads || localFile.downloads.length === 0) &&
            (relativePath.startsWith(ResourceDomain.Mods) || relativePath.startsWith(ResourceDomain.ResourcePacks) || relativePath.startsWith(ResourceDomain.ShaderPacks))) {
            undecorated.push(localFile)
            if (resource) {
              undecoratedResources.set(localFile, resource)
            }
          }
        } else {
          localFile.hashes = await resolveHashes(p)
        }

        files.push(localFile)
      }
    }

    files.shift()

    const resolveTask = new ResolveInstanceFileTask(undecorated, this.curseforgeClient, this.modrinthClient)

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const logger = this
    await task('getInstanceManifest', async function () {
      await this.yield(task('scan', () => scan(instancePath).catch((e) => {
        logger.error(new Error('Fail to get manifest data for instance file', { cause: e }))
      })))
      await this.yield(resolveTask).catch(() => undefined)
    }).startAndWait()

    const updates = undecorated.map((file) => {
      const resource = undecoratedResources.get(file)
      if (resource) {
        return {
          hash: file.hashes.sha1,
          metadata: {
            modrinth: file.modrinth,
            curseforge: file.curseforge,
          },
          uri: file.downloads,
        }
      }
      return undefined
    }).filter(isNonnull)
    await this.resourceService.updateResources(updates).catch((e) => {
      this.warn('Fail to update the resources')
      this.warn(e)
    })

    return {
      files,
      name: '', // instance.name,
      description: '', // instance.description,
      mcOptions: [], // instance.mcOptions,
      vmOptions: [], // instance.vmOptions,
      runtime: {} as any, // instance.runtime,
      maxMemory: 0, // instance.maxMemory,
      minMemory: 0, // instance.minMemory,
    }
  }
}
