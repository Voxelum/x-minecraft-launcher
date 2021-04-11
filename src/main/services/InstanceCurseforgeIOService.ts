import { createDefaultCurseforgeQuery, installCurseforgeModpackTask, readManifestTask } from '@xmcl/installer'
import { task } from '@xmcl/task'
import { ensureDir, rename } from 'fs-extra'
import { basename, dirname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import InstanceResourceService from './InstanceResourceService'
import InstanceService from './InstanceService'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject } from './Service'
import { getCurseforgeUrl } from '/@main/entities/resource'
import { isFile } from '/@main/util/fs'
import { ZipTask } from '/@main/util/zip'
import { CurseforgeModpackManifest } from '/@shared/entities/curseforge'
import { Exception } from '/@shared/entities/exception'
import { NO_RESOURCE } from '/@shared/entities/resource'
import { ExportCurseforgeModpackOptions, ImportCurseforgeModpackOptions, InstanceCurseforgeIOService as IInstanceCurseforgeIOService, InstanceCurseforgeIOServiceKey } from '/@shared/services/InstanceCurseforgeIOServic'
import { EditInstanceOptions } from '/@shared/services/InstanceService'
import { isNonnull, requireObject } from '/@shared/util/assert'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExportService(InstanceCurseforgeIOServiceKey)
export default class InstanceCurseforgeIOService extends AbstractService implements IInstanceCurseforgeIOService {
  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceResourceService) private instanceResourceService: InstanceResourceService,
  ) {
    super(app)
  }

  /**
   * Export the instance as an curseforge modpack
   * @param options The curseforge modpack export options
   */
  async exportCurseforgeModpack(options: ExportCurseforgeModpackOptions) {
    requireObject(options)

    const { instancePath = this.state.instance.path, destinationPath, overrides, name, version, gameVersion, author } = options

    if (!this.state.instance.all[instancePath]) {
      this.warn(`Cannot export unmanaged instance ${instancePath}`)
      return
    }

    const ganeVersionInstance = this.state.version.local.find(v => v.id === gameVersion)
    const instance = this.state.instance.all[instancePath]
    const modLoaders = instance.runtime.forge ? [{
      id: `forge-${instance.runtime.forge}`,
      primary: true,
    }] : []
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

    // for (const file of overrides) {
    //   if (file.startsWith('mods/')) {
    //     const mod = this.state.instanceResource.mods.find((i) => (i.location.replace('\\', '/') + i.ext) === file)
    //     if (mod && mod.curseforge) {
    //       curseforgeConfig.files.push({ projectID: mod.curseforge.projectId, fileID: mod.curseforge.fileId, required: true })
    //     } else {
    //       zipTask.addFile(join(instancePath, file), `overrides/${file}`)
    //     }
    //   } else if (file.startsWith('resourcepacks/')) {
    //     const resourcepack = this.state.instanceResource.resourcepacks.find((i) => (i.location.replace('\\', '/') + i.ext) === file)
    //     if (resourcepack && resourcepack.curseforge) {
    //       curseforgeConfig.files.push({ projectID: resourcepack.curseforge.projectId, fileID: resourcepack.curseforge.fileId, required: true })
    //     } else {
    //       zipTask.addFile(join(instancePath, file), `overrides/${file}`)
    //     }
    //   } else {
    //     zipTask.addFile(join(instancePath, file), `overrides/${file}`)
    //   }
    // }

    this.log(`Export instance ${instancePath} to curseforge ${JSON.stringify(curseforgeConfig, null, 4)}`)

    zipTask.addBuffer(Buffer.from(JSON.stringify(curseforgeConfig)), 'manifest.json')

    await this.submit(zipTask)
  }

  /**
   * Import the curseforge modpack zip file to the instance.
   * @param options The options provide instance directory path and curseforge modpack zip path
   */
  async importCurseforgeModpack(options: ImportCurseforgeModpackOptions) {
    let { path, instancePath } = options

    if (!await isFile(path)) {
      throw new Exception({ type: 'requireCurseforgeModpackAFile', path }, `Cannot import curseforge modpack ${path}, since it's not a file!`)
    }

    this.log(`Import curseforge modpack by path ${path}`)
    const { instanceResourceService, log, resourceService, instanceService } = this
    const installCurseforgeModpack = task('installCurseforgeModpack', async function () {
      const manifest = await this.yield(readManifestTask(path)).catch(() => {
        throw new Exception({ type: 'invalidCurseforgeModpack', path })
      })

      const forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'))

      const config: EditInstanceOptions = {
        runtime: {
          minecraft: manifest.minecraft.version,
          forge: forgeId ? forgeId.id.substring(6) : '',
          liteloader: '',
          fabricLoader: '',
          yarn: '',
        },
      }

      if (instancePath) {
        await instanceService.editInstance({
          instancePath,
          ...config,
        })
      } else {
        instancePath = await instanceService.createInstance({
          name: manifest.name,
          author: manifest.author,
          ...config,
        })
      }

      // deploy existed resources
      const filesToDeploy = manifest.files
        .map((f) => resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID)))
        .filter(isNonnull)
      await ensureDir(join(instancePath, 'mods'))
      await ensureDir(join(instancePath, 'resourcepacks'))
      log(`Deploy ${filesToDeploy.length} existed resources from curseforge modpack!`)
      await instanceResourceService.deploy({ resources: filesToDeploy, path: instancePath })

      // filter out existed resources
      manifest.files = manifest.files.filter((f) => !resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID)))

      const files: Array<{ path: string; projectID: number; fileID: number; url: string }> = []
      const defaultQuery = createDefaultCurseforgeQuery()

      log(`Install ${manifest.files.length} files from curseforge modpack!`)

      await this.concat(installCurseforgeModpackTask(path, instancePath, {
        manifest,
        async queryFileUrl(projectId: number, fileId: number) {
          const result = await defaultQuery(projectId, fileId)
          files.push({ path: '', projectID: projectId, fileID: fileId, url: result })
          return result
        },
        filePathResolver(p, f, m, u) {
          const path = m.getMod(basename(u))
          files.find(fi => fi.fileID === f)!.path = path
          return path
        },
      }))

      if (manifest.files.length > 0) {
        const resources = await resourceService.importFiles({
          files: files.map((f) => ({
            path: f.path,
            url: [f.url, getCurseforgeUrl(f.projectID, f.fileID)],
            source: {
              curseforge: { projectId: f.projectID, fileId: f.fileID },
            },
          })),
        })
        const mapping: Record<string, string> = {}
        for (const file of files) {
          mapping[`${file.projectID}:${file.fileID}`] = file.path
        }
        // rename the resource to correct name
        for (const res of resources.filter(r => r !== NO_RESOURCE)) {
          const path = mapping[`${res.curseforge!.projectId}:${res.curseforge!.fileId}`]
          const realName = basename(res.location) + res.ext
          const realPath = dirname(path) + realName
          await rename(path, realPath)
        }
      }

      return instancePath
    })
    return this.submit(installCurseforgeModpack)
  }
}
