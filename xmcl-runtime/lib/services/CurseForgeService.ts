import { CurseforgeV1Client } from '@xmcl/curseforge'
import { DownloadTask } from '@xmcl/installer'
import { CurseForgeServiceKey, CurseForgeService as ICurseForgeService, InstallFileOptions, InstallFileResult, ProjectType, ResourceDomain, getCurseforgeFileUri } from '@xmcl/runtime-api'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { Client } from 'undici'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { kDownloadOptions } from '../entities/downloadOptions'
import { NetworkInterface, kNetworkInterface } from '../entities/networkInterface'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

@ExposeServiceKey(CurseForgeServiceKey)
export class CurseForgeService extends AbstractService implements ICurseForgeService {
  readonly client: CurseforgeV1Client

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(kNetworkInterface) networkInterface: NetworkInterface,
  ) {
    super(app)

    const dispatcher = networkInterface.registerAPIFactoryInterceptor((origin, options) => {
      if (origin.host === 'api.curseforge.com') {
        return new Client(origin, {
          ...options,
          pipelining: 6,
          bodyTimeout: 7000,
          headersTimeout: 7000,
        })
      }
    })
    this.client = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY || '', { dispatcher })
  }

  @Singleton((o) => o.file.id)
  async installFile({ file, type, instancePath, icon }: InstallFileOptions): Promise<InstallFileResult> {
    requireString(type)
    requireObject(file)
    // instancePath ||= this.instanceService.state.path

    const typeToDomain: Record<ProjectType, ResourceDomain> = {
      'mc-mods': ResourceDomain.Mods,
      'texture-packs': ResourceDomain.ResourcePacks,
      worlds: ResourceDomain.Saves,
      modpacks: ResourceDomain.Modpacks,
    }
    const uris = [getCurseforgeFileUri(file)]

    const downloadUrls = [] as string[]
    if (file.downloadUrl) {
      downloadUrls.push(file.downloadUrl)
    } else {
      // Guess the download url if the file url is not provided by curseforge
      downloadUrls.push(...guessCurseforgeFileUrl(file.id, file.fileName))
    }
    uris.push(...downloadUrls)

    this.log(`Try install file ${file.displayName}(${file.downloadUrl}) in type ${type}`)
    const resourceService = this.resourceService
    const downloadOptions = await this.app.registry.get(kDownloadOptions)
    const destination = join(this.app.temporaryPath, file.fileName)

    const domain = typeToDomain[type] ?? ResourceDomain.Unclassified
    // Try to find the resource in cache
    let resource = (await this.resourceService.getResourcesByUris(uris))[0]
    if (resource) {
      this.log(`The curseforge file ${file.displayName}(${file.downloadUrl}) existed in cache!`)
    } else {
      const task = new DownloadTask({
        ...downloadOptions,
        url: downloadUrls,
        destination,
      }).setName('installCurseforgeFile', { fileId: file.id })
      await this.submit(task)

      const icons = icon ? [icon] : []
      const [imported] = await resourceService.importResources([{
        path: destination,
        domain,
        uris,
        metadata: {
          curseforge: {
            projectId: file.modId,
            fileId: file.id,
          },
        },
        icons,
      }])

      resource = imported
      this.log(`Install curseforge file ${file.displayName}(${file.downloadUrl}) success!`)
      await unlink(destination).catch(() => undefined)
    }

    // Install the resource to instance if this is not a modpack
    if (instancePath && resource.domain !== ResourceDomain.Modpacks) {
      resource.path = resource.storedPath!
      resource.domain = domain
      await this.resourceService.install({ instancePath, resource })
    }

    return {
      file,
      resource,
    }
  }
}
