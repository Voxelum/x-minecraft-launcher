import { File, FileModLoaderType, FileRelationType, SearchOptions } from '@xmcl/curseforge'
import { DownloadTask } from '@xmcl/installer'
import { CurseForgeService as ICurseForgeService, CurseForgeServiceKey, CurseforgeState, GetModFilesOptions, InstallFileOptions, InstallFileResult, ProjectType, ResourceDomain } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { stat } from 'fs/promises'
import { join } from 'path'
import { Client } from 'undici'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { CurseforgeClient } from '../clients/CurseforgeClient'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { isNonnull, requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

@ExposeServiceKey(CurseForgeServiceKey)
export class CurseForgeService extends StatefulService<CurseforgeState> implements ICurseForgeService {
  readonly client: CurseforgeClient

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, () => new CurseforgeState())

    const dispatcher = this.networkManager.registerAPIFactoryInterceptor((origin, options) => {
      if (origin.host === 'api.curseforge.com') {
        return new Client(origin, {
          ...options,
          pipelining: 6,
          bodyTimeout: 7000,
          headersTimeout: 7000,
        })
      }
    })
    this.client = new CurseforgeClient(process.env.CURSEFORGE_API_KEY || '', dispatcher)
  }

  @Singleton()
  async fetchCategories() {
    return await this.client.getCategories()
  }

  @Singleton(v => v.toString())
  async fetchProject(projectId: number) {
    this.log(`Fetch project: ${projectId}`)
    return await this.client.getMod(projectId)
  }

  @Singleton(v => v.toString())
  async fetchProjectDescription(projectId: number) {
    this.log(`Fetch project description: ${projectId}`)
    return await this.client.getModDescription(projectId)
  }

  @Singleton(v => v.modId)
  async fetchProjectFiles(options: GetModFilesOptions) {
    this.log(`Fetch project files: ${options.modId}`)
    return await this.client.getModFiles(options)
  }

  @Singleton((a, b) => `${a}-${b}`)
  async fetchProjectFile(projectId: number, fileId: number) {
    this.log(`Fetch project file: ${projectId}-${fileId}`)
    return await this.client.getModFile(projectId, fileId)
  }

  async fetchMods(modIds: number[]) {
    this.log(`Fetch mods ${modIds.length} files.`)
    return await this.client.getMods(modIds)
  }

  async fetchModFiles(fileIds: number[]) {
    this.log(`Fetch profile ${fileIds.length} files.`)
    return await this.client.getFiles(fileIds)
  }

  async searchProjects(searchOptions: SearchOptions) {
    this.log(`Search project: ${JSON.stringify(searchOptions, null, 4)}`)
    return await this.client.searchMods(searchOptions)
  }

  async resolveFileDependencies(file: File): Promise<[File, FileRelationType][]> {
    const visited = new Set<number>()

    const visit = async (type: FileRelationType, file: File): Promise<[File, FileRelationType][]> => {
      if (visited.has(file.modId)) {
        return []
      }
      visited.add(file.modId)

      const dependencies = await Promise.all(file.dependencies.map(async (dep) => {
        if (dep.relationType <= 4) {
          let gameVersion = ''
          const modLoaderTypes: FileModLoaderType[] = []
          if (file.sortableGameVersions) {
            for (const ver of file.sortableGameVersions) {
              if (ver.gameVersion) {
                gameVersion = ver.gameVersion
              } else if (ver.gameVersionName === 'Forge') {
                modLoaderTypes.push(FileModLoaderType.Forge)
              } else if (ver.gameVersionName === 'Fabric') {
                modLoaderTypes.push(FileModLoaderType.Fabric)
              } else if (ver.gameVersionName === 'Quilt') {
                modLoaderTypes.push(FileModLoaderType.Quilt)
              } else if (ver.gameVersionName === 'LiteLoader') {
                modLoaderTypes.push(FileModLoaderType.LiteLoader)
              }
            }
          }
          try {
            if (modLoaderTypes.length === 0) {
              modLoaderTypes.push(FileModLoaderType.Any)
            }
            for (const modLoaderType of modLoaderTypes) {
              const files = await this.fetchProjectFiles({
                gameVersion,
                modId: dep.modId,
                modLoaderType,
                pageSize: 1,
              })
              if (files.data[0]) {
                return await visit(dep.relationType, files.data[0])
              }
            }
            this.warn(`Skip to install project file ${file.modId}:${file.id} dependency ${file.modId} as no mod files matched!`)
          } catch (e) {
            this.warn(`Fail to install project file ${file.modId}:${file.id} dependency ${file.modId} as no mod files matched!`)
            this.warn(e)
          }
        }
        return undefined
      }))

      return [[file, type], ...dependencies.filter(isNonnull).reduce((a, b) => a.concat(b), [])]
    }

    const deps = await visit(FileRelationType.RequiredDependency, file)
    deps.shift()

    return deps
  }

  async installFile({ file, type, projectId, instancePath, ignoreDependencies }: InstallFileOptions): Promise<InstallFileResult> {
    requireString(type)
    requireObject(file)
    const typeToDomain: Record<ProjectType, ResourceDomain> = {
      'mc-mods': ResourceDomain.Mods,
      'texture-packs': ResourceDomain.ResourcePacks,
      worlds: ResourceDomain.Saves,
      modpacks: ResourceDomain.Modpacks,
    }
    const uri = [`curseforge:${projectId}:${file.id}`]
    const downloadUrls = [] as string[]
    if (file.downloadUrl) {
      downloadUrls.push(file.downloadUrl)
    } else {
      downloadUrls.push(...guessCurseforgeFileUrl(file.id, file.fileName))
    }
    uri.push(...downloadUrls)
    this.log(`Try install file ${file.displayName}(${file.downloadUrl}) in type ${type}`)
    const resourceService = this.resourceService
    const networkManager = this.networkManager
    try {
      this.state.curseforgeDownloadFileStart({ fileId: file.id })
      const destination = join(this.app.temporaryPath, file.fileName)
      const project = await this.fetchProject(projectId)
      let dependencies: InstallFileResult[] = []
      if (ignoreDependencies || type === 'modpacks') {
        dependencies = []
      } else {
        const deps = await this.resolveFileDependencies(file)
        dependencies = await Promise.all(deps.map(async ([file, relation]) => {
          if (relation === 3) {
            return await this.installFile({ file, type, projectId: file.modId, instancePath, ignoreDependencies: true })
          } else {
            // Not enable by default
            return await this.installFile({ file, type, projectId: file.modId, ignoreDependencies: true })
          }
        }))
      }

      let resource = this.resourceService.getOneResource({ url: uri })
      if (resource) {
        this.log(`The curseforge file ${file.displayName}(${file.downloadUrl}) existed in cache!`)
      } else {
        const imageUrl = project.logo?.thumbnailUrl
        const task = new DownloadTask({
          ...networkManager.getDownloadBaseOptions(),
          url: downloadUrls,
          destination,
        }).setName('installCurseforgeFile', { fileId: file.id })
        const promise = this.submit(task)
        await promise
        const imported = await resourceService.importResource({
          resources: [{
            path: destination,
            uri: uri,
            metadata: {
              curseforge: {
                projectId,
                fileId: file.id,
              },
            },
            domain: typeToDomain[type] ?? ResourceDomain.Unclassified,
            icons: imageUrl ? [imageUrl] : [],
          }],
          background: true,
        })
        resource = imported[0]
        this.log(`Install curseforge file ${file.displayName}(${file.downloadUrl}) success!`)
        await unlink(destination).catch(() => undefined)
      }

      if (instancePath && resource.domain !== ResourceDomain.Modpacks) {
        await this.resourceService.install({ instancePath, resource })
      }

      return {
        file,
        mod: project,
        resource,
        dependencies: dependencies.filter(isNonnull),
      }
    } finally {
      this.state.curseforgeDownloadFileEnd(file.id)
    }
  }
}
