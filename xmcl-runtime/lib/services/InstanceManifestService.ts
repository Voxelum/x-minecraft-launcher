import { GetManifestOptions, InstanceFile, InstanceManifest, InstanceManifestService as IInstanceManifestService, InstanceManifestServiceKey, Resource, ResourceData, ResourceDomain } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { stat } from 'fs/promises'
import { join, relative } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { readdirIfPresent } from '../util/fs'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { CurseForgeService } from './CurseForgeService'
import { ResolveInstanceFileTask } from './InstanceInstallService'
import { InstanceService } from './InstanceService'
import { ModrinthService } from './ModrinthService'
import { ResourceService } from './ResourceService'
import { ExposeServiceKey, AbstractService, Singleton } from './Service'

@ExposeServiceKey(InstanceManifestServiceKey)
export class InstanceManifestService extends AbstractService implements IInstanceManifestService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(CurseForgeService) private curseforgeService: CurseForgeService,
    @Inject(ModrinthService) private modrinthService: ModrinthService,
  ) {
    super(app)
  }

  @Singleton(p => p)
  async getInstanceManifest(options?: GetManifestOptions): Promise<InstanceManifest> {
    // Ensure the resource service is initialized...
    await this.resourceService.initialize()
    const instancePath = options?.path || this.instanceService.state.path

    const instance = this.instanceService.state.all[instancePath]

    const resolveHashes = async (file: string, sha1: string) => {
      const result: Record<string, string> = { sha1 }
      if (options?.hashes) {
        for (const hash of options.hashes) {
          if (hash === 'sha1') {
            continue
          } else {
            result[hash] = await this.worker().checksum(file, hash)
          }
        }
      }
      return result as any
    }

    if (!instance) {
      throw new Error('Instance not found')
      // throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

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
        await Promise.all(children.map(child => scan(join(p, child))))
      } else {
        const localFile: InstanceFile = {
          path: relativePath,
          size: status.size,
          hashes: {},
        }
        if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks') || relativePath.startsWith('mods')) {
          let resource = this.resourceService.getResourceByKey(ino)
          const sha1 = resource?.hash ?? await this.worker().checksum(p, 'sha1')
          if (!resource) {
            resource = this.resourceService.getResourceByKey(sha1)
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
          localFile.downloads = resource?.uri && resource.uri.some(u => u.startsWith('http')) ? resource.uri.filter(u => u.startsWith('http')) : undefined
          localFile.hashes = await resolveHashes(p, sha1)

          // No download url...
          if ((!localFile.downloads || localFile.downloads.length === 0) &&
            (relativePath.startsWith(ResourceDomain.Mods) || relativePath.startsWith(ResourceDomain.ResourcePacks) || relativePath.startsWith(ResourceDomain.ShaderPacks))) {
            undecorated.push(localFile)
            if (resource) {
              undecoratedResources.set(localFile, resource)
            }
          }
        }

        files.push(localFile)
      }
    }

    files.shift()

    const resolveTask = new ResolveInstanceFileTask(undecorated, this.curseforgeService, this.modrinthService)
    // await this.taskManager.submit(task('getInstanceManifest', async function () {
    //   await this.yield(task('scan', () => scan(instancePath)))
    //   await this.yield(resolveTask)
    // }))
    await task('getInstanceManifest', async function () {
      await this.yield(task('scan', () => scan(instancePath)))
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
      mcOptions: instance.mcOptions,
      vmOptions: instance.vmOptions,
      runtime: instance.runtime,
      maxMemory: instance.maxMemory,
      minMemory: instance.minMemory,
    }
  }
}
