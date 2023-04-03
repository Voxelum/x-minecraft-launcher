import { DownloadTask } from '@xmcl/installer'
import type { Category, GameVersion, License, Loader, ProjectVersion } from '@xmcl/modrinth'
import { ModrinthService as IModrinthService, InstallModrinthVersionResult, InstallProjectVersionOptions, ModrinthServiceKey, getModrinthVersionFileUri, getModrinthVersionUri } from '@xmcl/runtime-api'
import { unlink } from 'fs/promises'
import { basename, join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

interface Tags { licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }

@ExposeServiceKey(ModrinthServiceKey)
export class ModrinthService extends AbstractService implements IModrinthService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, async () => {
    })
  }

  // async resolveDependencies(version: ProjectVersion): Promise<ProjectVersion[]> {
  //   const visited = new Set<string>()

  //   const visit = async (version: ProjectVersion): Promise<ProjectVersion[]> => {
  //     if (visited.has(version.project_id)) {
  //       return []
  //     }
  //     visited.add(version.project_id)

  //     this.client.getProjectVersionsById(version.dependencies.map(d => d.version_id).filter(isNonnull))
  //     const deps = await Promise.all(version.dependencies.map(async (dep) => {
  //       if (dep.dependency_type === 'required') {
  //         if (dep.version_id) {
  //           const depVersion = await this.getProjectVersion(dep.version_id)
  //           const result = await visit(depVersion)
  //           return result
  //         } else {
  //           const versions = await this.client.getProjectVersions(dep.project_id, version.loaders, version.game_versions, undefined)
  //           const result = await visit(versions[0])
  //           return result
  //         }
  //       }
  //     }))
  //     return [version, ...deps.filter(isNonnull).reduce((a, b) => a.concat(b), [])]
  //   }

  //   const deps = await visit(version)
  //   deps.shift()

  //   return deps
  // }

  @Singleton((o) => `${o.version.id}`)
  async installVersion({ version, icon, instancePath }: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult> {
    const isSingleFile = version.files.length === 1
    const resources = await Promise.all(version.files.map(async (file) => {
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

      let resource = (await this.resourceService.getResourcesByUris(urls)).reduce((a, b) => a || b, undefined)
      if (resource) {
        this.log(`The modrinth file ${file.filename}(${file.url}) existed in cache!`)
      } else {
        const task = new DownloadTask({
          ...this.networkManager.getDownloadBaseOptions(),
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

        await this.taskManager.submit(task)
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
        resource.path = resource.storedPath!
        await this.resourceService.install({ instancePath, resource })
      }

      return resource
    }))

    return {
      version,
      resources,
    }
  }
}
