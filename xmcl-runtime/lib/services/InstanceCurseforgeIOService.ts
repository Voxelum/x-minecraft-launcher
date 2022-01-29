import { createDefaultCurseforgeQuery, installCurseforgeModpackTask, readManifest } from '@xmcl/installer'
import { CurseforgeModpackManifest, EditGameSettingOptions, EditInstanceOptions, Exception, ExportCurseforgeModpackOptions, ImportCurseforgeModpackOptions, InstanceCurseforgeIOService as IInstanceCurseforgeIOService, InstanceCurseforgeIOServiceKey, isResourcePackResource, NO_RESOURCE, ResourceDomain, ResourceType, write } from '@xmcl/runtime-api'
import { isNonnull, requireObject } from '@xmcl/runtime-api/utils'
import { existsSync } from 'fs'
import { ensureDir, rename, unlink } from 'fs-extra'
import { basename, dirname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { getCurseforgeUrl } from '../entities/resource'
import { isFile } from '../util/fs'
import { ZipTask } from '../util/zip'
import InstanceModsService from './InstanceModsService'
import InstanceOptionsService from './InstanceOptionsService'
import InstanceService from './InstanceService'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject } from './Service'
import VersionService from './VersionService'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExportService(InstanceCurseforgeIOServiceKey)
export default class InstanceCurseforgeIOService extends AbstractService implements IInstanceCurseforgeIOService {
  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(InstanceModsService) private instanceModsService: InstanceModsService,
    @Inject(InstanceOptionsService) private instanceOptionsService: InstanceOptionsService,
  ) {
    super(app)
  }

  /**
   * Export the instance as an curseforge modpack
   * @param options The curseforge modpack export options
   */
  async exportCurseforgeModpack(options: ExportCurseforgeModpackOptions) {
    requireObject(options)

    const { instancePath = this.instanceService.state.path, destinationPath, overrides, name, version, gameVersion, author } = options

    if (!this.instanceService.state.all[instancePath]) {
      this.warn(`Cannot export unmanaged instance ${instancePath}`)
      return
    }

    const ganeVersionInstance = this.versionService.state.local.find(v => v.id === gameVersion)
    const instance = this.instanceService.state.all[instancePath]
    const modLoaders = instance.runtime.forge
      ? [{
        id: `forge-${instance.runtime.forge}`,
        primary: true,
      }]
      : (instance.runtime.fabricLoader
        ? [{
          id: `fabric-${instance.runtime.fabricLoader}`,
          primary: true,
        }]
        : [])

    const curseforgeConfig: CurseforgeModpackManifest = {
      manifestType: 'minecraftModpack',
      manifestVersion: 1,
      minecraft: {
        version: ganeVersionInstance?.minecraftVersion ?? instance.runtime.minecraft,
        modLoaders,
      },
      name: options.name ?? name,
      version,
      author: author ?? instance.author,
      files: [],
      overrides: 'overrides',
    }

    const zipTask = new ZipTask(destinationPath)

    zipTask.addEmptyDirectory('overrides')

    for (const file of overrides) {
      if (file.startsWith('mods/')) {
        const mod = this.resourceService.state.mods.find((i) => (i.domain + '/' + i.fileName + i.ext) === file)
        if (mod && mod.curseforge) {
          curseforgeConfig.files.push({ projectID: mod.curseforge.projectId, fileID: mod.curseforge.fileId, required: true })
        } else {
          zipTask.addFile(join(instancePath, file), `overrides/${file}`)
        }
      } else if (file.startsWith('resourcepacks/')) {
        const resourcepack = this.resourceService.state.resourcepacks.find((i) => (i.domain + '/' + i.fileName + i.ext) === file)
        if (resourcepack && resourcepack.curseforge) {
          curseforgeConfig.files.push({ projectID: resourcepack.curseforge.projectId, fileID: resourcepack.curseforge.fileId, required: true })
        } else {
          zipTask.addFile(join(instancePath, file), `overrides/${file}`)
        }
      } else {
        zipTask.addFile(join(instancePath, file), `overrides/${file}`)
      }
    }

    this.log(`Export instance ${instancePath} to curseforge ${JSON.stringify(curseforgeConfig, null, 4)}`)

    zipTask.addBuffer(Buffer.from(JSON.stringify(curseforgeConfig)), 'manifest.json')

    await this.submit(zipTask)
  }

  /**
   * Import the curseforge modpack zip file to the instance.
   * @param options The options provide instance directory path and curseforge modpack zip path
   */
  async importCurseforgeModpack(options: ImportCurseforgeModpackOptions) {
    const { path } = options

    if (!await isFile(path)) {
      throw new Exception({ type: 'requireCurseforgeModpackAFile', path }, `Cannot import curseforge modpack ${path}, since it's not a file!`)
    }

    this.log(`Import curseforge modpack by path ${path}`)
    const { instanceModsService, log, resourceService, instanceService } = this
    const manifest = await readManifest(path).catch(() => {
      throw new Exception({ type: 'invalidCurseforgeModpack', path })
    })

    const forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'))
    const fabricId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('fabric'))

    const config: EditInstanceOptions = {
      runtime: {
        minecraft: manifest.minecraft.version,
        forge: forgeId ? forgeId.id.substring(6) : '',
        liteloader: '',
        fabricLoader: fabricId ? fabricId.id.substring(7) : '',
        yarn: '',
      },
    }

    let instancePath: string
    if ('instancePath' in options) {
      await instanceService.editInstance({
        instancePath: options.instancePath,
        ...config,
      })
      instancePath = options.instancePath
    } else {
      instancePath = await instanceService.createInstance({
        name: manifest.name,
        author: manifest.author,
        ...config,
        ...options.instanceConfig,
      })
    }

    const lock = this.semaphoreManager.getLock(write(instancePath))
    return lock.write(async () => {
      // deploy existed resources
      const existedResources = manifest.files
        .map((f) => resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID)))
        .filter(isNonnull)

      const resourcePacksMapping: Record<string, string> = existedResources
        .filter(r => isResourcePackResource(r)).map((r) => {
          const cfUri = r.uri.find(u => u.startsWith('https://edge.forgecdn.net'))
          if (cfUri) {
            return [r.fileName + r.ext, basename(cfUri)] as const
          }
          return [r.fileName + r.ext, r.name + r.ext] as const
        }).reduce((o, v) => ({ ...o, [v[1]]: v[0] }), {})

      const modsToDeploy = existedResources
        .filter(r => r.domain === ResourceDomain.Mods)
      await ensureDir(join(instancePath, 'mods'))
      log(`Deploy ${modsToDeploy.length} existed resources from curseforge modpack!`)

      await instanceModsService.install({ mods: modsToDeploy, path: instancePath })

      // filter out existed resources
      manifest.files = manifest.files.filter((f) => !resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID)))

      const files: Array<{ path: string; projectID: number; fileID: number; url: string }> = []
      const defaultQuery = createDefaultCurseforgeQuery()

      log(`Install ${manifest.files.length} files from curseforge modpack!`)

      await this.submit(installCurseforgeModpackTask(path, instancePath, {
        manifest,
        async queryFileUrl(projectId: number, fileId: number) {
          const result = await defaultQuery(projectId, fileId)
          files.push({ path: '', projectID: projectId, fileID: fileId, url: result })
          return result
        },
        filePathResolver(p, f, m, u) {
          const path = m.getMod(basename(u))
          console.log(path)
          files.find(fi => fi.fileID === f)!.path = path
          return path
        },
      }))

      if (manifest.files.length > 0) {
        const resources = await resourceService.importResources({
          files: files.map((f) => ({
            path: f.path,
            url: [f.url, getCurseforgeUrl(f.projectID, f.fileID)],
            source: {
              curseforge: { projectId: f.projectID, fileId: f.fileID },
            },
          })),
          background: true,
        })
        const mapping: Record<string, string> = {}
        for (const file of files) {
          mapping[`${file.projectID}:${file.fileID}`] = file.path
        }
        // rename the resource to correct name
        for (const res of resources.filter(r => r !== NO_RESOURCE)) {
          const path = mapping[`${res.curseforge!.projectId}:${res.curseforge!.fileId}`]
          if (res.type === ResourceType.ResourcePack) {
            this.log(`Clean the resource pack ${res.fileName} from /mods`)
            await unlink(path)
            const fileName = basename(path)
            resourcePacksMapping[fileName] = res.fileName + res.ext
            continue
          }
          const realName = res.fileName + res.ext
          const realPath = join(dirname(path), realName)
          await rename(path, realPath)
        }
      }

      const optionsPath = join(instancePath, 'options.txt')
      if (existsSync(optionsPath) && Object.keys(resourcePacksMapping).length > 0) {
        this.log(`Remap options.txt resource pack name for ${Object.keys(resourcePacksMapping).length} packs`)
        const options = await this.instanceOptionsService.getGameOptions(instancePath)
        const editOptions: EditGameSettingOptions = {
          instancePath,
        }
        if (options.resourcePacks) {
          editOptions.resourcePacks = options.resourcePacks.map(fileName => resourcePacksMapping[fileName] ?? fileName)
        }
        if (options.incompatibleResourcePacks) {
          editOptions.incompatibleResourcePacks = options.incompatibleResourcePacks.map(fileName => resourcePacksMapping[fileName] ?? fileName)
        }
        await this.instanceOptionsService.editGameSetting(editOptions)
      }

      return instancePath
    })
  }
}
