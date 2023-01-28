import { File, FileModLoaderType, FileRelationType, SearchOptions } from '@xmcl/curseforge'
import { DownloadTask } from '@xmcl/installer'
import { CurseForgeService as ICurseForgeService, CurseForgeServiceKey, getCurseforgeFileUri, GetModFilesOptions, InstallFileOptions, InstallFileResult, ProjectType, ResourceDomain } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { join } from 'path'
import { Client } from 'undici'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { CurseforgeClient } from '../clients/CurseforgeClient'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { isNonnull, requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

@ExposeServiceKey(CurseForgeServiceKey)
export class CurseForgeService extends AbstractService implements ICurseForgeService {
  readonly client: CurseforgeClient

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)

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

  getFileChangelog(file: Pick<File, 'modId' | 'id'>): Promise<string> {
    return this.client.getFileChangelog(file.modId, file.id)
  }

  @Singleton()
  async fetchCategories() {
    return await this.client.getCategories()
  }

  @Singleton(v => v.toString())
  async getMod(projectId: number) {
    this.log(`Fetch project: ${projectId}`)
    return await this.client.getMod(projectId)
  }

  @Singleton(v => v.toString())
  async getModDescription(projectId: number) {
    this.log(`Fetch project description: ${projectId}`)
    return await this.client.getModDescription(projectId)
  }

  @Singleton(v => v.modId)
  async getModFiles(options: GetModFilesOptions) {
    this.log(`Fetch project files: ${options.modId}`)
    return await this.client.getModFiles(options)
  }

  @Singleton((p) => `${p.modId}-${p.fileId}`)
  async getModFile({ modId, fileId }: { modId: number; fileId: number }) {
    this.log(`Fetch project file: ${modId}-${fileId}`)
    return await this.client.getModFile(modId, fileId)
  }

  async getModsByIds(modIds: number[]) {
    this.log(`Fetch mods ${modIds.length} files.`)
    return await this.client.getMods(modIds)
  }

  async getModFilesByIds(fileIds: number[]) {
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
              const files = await this.getModFiles({
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

  @Singleton((o) => o.file.id)
  async installFile({ file, type, instancePath, ignoreDependencies }: InstallFileOptions): Promise<InstallFileResult> {
    requireString(type)
    requireObject(file)

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
      downloadUrls.push(...guessCurseforgeFileUrl(file.id, file.fileName))
    }
    uris.push(...downloadUrls)
    this.log(`Try install file ${file.displayName}(${file.downloadUrl}) in type ${type}`)
    const resourceService = this.resourceService
    const networkManager = this.networkManager
    const destination = join(this.app.temporaryPath, file.fileName)
    const project = await this.getMod(file.modId)
    let dependencies: InstallFileResult[] = []
    if (ignoreDependencies || type === 'modpacks') {
      dependencies = []
    } else {
      const deps = await this.resolveFileDependencies(file)
      dependencies = await Promise.all(deps.map(async ([file, relation]) => {
        if (relation === 3) {
          return await this.installFile({ file, type, instancePath, ignoreDependencies: true })
        } else {
          // Not enable by default
          return await this.installFile({ file, type, ignoreDependencies: true })
        }
      }))
    }

    const domain = typeToDomain[type] ?? ResourceDomain.Unclassified
    let resource = (await this.resourceService.getResourcesByUris(uris)).reduce((a, b) => a || b, undefined)
    if (resource) {
      this.log(`The curseforge file ${file.displayName}(${file.downloadUrl}) existed in cache!`)
    } else {
      const task = new DownloadTask({
        ...networkManager.getDownloadBaseOptions(),
        url: downloadUrls,
        destination,
      }).setName('installCurseforgeFile', { fileId: file.id })
      await this.submit(task)

      const icons = project.logo?.thumbnailUrl ? [project.logo.thumbnailUrl] : []
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

    if (instancePath && resource.domain !== ResourceDomain.Modpacks) {
      resource.path = resource.storedPath!
      resource.domain = domain
      await this.resourceService.install({ instancePath, resource })
    }

    return {
      file,
      mod: project,
      resource,
      dependencies: dependencies.filter(isNonnull),
    }
  }
}
