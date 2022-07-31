import { Mod, File, ModsSearchSortField, Pagination, ModCategory, SearchOptions, FileModLoaderType } from '@xmcl/curseforge'
import { DownloadTask } from '@xmcl/installer'
import { CurseForgeService as ICurseForgeService, CurseForgeServiceKey, CurseforgeState, GetModFilesOptions, InstallFileOptions, InstallFileResult, ProjectType, ResourceDomain } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { join } from 'path'
import { URLSearchParams } from 'url'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { isNonnull, requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { Singleton, StatefulService } from './Service'

export class CurseForgeService extends StatefulService<CurseforgeState> implements ICurseForgeService {
  private client = this.networkManager.request.extend({
    prefixUrl: 'https://api.curseforge.com',
    headers: {
      Accept: 'application/json',
      'x-api-key': process.env.CURSEFORGE_API_KEY,
    },
  })

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, CurseForgeServiceKey, () => new CurseforgeState())
  }

  @Singleton()
  async fetchCategories() {
    const categories: { data: ModCategory[] } = await this.client.get('v1/categories', { searchParams: { gameId: 432 } }).json()
    return categories.data
  }

  @Singleton(v => v.toString())
  async fetchProject(projectId: number) {
    this.log(`Fetch project: ${projectId}`)
    const result: { data: Mod } = await this.client.get(`v1/mods/${projectId}`).json()
    return result.data
  }

  @Singleton(v => v.toString())
  async fetchProjectDescription(projectId: number) {
    this.log(`Fetch project description: ${projectId}`)
    const result: { data: string } = await this.client.get(`v1/mods/${projectId}/description`).json()
    return result.data
  }

  @Singleton(v => v.modId)
  async fetchProjectFiles(options: GetModFilesOptions) {
    this.log(`Fetch project files: ${options.modId}`)
    const param = new URLSearchParams()
    if (options.gameVersion) {
      param.append('gameVersion', options.gameVersion)
    }
    if (options.modLoaderType) {
      param.append('modLoaderType', options.modLoaderType.toString())
    }
    if (options.gameVersionTypeId) {
      param.append('gameVersionTypeId', options.gameVersionTypeId.toString())
    }
    if (options.index) {
      param.append('index', options.index.toString())
    }
    if (options.pageSize) {
      param.append('pageSize', options.pageSize.toString())
    }
    const result: { data: File[]; pagination: Pagination } = await this.client.get(`v1/mods/${options.modId}/files?${param.toString()}`).json()
    return result
  }

  @Singleton((a, b) => `${a}-${b}`)
  async fetchProjectFile(projectId: number, fileId: number) {
    this.log(`Fetch project file: ${projectId}-${fileId}`)
    const result: { data: File } = await this.client.get(`v1/mods/${projectId}/files/${fileId}`).json()
    return result.data
  }

  async fetchModFiles(fileIds: number[]) {
    this.log(`Fetch profile ${fileIds.length} files.`)
    const result: { data: File[] } = await this.client.post('v1/mods/files', {
      body: JSON.stringify({ fileIds }),
      headers: {
        'Content-Type': 'application/json',
      },
      retry: {
        limit: 3,
        calculateDelay: ({ attemptCount }) => attemptCount * 1000,
      },
    }).json()
    return result.data
  }

  async searchProjects(searchOptions: SearchOptions) {
    const params = new URLSearchParams()
    params.append('gameId', '432')
    if (searchOptions.classId) {
      params.append('classId', searchOptions.classId?.toString() ?? '')
    }
    if (searchOptions.categoryId) {
      params.append('categoryId', searchOptions.categoryId?.toString() ?? '')
    }
    if (searchOptions.gameVersion) {
      params.append('gameVersion', searchOptions.gameVersion ?? '')
    }
    if (searchOptions.searchFilter) {
      params.append('searchFilter', searchOptions.searchFilter ?? '')
    }
    if (searchOptions.sortField) {
      params.append('sortField', searchOptions.sortField?.toString() ?? ModsSearchSortField.Featured.toString())
    }
    if (searchOptions.sortOrder) {
      params.append('sortOrder', searchOptions.sortOrder ?? 'desc')
    } else {
      params.append('sortOrder', 'desc')
    }
    if (searchOptions.modLoaderType) {
      params.append('modLoaderType', searchOptions.modLoaderType?.toString() ?? '0')
    }
    if (searchOptions.gameVersionTypeId) {
      params.append('gameVersionTypeId', searchOptions.gameVersionTypeId?.toString() ?? '')
    }
    if (searchOptions.slug) {
      params.append('slug', searchOptions.slug ?? '')
    }
    if (searchOptions.index) {
      params.append('index', searchOptions.index?.toString() ?? '0')
    }
    if (searchOptions.pageSize) {
      params.append('pageSize', searchOptions.pageSize?.toString() ?? '25')
    }
    const search = params.toString()
    this.log(`Search project: ${search}`)
    const result: { data: Mod[]; pagination: Pagination } = await this.client.get('v1/mods/search', {
      searchParams: search,
    }).json()
    return result
  }

  async installFile({ file, type, projectId, instancePath }: InstallFileOptions): Promise<InstallFileResult> {
    requireString(type)
    requireObject(file)
    const typeToDomain: Record<ProjectType, ResourceDomain> = {
      'mc-mods': ResourceDomain.Mods,
      'texture-packs': ResourceDomain.ResourcePacks,
      worlds: ResourceDomain.Saves,
      modpacks: ResourceDomain.Modpacks,
    }
    const urls = [`curseforge:${projectId}:${file.id}`]
    if (file.downloadUrl) {
      urls.push(file.downloadUrl)
    } else {
      urls.push(...guessCurseforgeFileUrl(file.id, file.fileName))
    }
    this.log(`Try install file ${file.displayName}(${file.downloadUrl}) in type ${type}`)
    const resourceService = this.resourceService
    const networkManager = this.networkManager
    try {
      const destination = join(this.app.temporaryPath, file.fileName)
      const project = await this.fetchProject(projectId)
      const dependencies = await Promise.all(file.dependencies.map(async (dep) => {
        if (dep.relationType <= 4) {
          let gameVersion = ''
          let modLoaderType: FileModLoaderType = FileModLoaderType.Any
          if (file.sortableGameVersions) {
            for (const ver of file.sortableGameVersions) {
              if (ver.gameVersion) {
                gameVersion = ver.gameVersion
              } else if (ver.gameVersionName === 'Forge') {
                modLoaderType = FileModLoaderType.Forge
              } else if (ver.gameVersionName === 'Fabric') {
                modLoaderType = FileModLoaderType.Fabric
              } else if (ver.gameVersionName === 'Quilt') {
                modLoaderType = FileModLoaderType.Quilt
              } else if (ver.gameVersionName === 'LiteLoader') {
                modLoaderType = FileModLoaderType.LiteLoader
              }
            }
          }
          try {
            const files = await this.fetchProjectFiles({
              gameVersion,
              modLoaderType,
              modId: dep.modId,
              pageSize: 1,
            })
            if (files.data[0]) {
              return await this.installFile({ file: files.data[0], type: 'mc-mods', projectId: dep.modId, instancePath })
            } else {
              this.warn(`Skip to install project file ${projectId}:${file.id} dependency ${file.modId} as no mod files matched!`)
            }
          } catch (e) {
            this.warn(`Fail to install project file ${projectId}:${file.id} dependency ${file.modId} as no mod files matched!`)
            this.warn(e)
          }
        }
        return undefined
      }))

      let resource = this.resourceService.getOneResource({ url: urls })
      if (resource) {
        this.log(`The curseforge file ${file.displayName}(${file.downloadUrl}) existed in cache!`)
      } else {
        const imageUrl = project.logo?.thumbnailUrl
        const task = new DownloadTask({
          ...networkManager.getDownloadBaseOptions(),
          url: file.downloadUrl ?? guessCurseforgeFileUrl(file.id, file.fileName),
          destination,
        }).setName('installCurseforgeFile')
        const promise = this.submit(task)
        this.state.curseforgeDownloadFileStart({ fileId: file.id, taskId: this.taskManager.getTaskUUID(task) })
        await promise
        const imported = await resourceService.importResource({
          resources: [{
            path: destination,
            uri: urls,
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

      if (instancePath) {
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
