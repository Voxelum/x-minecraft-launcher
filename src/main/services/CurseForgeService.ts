import { AddonInfo, File, getAddonDatabaseTimestamp, getAddonDescription, getAddonFiles, getAddonInfo, getCategories, getCategoryTimestamp, GetFeaturedAddonOptions, getFeaturedAddons, searchAddons, SearchOptions } from '@xmcl/curseforge'
import { DownloadTask } from '@xmcl/installer'
import { task } from '@xmcl/task'
import { Agent } from 'https'
import { basename, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject, Singleton } from './Service'
import { getCurseforgeSourceInfo } from '/@main/entities/resource'
import { ProjectType } from '/@shared/entities/curseforge'
import { CurseForgeService as ICurseForgeService, CurseForgeServiceKey, InstallFileOptions } from '/@shared/services/CurseForgeService'
import { requireObject, requireString } from '/@shared/util/assert'
import { compareDate } from '/@shared/util/object'

@ExportService(CurseForgeServiceKey)
export default class CurseForgeService extends AbstractService implements ICurseForgeService {
  private userAgent: Agent = new Agent({ keepAlive: true })

  private projectTimestamp = ''

  private projectCache: Record<number, AddonInfo> = {}

  private projectDescriptionCache: Record<number, string> = {}

  private projectFilesCache: Record<number, File[]> = {}

  private searchProjectCache: Record<string, AddonInfo[]> = {}

  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)
  }

  private async fetchOrGetFromCache<K extends string | number, V>(cacheName: string, cache: Record<K, V>, key: K, query: () => Promise<V>) {
    const timestamp = await getAddonDatabaseTimestamp({ userAgent: this.userAgent })
    if (!cache[key] || new Date(timestamp) > new Date(this.projectTimestamp)) {
      const value = await query()
      this.projectTimestamp = timestamp
      cache[key] = value
      this.log(`Cache missed for ${key} in ${cacheName}`)
      return value
    }
    this.log(`Cache hit for ${key} in ${cacheName}`)
    return cache[key]
  }

  @Singleton()
  async loadCategories() {
    const timestamp = await getCategoryTimestamp({ userAgent: this.userAgent })
    if (this.state.curseforge.categories.length === 0 ||
      new Date(timestamp) > new Date(this.state.curseforge.categoriesTimestamp)) {
      let cats = await getCategories({ userAgent: this.userAgent })
      cats = cats.filter((c) => c.rootGameCategoryId === null && c.gameId === 432)
      this.commit('curseforgeCategories', { categories: cats, timestamp })
    }
  }

  @Singleton((projectId: number) => `cfproject-${projectId.toString()}`)
  async fetchProject(projectId: number) {
    this.log(`Fetch project: ${projectId}`)
    return this.fetchOrGetFromCache('project', this.projectCache, projectId, () => getAddonInfo(projectId, { userAgent: this.userAgent }))
  }

  @Singleton((projectId: number) => `cfdescription-${projectId.toString()}`)
  fetchProjectDescription(projectId: number) {
    this.log(`Fetch project description: ${projectId}`)
    return this.fetchOrGetFromCache('project description', this.projectDescriptionCache, projectId, () => getAddonDescription(projectId, { userAgent: this.userAgent }))
  }

  @Singleton((projectId: number) => `cffiles-${projectId.toString()}`)
  fetchProjectFiles(projectId: number) {
    this.log(`Fetch project files: ${projectId}`)
    return this.fetchOrGetFromCache('project files', this.projectFilesCache, projectId, () => getAddonFiles(projectId, { userAgent: this.userAgent }).then(files => files.sort((a, b) => compareDate(new Date(b.fileDate), new Date(a.fileDate)))))
  }

  async searchProjects(searchOptions: SearchOptions) {
    this.log(`Search project: section=${searchOptions.sectionId}, category=${searchOptions.categoryId}, keyword=${searchOptions.searchFilter}`)
    const addons = await this.fetchOrGetFromCache('project search', this.searchProjectCache, JSON.stringify(searchOptions), () => searchAddons(searchOptions, { userAgent: this.userAgent }))
    for (const addon of addons) {
      this.projectCache[addon.id] = addon
    }
    return addons
  }

  fetchFeaturedProjects(getOptions: GetFeaturedAddonOptions) {
    return getFeaturedAddons(getOptions, { userAgent: this.userAgent })
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
      const destination = join(this.app.temporaryPath, basename(file.downloadUrl))
      const task = new DownloadTask({
        ...networkManager.getDownloadBaseOptions(),
        url: file.downloadUrl,
        destination,
      }).setName('installCurseforgeFile')
      const promise = this.submit(task)
      this.commit('curseforgeDownloadFileStart', { fileId: file.id, taskId: this.taskManager.getTaskUUID(task) })
      await promise
      const result = await resourceService.importFile({
        path: destination,
        url: urls,
        source: getCurseforgeSourceInfo(projectId, file.id),
        type: typeHints[type],
        background: true,
      })
      this.log(`Install curseforge file ${file.displayName}(${file.downloadUrl}) success!`)
      return result
    } finally {
      this.commit('curseforgeDownloadFileEnd', file.id)
    }
  }
}
