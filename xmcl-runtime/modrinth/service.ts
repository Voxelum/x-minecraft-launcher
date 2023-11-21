import { DownloadTask } from '@xmcl/installer'
import { CreateInstanceOption, ModrinthService as IModrinthService, InstallModrinthVersionResult, InstallProjectVersionOptions, ModrinthServiceKey, ResourceDomain, getModrinthVersionFileUri, getModrinthVersionUri } from '@xmcl/runtime-api'
import { readFile, unlink } from 'fs/promises'
import { basename, join } from 'path'
import { LauncherApp } from '../lib/app/LauncherApp'
import { LauncherAppKey } from '../lib/app/utils'
import { kDownloadOptions } from '~/network'
import { TaskFn, kTaskExecutor } from '../lib/entities/task'
import { Inject } from '../lib/util/objectRegistry'
import { AbstractService, ExposeServiceKey, Singleton } from '../lib/services/Service'
import { ResourceService } from '../resource'
import { ModrinthProfile } from './entities'

@ExposeServiceKey(ModrinthServiceKey)
export class ModrinthService extends AbstractService implements IModrinthService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, async () => { })
  }

  getModrinthRootDirectory() {
    return join(this.app.host.getPath('appData'), 'com.modrinth.theseus')
  }

  async parseModrinthInstance(instancePath: string): Promise<CreateInstanceOption & { importPath: string }> {
    const data = await readFile(join(instancePath, 'profile.json'), 'utf-8')
    const modrinth = JSON.parse(data) as ModrinthProfile

    const options: CreateInstanceOption = {
      name: modrinth.metadata.name,
      icon: modrinth.metadata.icon,
      runtime: {
        minecraft: modrinth.metadata.game_version,
        forge: modrinth.metadata.loader === 'forge' ? modrinth.metadata.loader_version.id : undefined,
        fabricLoader: modrinth.metadata.loader === 'fabric' ? modrinth.metadata.loader_version.id : undefined,
        quiltLoader: modrinth.metadata.loader === 'quilt' ? modrinth.metadata.loader_version.id : undefined,
      },
      upstream: {
        type: 'modrinth-modpack',
        projectId: modrinth.metadata.linked_data.project_id,
        versionId: modrinth.metadata.linked_data.version_id,
      },
    }

    return {
      ...options,
      importPath: join(instancePath, modrinth.path),
    }
  }

  async importModrinth(path: string) {
    const data = await readFile(path, 'utf-8')
    const modrinth = JSON.parse(data) as ModrinthProfile
  }

  @Singleton((o) => `${o.version.id}`)
  async installVersion({ version, icon, instancePath }: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult> {
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
