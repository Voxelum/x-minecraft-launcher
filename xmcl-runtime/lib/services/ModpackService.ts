import { AnyPersistedResource, CurseforgeModpackManifest, EditGameSettingOptions, Exception, ExportModpackOptions, ImportModpackOptions, isResourcePackResource, McbbsModpackManifest, ModpackException, ModpackService as IModpackService, ModpackServiceKey, PersistedResource, ResourceDomain, write } from '@xmcl/runtime-api'
import { requireObject } from '../util/object'
import { open, readAllEntries } from '@xmcl/unzip'
import { existsSync } from 'fs'
import { ensureDir, remove, unlink, writeFile } from 'fs-extra'
import { basename, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { installModpackTask, ModpackInstallGeneralError, ModpackInstallUrlError, readMetadata, resolveInstanceOptions } from '../entities/modpack'
import { getCurseforgeUrl } from '../entities/resource'
import { FileStateWatcher, isFile, sha1ByPath } from '../util/fs'
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
@ExportService(ModpackServiceKey)
export default class ModpackService extends AbstractService implements IModpackService {
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
   * Export the instance as an modpack
   * @param options The modpack export options
   */
  async exportModpack(options: ExportModpackOptions) {
    requireObject(options)

    const { instancePath = this.instanceService.state.path, destinationPath, overrides, exportDirectives, name, version, gameVersion, author, emitCurseforge = true, emitMcbbs = true } = options

    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      this.warn(`Cannot export unmanaged instance ${instancePath}`)
      return
    }

    let curseforgeConfig: CurseforgeModpackManifest | undefined
    let mcbbsManifest: McbbsModpackManifest | undefined

    if (emitCurseforge) {
      const gameVersionInstance = this.versionService.state.local.find(v => v.id === gameVersion)
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

      curseforgeConfig = {
        manifestType: 'minecraftModpack',
        manifestVersion: 1,
        minecraft: {
          version: gameVersionInstance?.minecraftVersion ?? instance.runtime.minecraft,
          modLoaders,
        },
        name: name ?? instance.name,
        version,
        author: author ?? instance.author,
        files: [],
        overrides: 'overrides',
      }
    }

    if (emitMcbbs) {
      mcbbsManifest = {
        manifestType: 'minecraftModpack',
        manifestVersion: 2,
        description: instance.description,
        url: instance.url,
        name: name ?? instance.name,
        version,
        author: author ?? instance.author,
        files: [],
        launchInfo: {
          minMemory: instance.minMemory <= 0 ? undefined : instance.minMemory,
          launchArgument: instance.mcOptions,
          javaArgument: instance.vmOptions,
        },
        addons: [{ id: 'game', version: instance.runtime.minecraft }],
      }
      if (instance.runtime.forge) {
        mcbbsManifest.addons.push({ id: 'forge', version: instance.runtime.forge })
      }
      if (instance.runtime.fabricLoader) {
        mcbbsManifest.addons.push({ id: 'fabric', version: instance.runtime.fabricLoader })
      }
    }

    const zipTask = new ZipTask(destinationPath)

    zipTask.addEmptyDirectory('overrides')

    const directives: Record<string, 'curseforge' | 'modrinth'> = {}

    for (const dir of exportDirectives) {
      directives[dir.path] = dir.exportAs
    }

    for (const file of overrides) {
      const filePath = join(instancePath, file)
      if (file.startsWith('mods/')) {
        const mod = this.resourceService.state.mods.find((i) => (i.domain + '/' + i.fileName + i.ext) === file)
        if (mod && mod.curseforge && directives[file] === 'curseforge') {
          curseforgeConfig?.files.push({ projectID: mod.curseforge.projectId, fileID: mod.curseforge.fileId, required: true })
          mcbbsManifest?.files!.push({ projectID: mod.curseforge.projectId, fileID: mod.curseforge.fileId, type: 'curse', force: false })
        } else {
          zipTask.addFile(filePath, `overrides/${file}`)
          mcbbsManifest?.files!.push({ type: 'addon', force: false, path: file, hash: await sha1ByPath(filePath) })
        }
      } else if (file.startsWith('resourcepacks/')) {
        const resourcepack = this.resourceService.state.resourcepacks.find((i) => (i.domain + '/' + i.fileName + i.ext) === file)
        if (resourcepack && resourcepack.curseforge && directives[file] === 'curseforge') {
          curseforgeConfig?.files.push({ projectID: resourcepack.curseforge.projectId, fileID: resourcepack.curseforge.fileId, required: true })
          mcbbsManifest?.files!.push({ projectID: resourcepack.curseforge.projectId, fileID: resourcepack.curseforge.fileId, type: 'curse', force: false })
        } else {
          zipTask.addFile(filePath, `overrides/${file}`)
          mcbbsManifest?.files!.push({ type: 'addon', force: false, path: file, hash: await sha1ByPath(filePath) })
        }
      } else if (file !== 'options.txt') {
        zipTask.addFile(filePath, `overrides/${file}`)
        mcbbsManifest?.files!.push({ type: 'addon', force: false, path: file, hash: await sha1ByPath(filePath) })
      }
    }

    let tempOptions: string | undefined
    const optionsPath = join(instancePath, 'options.txt')
    if (existsSync(optionsPath) && overrides.find(f => f === 'options.txt')) {
      this.log(`Remap options.txt resource pack name for export ${instancePath}`)
      const options = await this.instanceOptionsService.getGameOptions(instancePath)

      const resourcePacksMapping: Record<string, string> = this.resourceService.state.resourcepacks
        .map((r) => {
          const cfUri = r.uri.find(u => u.startsWith('https://edge.forgecdn.net'))
          if (cfUri) {
            return [r.fileName + r.ext, basename(cfUri)] as const
          }
          return [r.fileName + r.ext, r.name + r.ext] as const
        }).reduce((o, v) => ({ ...o, [v[0]]: v[1] }), {})

      if (options.resourcePacks) {
        options.resourcePacks = options.resourcePacks.map(fileName => {
          const hasPrefix = fileName.startsWith('file/')
          const rawName = hasPrefix ? fileName.substring(5) : fileName
          if (resourcePacksMapping[rawName]) {
            return hasPrefix ? `file/${resourcePacksMapping[rawName]}` : resourcePacksMapping[rawName]
          }
          return fileName
        })
      }
      if (options.incompatibleResourcePacks) {
        options.incompatibleResourcePacks = options.incompatibleResourcePacks.map(fileName => {
          const hasPrefix = fileName.startsWith('file/')
          const rawName = hasPrefix ? fileName.substring(5) : fileName
          if (resourcePacksMapping[rawName]) {
            return hasPrefix ? `file/${resourcePacksMapping[rawName]}` : resourcePacksMapping[rawName]
          }
          return fileName
        })
      }

      const optionsText = Object.entries(options)
        .map(([k, v]) => typeof v !== 'string' ? `${k}:${JSON.stringify(v)}` : `${k}:${v}`)
        .join('\n') + '\n'

      tempOptions = this.getTempPath('options.txt')
      await writeFile(tempOptions, optionsText)
      zipTask.addFile(tempOptions, 'overrides/options.txt')
    }

    if (curseforgeConfig) {
      this.log(`Export instance ${instancePath} to curseforge ${JSON.stringify(curseforgeConfig, null, 4)}`)
      zipTask.addBuffer(Buffer.from(JSON.stringify(curseforgeConfig)), 'manifest.json')
    }

    if (mcbbsManifest) {
      this.log(`Export instance ${instancePath} to mcbbs ${JSON.stringify(mcbbsManifest, null, 4)}`)
      zipTask.addBuffer(Buffer.from(JSON.stringify(mcbbsManifest)), 'mcbbs.packmeta')
    }

    try {
      await this.submit(zipTask)
      this.instanceService.editInstance({ instancePath, modpackVersion: version })
    } finally {
      if (tempOptions) {
        await remove(tempOptions)
      }
    }
  }

  /**
   * Import the modpack zip file to the instance.
   * @param options The options provide instance directory path and modpack zip path
   */
  async importModpack(options: ImportModpackOptions) {
    const { path } = options

    if (!await isFile(path)) {
      throw new ModpackException({ type: 'requireModpackAFile', path }, `Cannot import modpack ${path}, since it's not a file!`)
    }

    this.log(`Import modpack by path ${path}`)
    const { instanceModsService, resourceService, instanceService } = this
    const zip = await open(path)
    const entries = await readAllEntries(zip)

    const manifest = await readMetadata(zip, entries).catch(() => {
      throw new ModpackException({ type: 'invalidModpack', path })
    })

    const config = resolveInstanceOptions(manifest)
    let instancePath: string
    if ('instancePath' in options) {
      await instanceService.editInstance({
        instancePath: options.instancePath,
        ...config,
      })
      instancePath = options.instancePath
    } else {
      instancePath = await instanceService.createInstance({
        ...config,
        ...options.instanceConfig,
      })
    }

    const lock = this.semaphoreManager.getLock(write(instancePath))
    return lock.write(async () => {
      // the mapping from current filename to expect filename
      const resourcePacksMapping: Record<string, string> = {}
      // the existed resources
      const resources: PersistedResource[] = []

      if (manifest.files && manifest.files.length > 0) {
        // the files need to process
        const files: Array<typeof manifest.files[number]> = []
        for (const f of manifest.files) {
          const r = 'type' in f
            ? f.type === 'curse'
              ? resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID))
              : resourceService.getResourceByKey(f.hash)
            : resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID))
          if (r) {
            resources.push(r)
          } else {
            files.push(f)
          }
        }

        resources.filter(r => isResourcePackResource(r)).map((r) => {
          const cfUri = r.uri.find(u => u.startsWith('https://edge.forgecdn.net'))
          if (cfUri) {
            return [r.fileName + r.ext, basename(cfUri)] as const
          }
          return [r.fileName + r.ext, r.name + r.ext] as const
        }).forEach(([currentName, expectedName]) => {
          resourcePacksMapping[expectedName] = currentName
        })

        // deploy the mods
        const modResources = resources.filter(r => r.domain === ResourceDomain.Mods || r.domain === ResourceDomain.Unknown)
        await ensureDir(join(instancePath, 'mods'))
        await instanceModsService.install({ mods: modResources, path: instancePath })

        // filter out existed resources
        manifest.files = files as any
      }

      let files: {
        path: string
        url: string
        projectId: number
        fileId: number
      }[] = []
      let failedError: Error | undefined
      try {
        files = await this.submit(installModpackTask(zip, entries, manifest, instancePath,
          false, this.networkManager.getDownloadBaseOptions()))
      } catch (e) {
        failedError = e as any
        if (e instanceof ModpackInstallGeneralError) {
          // try to cache downloaded files
          files = e.files
        }
      }

      const newResources = await this.resourceService.importResources({
        files: files.map(f => ({
          path: f.path,
          source: {
            curseforge: {
              fileId: f.fileId,
              projectId: f.projectId,
            },
          },
          url: [f.url, getCurseforgeUrl(f.projectId, f.fileId)],
        })),
        background: true,
      })

      if (failedError) {
        throw failedError
      }

      this.log(`Install ${files.length} files from modpack!`)

      if (files.length > 0) {
        const mapping: Record<string, string> = {}
        for (const file of files) {
          mapping[`${file.projectId}:${file.fileId}`] = file.path
        }

        for (const res of newResources) {
          if (res.domain === ResourceDomain.ResourcePacks) {
            const fileName = basename(mapping[`${res.curseforge!.projectId}:${res.curseforge!.fileId}`])
            resourcePacksMapping[fileName] = res.fileName + res.ext
          }
        }

        // removing resource packs files from /mods
        await Promise.all(newResources.filter(r => r.domain === ResourceDomain.ResourcePacks).map(f => unlink(f.path)))
      }

      // remap options.txt
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
    }).catch((e) => {
      this.error(`Fail to install modpack: ${path}`)
      this.error(e)
      // remove instance
      if (!('instancePath' in options)) {
        instanceService.deleteInstance(instancePath)
      }
      throw e
    })
  }
}
