import { AddonInfo, File, ModsSearchSortField, Pagination, ProjectCategory, SearchOptions } from '@xmcl/curseforge'
import { DownloadTask } from '@xmcl/installer'
import { CurseForgeService as ICurseForgeService, CurseForgeServiceKey, CurseforgeState, GetModFilesOptions, InstallFileOptions, ProjectType } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { join } from 'path'
import { URLSearchParams } from 'url'
import LauncherApp from '../app/LauncherApp'
import { getCurseforgeSourceInfo } from '../entities/resource'
import { PersistFileCache } from '../util/cache'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { requireObject, requireString } from '../util/object'
import { ResourceService } from './ResourceService'
import { Inject, Singleton, StatefulService } from './Service'

export class CurseForgeService extends StatefulService<CurseforgeState> implements ICurseForgeService {
  private client = this.networkManager.request.extend({
    prefixUrl: 'https://api.curseforge.com',
    headers: {
      Accept: 'application/json',
      'x-api-key': process.env.CURSEFORGE_API_KEY,
    },
    cache: new PersistFileCache(this.getAppDataPath('curseforge-caches')),
  })

  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, CurseForgeServiceKey, () => new CurseforgeState())
  }

  @Singleton()
  async fetchCategories() {
    const categories: { data: ProjectCategory[] } = await this.client.get('v1/categories', { searchParams: { gameId: 432 } }).json()
    return categories.data
  }

  @Singleton(v => v.toString())
  async fetchProject(projectId: number) {
    this.log(`Fetch project: ${projectId}`)
    const result: { data: AddonInfo } = await this.client.get(`v1/mods/${projectId}`).json()
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
    const result: { data: File[]; pagination: Pagination } = await this.client.get(`v1/mods/${options.modId}/files`).json()
    return result
  }

  @Singleton((a, b) => `${a}-${b}`)
  async fetchProjectFile(projectId: number, fileId: number) {
    this.log(`Fetch project file: ${projectId}-${fileId}`)
    const result: { data: File } = await this.client.get(`v1/mods/${projectId}/files/${fileId}`).json()
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
    const result: { data: AddonInfo[]; pagination: Pagination } = await this.client.get('v1/mods/search', {
      searchParams: search,
    }).json()
    return result
  }

  async installFile({ file, type, projectId }: InstallFileOptions) {
    requireString(type)
    requireObject(file)
    const typeHints: Record<ProjectType, string> = {
      'mc-mods': 'mods',
      'texture-packs': 'resourcepack',
      worlds: 'save',
      modpacks: 'curseforge-modpack',
    }
    const urls = [file.downloadUrl, `curseforge://${projectId}/${file.id}`]
    this.log(`Try install file ${file.displayName}(${file.downloadUrl}) in type ${type}`)
    const resource = this.resourceService.getResource({ url: urls })
    if (resource) {
      this.log(`The curseforge file ${file.displayName}(${file.downloadUrl}) existed in cache!`)
      return resource
    }
    const resourceService = this.resourceService
    const networkManager = this.networkManager
    try {
      const destination = join(this.app.temporaryPath, file.fileName)
      const project = await this.fetchProject(projectId)
      const imageUrl = project.screenshots[0]?.thumbnailUrl
      const task = new DownloadTask({
        ...networkManager.getDownloadBaseOptions(),
        url: file.downloadUrl ?? guessCurseforgeFileUrl(file.id, file.fileName),
        destination,
      }).setName('installCurseforgeFile')
      const promise = this.submit(task)
      this.state.curseforgeDownloadFileStart({ fileId: file.id, taskId: this.taskManager.getTaskUUID(task) })
      await promise
      const result = await resourceService.importResource({
        path: destination,
        url: urls,
        source: getCurseforgeSourceInfo(projectId, file.id),
        iconUrl: imageUrl || undefined,
        type: typeHints[type],
        background: true,
      })
      this.log(`Install curseforge file ${file.displayName}(${file.downloadUrl}) success!`)
      await unlink(destination).catch(() => undefined)
      return result
    } finally {
      this.state.curseforgeDownloadFileEnd(file.id)
    }
  }
}
