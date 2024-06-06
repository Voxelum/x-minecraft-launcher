import { DownloadTask } from '@xmcl/installer'
import { ModrinthService as IModrinthService, InstallModrinthVersionResult, InstallProjectVersionOptions, ModrinthServiceKey, ResourceDomain, getModrinthVersionFileUri, getModrinthVersionUri } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { basename, join } from 'path'
import { Inject, LauncherApp, LauncherAppKey, kTempDataPath } from '~/app'
import { kDownloadOptions } from '~/network'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { TaskFn, kTaskExecutor } from '~/task'
import { ResourceService } from '../resource'
import { isNonnull } from '~/util/object'
import filenamify from 'filenamify'

@ExposeServiceKey(ModrinthServiceKey)
export class ModrinthService extends AbstractService implements IModrinthService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, async () => { })
  }

  @Singleton((o) => `${o.version.id}`)
  async installVersion({ version, icon, instancePath }: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult> {
    const primaryFiles = version.files.filter(f => f.primary)
    let files = primaryFiles.length === 0 ? version.files : primaryFiles
    if (files.some(f => f.filename.endsWith('.zip')) &&
      files.some(f => f.filename.endsWith('.mrpack') || f.filename.endsWith('.jar'))) {
      files = files.filter(f => f.filename.endsWith('.mrpack') || f.filename.endsWith('.jar'))
    }
    const isSingleFile = files.length === 1
    const resources = await Promise.all(files.map(async (file) => {
      this.log(`Try install project version file ${file.filename} ${file.url}`)
      const getTemp = await this.app.registry.get(kTempDataPath)
      const destination = getTemp(filenamify(basename(file.filename), { replacement: '-' }))
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

        if (!result) {
          return
        }
        result.path = result.storedPath || result.path

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
      resources: resources.filter(isNonnull),
    }
  }
}
