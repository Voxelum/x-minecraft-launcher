import { DownloadTask } from '@xmcl/installer'
import { ModrinthService as IModrinthService, InstallModrinthVersionResult, InstallProjectVersionOptions, ModrinthServiceKey, ResourceDomain, getModrinthVersionFileUri, getModrinthVersionUri } from '@xmcl/runtime-api'
import { unlink } from 'fs/promises'
import { basename, join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { kDownloadOptions } from '../entities/downloadOptions'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

@ExposeServiceKey(ModrinthServiceKey)
export class ModrinthService extends AbstractService implements IModrinthService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, async () => { })
  }

  @Singleton((o) => `${o.version.id}`)
  async installVersion({ version, icon, instancePath }: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult> {
    // instancePath ||= this.instanceService.state.path
    const primaryFiles = version.files.filter(f => f.primary)
    const isSingleFile = primaryFiles.length === 1
    const resources = await Promise.all(primaryFiles.map(async (file) => {
      this.log(`Try install project version file ${file.filename} ${file.url}`)
      const destination = join(this.app.temporaryPath, basename(file.filename))
      const hashes = Object.entries(file.hashes)
      const urls = [file.url]
      if (version) {
        urls.push(getModrinthVersionFileUri({ project_id: version.project_id, id: version.id, filename: file.filename }))
        if (isSingleFile) {
          urls.push(getModrinthVersionUri(version))
        }
      }

    const downloadOptions = await this.app.registry.get(kDownloadOptions)
    let resource = (await this.resourceService.getResourcesByUris(urls))[0]
      if (resource) {
        this.log(`The modrinth file ${file.filename}(${file.url}) existed in cache!`)
      } else {
        const task = new DownloadTask({
          ...downloadOptions,
          url: file.url,
          destination,
          validator: {
            algorithm: hashes[0][0],
            hash: hashes[0][1],
          },
        }).setName('installModrinthFile', {
          projectId: version.project_id,
          versionId: version.id,
          filename: file.filename,
        })

        await this.submit(task)
        const metadata = {
          modrinth: version
            ? {
              projectId: version.project_id,
              versionId: version.id,
              filename: file.filename,
              url: file.url,
            }
            : undefined,
        }

        const [result] = await this.resourceService.importResources([{
          path: destination,
          uris: urls,
          metadata,
          icons: icon ? [icon] : [],
        }])

        await unlink(destination).catch(() => undefined)
        this.log(`Install modrinth file ${file.filename}(${file.url}) success!`)

        resource = result
      }

      if (instancePath) {
        if (resource.domain === ResourceDomain.Modpacks) {
          this.log(`Skip to install modpack ${resource.name} (versionId=${version.id}, projectId=${version.project_id})`)
        } else {
          resource.path = resource.storedPath!
          await this.resourceService.install({ instancePath, resource })
        }
      }

      return resource
    }))

    return {
      version,
      resources,
    }
  }
}
