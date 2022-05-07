import { AddonInfo, File, getAddonDatabaseTimestamp, getAddonDescription, getAddonFiles, getAddonInfo, getCategories, getCategoryTimestamp, GetFeaturedAddonOptions, getFeaturedAddons, searchAddons, SearchOptions } from '@xmcl/curseforge'
import { createDefaultCurseforgeQuery, DownloadTask } from '@xmcl/installer'
import { CurseForgeService as ICurseForgeService, CurseForgeServiceKey, CurseforgeState, InstallFileOptions, ProjectType } from '@xmcl/runtime-api'
import { basename, join } from 'path'
import { URL } from 'url'
import LauncherApp from '../app/LauncherApp'
import { getCurseforgeSourceInfo } from '../entities/resource'
import { compareDate, requireObject, requireString } from '../util/object'
import { isValidateUrl } from '../util/url'
import { ResourceService } from './ResourceService'
import { Inject, Singleton, StatefulService } from './Service'

export class CurseForgeService extends StatefulService<CurseforgeState> implements ICurseForgeService {
  private projectTimestamp = ''

  private projectCache: Record<number, AddonInfo> = {}

  private projectDescriptionCache: Record<number, string> = {}

  private projectFilesCache: Record<number, File[]> = {}

  private searchProjectCache: Record<string, AddonInfo[]> = {}

  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, CurseForgeServiceKey, () => new CurseforgeState())
  }

  private async fetchOrGetFromCache<K extends string | number, V>(cacheName: string, cache: Record<K, V>, key: K, query: () => Promise<V>) {
    const timestamp = await getAddonDatabaseTimestamp({ userAgent: this.networkManager.agents.https })
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
    const timestamp = await getCategoryTimestamp({ userAgent: this.networkManager.agents.https })
    if (this.state.categories.length === 0 ||
      new Date(timestamp) > new Date(this.state.categoriesTimestamp)) {
      let cats = await getCategories({ userAgent: this.networkManager.agents.https })
      cats = cats.filter((c) => c.gameId === 432)
      this.state.curseforgeCategories({ categories: cats, timestamp })
    }
  }

  @Singleton(v => v.toString())
  async fetchProject(projectId: number) {
    this.log(`Fetch project: ${projectId}`)
    return this.fetchOrGetFromCache('project', this.projectCache, projectId, () => getAddonInfo(projectId, { userAgent: this.networkManager.agents.https }))
  }

  @Singleton(v => v.toString())
  fetchProjectDescription(projectId: number) {
    this.log(`Fetch project description: ${projectId}`)
    return this.fetchOrGetFromCache('project description', this.projectDescriptionCache, projectId, () => getAddonDescription(projectId, { userAgent: this.networkManager.agents.https }))
  }

  @Singleton(v => v.toString())
  fetchProjectFiles(projectId: number) {
    this.log(`Fetch project files: ${projectId}`)
    return this.fetchOrGetFromCache('project files', this.projectFilesCache, projectId, () => getAddonFiles(projectId, { userAgent: this.networkManager.agents.https }).then(files => files.sort((a, b) => compareDate(new Date(b.fileDate), new Date(a.fileDate)))))
  }

  async searchProjects(searchOptions: SearchOptions) {
    this.log(`Search project: section=${searchOptions.sectionId}, category=${searchOptions.categoryId}, keyword=${searchOptions.searchFilter}`)
    const addons = await this.fetchOrGetFromCache('project search', this.searchProjectCache, JSON.stringify(searchOptions), () => searchAddons(searchOptions, { userAgent: this.networkManager.agents.https }))
    for (const addon of addons) {
      this.projectCache[addon.id] = addon
    }
    return addons
  }

  fetchFeaturedProjects(getOptions: GetFeaturedAddonOptions) {
    return getFeaturedAddons(getOptions, { userAgent: this.networkManager.agents.https })
  }

  async resolveCurseforgeDownloadUrl(projectId: number, fileId: number) {
    const getCurseforgeUrl = createDefaultCurseforgeQuery(this.networkManager.agents.https)
    const ensureDownloadUrl = async (proj: number, file: number) => {
      for (let i = 0; i < 3; ++i) {
        const result = await getCurseforgeUrl(proj, file)
        if (isValidateUrl(result)) {
          return result
        }
      }
      throw new Error(`Fail to ensure curseforge url ${proj}, ${file}`)
    }
    return ensureDownloadUrl(projectId, fileId)
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
      const project = await this.fetchProject(projectId)
      const imageUrl = project.attachments[0]?.thumbnailUrl
      const task = new DownloadTask({
        ...networkManager.getDownloadBaseOptions(),
        url: file.downloadUrl,
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
      return result
    } finally {
      this.state.curseforgeDownloadFileEnd(file.id)
    }
  }
}
