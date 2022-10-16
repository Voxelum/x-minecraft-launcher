import { HashAlgo } from '@xmcl/curseforge'
import { DownloadTask, UnzipTask } from '@xmcl/installer'
import { CurseforgeModpackManifest, EditGameSettingOptions, ExportModpackOptions, getResolvedVersion, ImportModpackOptions, isAllowInModrinthModpack, isResourcePackResource, LockKey, McbbsModpackManifest, ModpackException, ModpackFileInfoAddon, ModpackFileInfoCurseforge, ModpackService as IModpackService, ModpackServiceKey, ModrinthModpackManifest, Persisted, Resource, ResourceDomain, ModpackDownloadableFile } from '@xmcl/runtime-api'
import { MultipleError, task } from '@xmcl/task'
import { open, readAllEntries } from '@xmcl/unzip'
import { existsSync } from 'fs'
import { ensureDir, stat, unlink } from 'fs-extra'
import { basename, extname, join } from 'path'
import { Entry, ZipFile } from 'yauzl'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { readMetadata, resolveInstanceOptions } from '../entities/modpack'
import { getCurseforgeUrl } from '../entities/resource'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { isFile, sha1ByPath } from '../util/fs'
import { requireObject } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { joinUrl } from '../util/url'
import { ZipTask } from '../util/zip'
import { BaseService } from './BaseService'
import { CurseForgeService } from './CurseForgeService'
import { InstallService } from './InstallService'
import { InstanceModsService } from './InstanceModsService'
import { InstanceOptionsService } from './InstanceOptionsService'
import { InstanceService } from './InstanceService'
import { InstanceVersionService } from './InstanceVersionService'
import { ResourceService } from './ResourceService'
import { AbstractService } from './Service'
import { VersionService } from './VersionService'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
export class ModpackService extends AbstractService implements IModpackService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(InstallService) private installService: InstallService,
    @Inject(CurseForgeService) private curseforgeService: CurseForgeService,
    @Inject(InstanceModsService) private instanceModsService: InstanceModsService,
    @Inject(InstanceOptionsService) private instanceOptionsService: InstanceOptionsService,
  ) {
    super(app, ModpackServiceKey)
  }

  /**
   * Export the instance as an modpack
   * @param options The modpack export options
   */
  async exportModpack(options: ExportModpackOptions) {
    requireObject(options)

    const { instancePath = this.instanceService.state.path, destinationPath, files, name, version, gameVersion, author, emitCurseforge = true, emitMcbbs = true, emitModrinth = false } = options

    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      this.warn(`Cannot export unmanaged instance ${instancePath}`)
      return
    }

    let curseforgeConfig: CurseforgeModpackManifest | undefined
    let mcbbsManifest: McbbsModpackManifest | undefined
    let modrinthManifest: ModrinthModpackManifest | undefined

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
          version: gameVersionInstance?.minecraft ?? instance.runtime.minecraft,
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
    if (emitModrinth) {
      modrinthManifest = {
        formatVersion: 1,
        game: 'minecraft',
        versionId: version,
        name: name,
        summary: instance.description,
        dependencies: {
          minecraft: instance.runtime.minecraft,
          forge: instance.runtime.forge || undefined,
          'fabric-loader': instance.runtime.fabricLoader || undefined,
          'quilt-loader': instance.runtime.quiltLoader || undefined,
        },
        files: [],
      }
    }

    const zipTask = new ZipTask(destinationPath)

    zipTask.addEmptyDirectory('overrides')

    for (const file of files) {
      const filePath = join(instancePath, file.path)
      if (file.path.startsWith('mods/') || file.path.startsWith('resourcepacks/') || file.path.startsWith('shaderpacks/')) {
        let resource = this.resourceService.state.mods.find((i) => (i.domain + '/' + i.fileName) === file.path)
        if (!resource) {
          const ino = await stat(filePath)
          resource = this.resourceService.getResourceByKey(ino.ino) as any
          if (!resource) {
            const sha1 = await this.worker().checksum(filePath, 'sha1')
            resource = this.resourceService.getResourceByKey(sha1) as any
          }
        }

        if (!file.override && resource) {
          if (resource.metadata.curseforge) {
            // curseforge
            curseforgeConfig?.files.push({ projectID: resource.metadata.curseforge.projectId, fileID: resource.metadata.curseforge.fileId, required: true })
            mcbbsManifest?.files!.push({ projectID: resource.metadata.curseforge.projectId, fileID: resource.metadata.curseforge.fileId, type: 'curse', force: false })
            continue
          } else if (!file.override && resource) {
            // modrinth not allowed to include curseforge source by regulation
            const availableDownloads = resource.uri.filter(u => isAllowInModrinthModpack(u, options.strictModeInModrinth))
            if (availableDownloads.length > 0) {
              modrinthManifest?.files.push({
                path: file.path,
                hashes: {
                  sha1: await this.worker().checksum(filePath, 'sha1'),
                  sha256: await this.worker().checksum(filePath, 'sha256'),
                },
                downloads: availableDownloads,
                fileSize: (await stat(filePath)).size,
                env: file.env
                  ? {
                    client: file.env.client ?? 'required',
                    server: file.env.server ?? 'required',
                  }
                  : undefined,
              })
              continue
            }
          }
        }
      }
      zipTask.addFile(filePath, `overrides/${file.path}`)
      mcbbsManifest?.files!.push({ type: 'addon', force: false, path: file.path, hash: await sha1ByPath(filePath) })
    }

    if (curseforgeConfig) {
      this.log(`Export instance ${instancePath} to curseforge ${JSON.stringify(curseforgeConfig, null, 4)}`)
      zipTask.addBuffer(Buffer.from(JSON.stringify(curseforgeConfig, null, 4)), 'manifest.json')
    }

    if (mcbbsManifest) {
      this.log(`Export instance ${instancePath} to mcbbs ${JSON.stringify(mcbbsManifest, null, 4)}`)
      zipTask.addBuffer(Buffer.from(JSON.stringify(mcbbsManifest, null, 4)), 'mcbbs.packmeta')
    }

    if (modrinthManifest) {
      this.log(`Export instance ${instancePath} to modrinth ${JSON.stringify(modrinthManifest, null, 4)}`)
      zipTask.addBuffer(Buffer.from(JSON.stringify(modrinthManifest, null, 4)), 'modrinth.index.json')
    }

    try {
      await this.submit(zipTask)
      this.instanceService.editInstance({ instancePath, modpackVersion: version })
      this.baseService.showItemInDirectory(destinationPath)
    } finally {
      // TODO: handle
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

    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))
    await lock.write(async () => {
      // the mapping from current filename to expect filename
      const resourcePacksMapping: Record<string, string> = {}
      // the existed resources
      const resources: Persisted<Resource>[] = []

      if (manifest.files && manifest.files.length > 0) {
        // the files need to process
        const files: Array<typeof manifest.files[number]> = []
        for (const f of manifest.files) {
          const r = 'type' in f
            ? f.type === 'curse'
              ? resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID))
              : resourceService.getResourceByKey(f.hash)
            : 'downloads' in f
              ? resourceService.getResourceByKey(f.downloads[0])
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
            return [r.fileName, basename(cfUri)] as const
          }
          return [r.fileName, r.name + extname(r.fileName)] as const
        }).forEach(([currentName, expectedName]) => {
          resourcePacksMapping[expectedName] = currentName
        })

        // deploy the mods
        const modResources = resources.filter(r => r.domain === ResourceDomain.Mods || r.domain === ResourceDomain.Unclassified)
        await ensureDir(join(instancePath, 'mods'))
        await instanceModsService.install({ mods: modResources, path: instancePath })

        // filter out existed resources
        manifest.files = files as any
      }

      let files: ModpackDownloadableFile[] = []
      let failedError: Error | undefined
      try {
        files = await this.submit(this.installModpackTask(zip, entries, manifest, instancePath))
      } catch (e) {
        failedError = e as any
        if (e instanceof ModpackException) {
          // try to cache downloaded files
          if (e.exception.type === 'modpackInstallFailed' || e.exception.type === 'modpackInstallPartial') {
            files = e.exception.files
          }
        }
      }

      const newResources = await this.resourceService.importResource({
        resources: files.map(f => ({
          path: f.destination,
          metadata: f.metadata,
          uri: f.downloads,
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
          if (file.metadata.curseforge) {
            mapping[`${file.metadata.curseforge.fileId}:${file.metadata.curseforge.fileId}`] = file.destination
          }
        }

        for (const res of newResources) {
          if (res.domain === ResourceDomain.ResourcePacks) {
            if (mapping[`${res.metadata.curseforge!.projectId}:${res.metadata.curseforge!.fileId}`]) {
              const fileName = basename(mapping[`${res.metadata.curseforge!.projectId}:${res.metadata.curseforge!.fileId}`])
              resourcePacksMapping[fileName] = res.fileName
            } else {
              this.warn(`Unknown resource pack name in mods: ${res.path} (${res.storedPath})`)
            }
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

      if (options.mountAfterSucceed) {
        await this.instanceService.mountInstance(instancePath)
      }
    }).catch((e) => {
      this.error(`Fail to install modpack: ${path}`)
      this.error(e)
      // remove instance
      if (!('instancePath' in options)) {
        instanceService.deleteInstance(instancePath)
      }
      throw e
    })

    const instance = this.instanceService.state.all[instancePath]
    const versionHeader = getResolvedVersion(this.versionService.state.local, instance.runtime, instance.version)
    const resolvedVersion = versionHeader ? await this.versionService.resolveLocalVersion(versionHeader.id) : undefined
    if (!resolvedVersion) {
      const version = await this.instanceVersionService.installRuntime(instance.runtime)
      if (version) {
        await this.installService.installDependencies(version)
      }
    }

    return instancePath
  }

  private installModpackTask(zip: ZipFile, entries: Entry[], manifest: CurseforgeModpackManifest | McbbsModpackManifest | ModrinthModpackManifest, root: string) {
    const allowFileApi = false
    const options = this.networkManager.getDownloadBaseOptions()
    const curseforgeService = this.curseforgeService

    return task('installModpack', async function () {
      const infos = [] as ModpackDownloadableFile[]
      const missingFiles = [] as { fileId: number; projectId: number }[]
      if (manifest.files) {
        if ('manifestVersion' in manifest) {
          const curseforgeFiles = manifest.files.map(f => f).filter((f): f is ModpackFileInfoCurseforge => !('type' in f) || f.type === 'curse' || 'hashes' in f)
          const files = await curseforgeService.fetchModFiles(curseforgeFiles.map(f => f.fileID))

          for (let i = 0; i < curseforgeFiles.length; i++) {
            const file = files[i]
            const domain = file.modules.some(f => f.name === 'META-INF') ? ResourceDomain.Mods : ResourceDomain.ResourcePacks
            const sha1 = file.hashes.find(v => v.algo === HashAlgo.Sha1)?.value
            infos.push({
              downloads: file.downloadUrl ? [file.downloadUrl] : guessCurseforgeFileUrl(file.id, file.fileName),
              destination: join(root, domain, file.fileName),
              hashes: sha1
                ? {
                  sha1: file.hashes.find(v => v.algo === HashAlgo.Sha1)?.value,
                } as Record<string, string>
                : {},
              metadata: {
                curseforge: {
                  fileId: file.id,
                  projectId: file.modId,
                },
              },
            })
          }
        } else {
          for (const meta of manifest.files) {
            infos.push({
              downloads: meta.downloads,
              hashes: meta.hashes,
              destination: join(root, meta.path),
              metadata: {},
            })
          }
        }

        const tasks = infos.map((f) => {
          const hashes = Object.entries(f.hashes)
          const lastHash = hashes.find(v => v[0] === 'sha256') ?? hashes[hashes.length - 1]
          return new DownloadTask({
            url: f.downloads,
            destination: f.destination,
            agents: options.agents,
            validator: lastHash ? { algorithm: lastHash[0], hash: lastHash[1] } : undefined,
            retryHandler: { maxRetryCount: 5 },
            ...options.headers,
          }).setName('download')
        })

        try {
          await this.all(tasks, {
            throwErrorImmediately: false,
            getErrorMessage: (errs) => `Fail to install modpack to ${root}: ${errs.map((e) => e.toString()).join('\n')}`,
          })
        } catch (e) {
          if (e instanceof MultipleError) {
            for (const err of e.errors) {
              // if (err instanceof DownloadError) { }
            }
          }
          throw new ModpackException({
            type: 'modpackInstallFailed',
            files: infos,
          })
        }
      }

      try {
        await this.yield(new UnzipTask(
          zip,
          entries.filter((e) => !e.fileName.endsWith('/') && e.fileName.startsWith('overrides' in manifest ? manifest.overrides : 'overrides')),
          root,
          (e) => e.fileName.substring('overrides' in manifest ? manifest.overrides.length : 'overrides'.length),
        ).setName('unpack'))

        // download custom files
        if ('fileApi' in manifest && manifest.files && manifest.fileApi && allowFileApi) {
          const fileApi = manifest.fileApi
          const addonFiles = manifest.files.filter((f): f is ModpackFileInfoAddon => f.type === 'addon')
          await this.all(addonFiles.map((f) => new DownloadTask({
            url: joinUrl(fileApi, f.path),
            destination: join(root, f.path),
            validator: {
              algorithm: 'sha1',
              hash: f.hash,
            },
            agents: options.agents,
            headers: options.headers,
          }).setName('download')))
        }
      } catch (e) {
        throw new ModpackException({
          type: 'modpackInstallFailed',
          files: infos,
        })
      }

      if (missingFiles.length > 0) {
        throw new ModpackException({
          type: 'modpackInstallPartial',
          files: infos,
          missingFiles,
        })
      }

      return infos
    })
  }

  async showModpacksFolder(): Promise<void> {
    this.baseService.openDirectory(this.getPath('modpacks'))
  }
}
