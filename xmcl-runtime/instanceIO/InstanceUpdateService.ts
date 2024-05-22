import { Instance, InstanceData, InstanceFile, InstanceFileUpdate, InstanceUpdateService as IInstanceUpdateService, InstanceUpdateServiceKey, UpdateInstanceOptions, UpgradeModpackOptions, UpgradeModpackRawOptions } from '@xmcl/runtime-api'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, Inject } from '~/app'
import { InstanceManifestService } from './InstanceManifestService'
import { InstanceService } from '~/instance'
import { ModpackService } from '~/modpack'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey } from '~/service'

type Upstream = Required<Instance>['upstream']

type UpstreamResolver = (upstream: Upstream) => Promise<InstanceFile[] | undefined>

@ExposeServiceKey(InstanceUpdateServiceKey)
export class InstanceUpdateService extends AbstractService implements IInstanceUpdateService {
  protected resolvers: UpstreamResolver[] = []

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(ResourceService) resourceService: ResourceService,
    @Inject(InstanceManifestService) private instanceManifestService: InstanceManifestService,
    @Inject(ModpackService) private modpackService: ModpackService,
  ) {
    super(app)

    this.registerUpstreamResolver(async (upstream) => {
      if (upstream.type === 'modrinth-modpack') {
        const res = upstream.sha1 ? await resourceService.getResourceByHash(upstream.sha1) : (await resourceService.getResourcesByUris([`modrinth:${upstream.projectId}:${upstream.versionId}`]))[0]
        if (res) {
          if (res.metadata.instance) {
            return res.metadata.instance.files
          }
          return await this.modpackService.getModpackInstallFiles(res.path).catch(() => undefined)
        }
        const resMetadata = upstream.sha1 ? await resourceService.getResourceMetadataByHash(upstream.sha1) : (await resourceService.getResourceMetadataByUri(`modrinth:${upstream.projectId}:${upstream.versionId}`))[0]
        if (resMetadata?.instance) {
          return resMetadata.instance.files
        }
      }
      return undefined
    })

    this.registerUpstreamResolver(async (upstream) => {
      if (upstream.type === 'curseforge-modpack') {
        const res = upstream.sha1 ? await resourceService.getResourceByHash(upstream.sha1) : (await resourceService.getResourcesByUris([`curseforge:${upstream.modId}:${upstream.fileId}`]))[0]
        if (res) {
          if (res.metadata.instance) {
            return res.metadata.instance.files
          }
          return await this.modpackService.getModpackInstallFiles(res.path).catch(() => undefined)
        }
        const resMetadata = upstream.sha1 ? await resourceService.getResourceMetadataByHash(upstream.sha1) : (await resourceService.getResourceMetadataByUri(`curseforge:${upstream.modId}:${upstream.fileId}`))[0]
        if (resMetadata?.instance) {
          return resMetadata.instance.files
        }
      }
      return undefined
    })
  }

  registerUpstreamResolver(resolver: UpstreamResolver) {
    this.resolvers.push(resolver)
  }

  private async resolveOldFiles(instancePath: string, instance: InstanceData, oldModpack?: string): Promise<InstanceFile[]> {
    if (oldModpack) {
      // If old modpack path present, try to get modpack content
      const files = await this.modpackService.getModpackInstallFiles(oldModpack)
      return files
    }

    if (instance.upstream) {
      const upstream = instance.upstream

      // Parse the upstream and get the modpack metadata alloc to it
      for (const resolver of this.resolvers) {
        const result = await resolver(upstream)
        if (result) {
          return result
        }
      }
    }

    // Not found the related modpack metadata...
    // Now directly get the current instance manfiest
    const man = await this.instanceManifestService.getInstanceManifest({ path: instancePath, hashes: ['sha1'] })
    const files = man.files.filter(f => f.path.startsWith('/mods'))
    return files
  }

  #getInstanceFilesUpdate(oldFiles: InstanceFile[], currentFiles: InstanceFile[], newFiles: InstanceFile[]) {
    const toRemove = [] as InstanceFile[]
    const toAdd: Record<string, InstanceFile> = {}

    const oldMapping: Record<string, InstanceFile> = {}
    for (const f of oldFiles) oldMapping[f.path] = f
    for (const f of newFiles) {
      if (!oldMapping[f.path]) {
        toAdd[f.path] = f
      } else {
        delete oldMapping[f.path]
      }
    }
    toRemove.push(...Object.values(oldMapping))

    const result: InstanceFileUpdate[] = []
    for (const f of currentFiles) {
      let index = -1
      if ((index = toRemove.findIndex(r => r.path === f.path)) !== -1) {
        const r = toRemove[index]
        if (r.hashes.sha1 === f.hashes.sha1) {
          result.push({ file: f, operation: 'remove' })
        } else {
          // disable this file
          result.push({ currentFile: f, file: r, operation: 'backup-remove' })
        }
      } else if (toAdd[f.path]) {
        const a = toAdd[f.path]
        if (a.hashes.sha1 !== f.hashes.sha1) {
          // backup this file
          result.push({ currentFile: f, file: a, operation: 'backup-add' })
        } else {
          result.push({ file: f, operation: 'keep' })
        }

        delete toAdd[f.path]
      } else {
        result.push({ file: f, operation: 'keep' })
      }
    }

    for (const a of Object.values(toAdd)) {
      result.push({
        file: a,
        operation: 'add',
      })
    }

    return result
  }

  async getInstanceUpdateProfileRaw(options: UpgradeModpackRawOptions): Promise<InstanceFileUpdate[]> {
    const oldFiles = options.oldVersionFiles
    const newFiles = options.newVersionFiles

    const manifest = await this.instanceManifestService.getInstanceManifest({ path: options.instancePath, hashes: ['sha1'] })
    const result = this.#getInstanceFilesUpdate(oldFiles, manifest.files, newFiles)

    return result
  }

  async getInstanceUpdateProfile(options: UpgradeModpackOptions) {
    const instancePath = options.instancePath
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      throw new Error()
    }

    const oldFiles = await this.resolveOldFiles(instancePath, instance, options.oldModpack)

    const newFiles = await this.modpackService.getModpackInstallFiles(options.newModpack)

    const manifest = await this.instanceManifestService.getInstanceManifest({ path: instancePath, hashes: ['sha1'] })

    const result = this.#getInstanceFilesUpdate(oldFiles, manifest.files, newFiles)

    return result.filter(r => !r.file.path.endsWith('/'))
  }
}
