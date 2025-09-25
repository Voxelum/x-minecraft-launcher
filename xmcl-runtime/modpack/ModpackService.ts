import { getCurseforgeModpackFromInstance, getMcbbsModpackFromInstance, getModrinthModpackFromInstance, type CurseforgeModpackManifest, type Instance, type InstanceData, type InstanceFile, type McbbsModpackManifest, type ModpackInstallProfile, type ModrinthModpackManifest } from '@xmcl/instance'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { ResourceManager, ResourceMetadata, UpdateResourcePayload } from '@xmcl/resource'
import { InstanceLockSchema, ModpackException, ModpackServiceKey, ModpackState, ResourceState, findMatchedVersion, isAllowInModrinthModpack, type CreateInstanceOption, type ExportModpackOptions, type ModpackService as IModpackService, type InstallMarketOptions, type SharedState } from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import { readJson, stat, unlink } from 'fs-extra'
import { dirname, join, relative } from 'path'
import { Entry, ZipFile } from 'yauzl'
import { Inject, LauncherApp, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import { ZipManager, kTaskExecutor, type TaskFn } from '~/infra'
import { InstanceService } from '~/instance'
import { InstanceInstallService } from '~/instanceIO'
import { kMarketProvider } from '~/market'
import { kResourceManager, kResourceWorker, type ResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { VersionService } from '~/version'
import { requireObject } from '../util/object'
import { ZipTask } from '../util/zip'
import { createCurseforgeHandler } from './utils/curseforgeHandler'
import { createMcbbsHandler } from './utils/mcbbsHandler'
import { createMmcHandler } from './utils/mmcHandler'
import { createModrinthHandler } from './utils/modrinthHandler'
import { exportOfflineModpack } from './utils/exportOffline'
import { readEntry } from '@xmcl/unzip'

export interface ModpackDownloadableFile {
  destination: string
  downloads: string[]
  hashes: Record<string, string>
  metadata: ResourceMetadata
}

type SelectedXMCLFields = Pick<InstanceData, 'disableElybyAuthlib' | 'disableAuthlibInjector' | 'upstream' | 'server' | 'resolution' | 'showLog' | 'hideLauncher'>

const transformFile = (file: InstanceFile) => {
  file.path = file.path.replaceAll('\\', '/')
  return file
}

const transformInstance = <T extends { files: InstanceFile[] }>(o: T) => {
  for (const file of o.files) transformFile(file)
  return o
}

export interface ModpackHandler<M = any> {
  /**
   * @return The relative path of the entry after unpack to the instance root. `undefine` means not to unpack.
   */
  resolveUnpackPath(manifest: M, e: Entry): string | void

  readManifest(zipFile: ZipFile, entries: Entry[]): Promise<M | undefined>
  resolveInstanceOptions(manifest: M): ModpackInstallProfile['instance']
  resolveInstanceFiles(manifest: M): Promise<InstanceFile[]>

  /**
   * Resolve the additional market metadata for the modpack
   */
  resolveModpackMarketMetadata?(path: string, sha1: string): Promise<ResourceMetadata | undefined>
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(ModpackServiceKey)
export class ModpackService extends AbstractService implements IModpackService {
  private handlers: Record<string, ModpackHandler> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kResourceManager) private resourceManager: ResourceManager,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
    this.handlers['curseforge'] = createCurseforgeHandler(app)
    this.handlers['mcbbs'] = createMcbbsHandler(app)
    this.handlers['mmc'] = createMmcHandler(app)
    this.handlers['modrinth'] = createModrinthHandler(app)
  }

  async installModapckFromMarket(options: InstallMarketOptions): Promise<string[]> {
    const provider = await this.app.registry.get(kMarketProvider)
    const result = await provider.installFile({
      ...options,
      directory: this.getPath('modpacks'),
    })
    return result.map(r => r.path)
  }

  async importModpack(modpackFile: string, iconUrl?: string, upstream?: InstanceData['upstream']): Promise<{
    instancePath: string
    version?: string
    runtime: Instance['runtime']
  }> {
    this.log(`Import modpack ${modpackFile}`)
    const zipManager = await this.app.registry.getOrCreate(ZipManager)
    const cached = await this.getCachedInstallProfile(modpackFile)
    const zip = await zipManager.open(modpackFile)
    const instanceInstallService = await this.app.registry.get(InstanceInstallService)

    const entries = Object.values(zip.entries)
    const [manifest, handler] = await this.getManifestAndHandler(zip.file, entries)

    if (!manifest || !handler) throw new ModpackException({ type: 'invalidModpack', path: modpackFile })

    const instance = handler.resolveInstanceOptions(manifest)

    const versionService = await this.app.registry.get(VersionService)
    const files = await this.#processFiles(handler, modpackFile, manifest, cached.sha1, entries)

    const name = instance.name

    const matchedVersion = findMatchedVersion(versionService.state.local,
      '',
      instance.runtime.minecraft,
      instance.runtime.forge,
      instance.runtime.neoForged,
      instance.runtime.fabricLoader,
      instance.runtime.optifine,
      instance.runtime.quiltLoader,
      instance.runtime.labyMod)
    if (matchedVersion) {
      this.log('Found matched version', matchedVersion, instance.runtime)
    }

    const hasShaderpacks = files.some(f => f.path.startsWith('shaderpacks/'))
    const hasResourcepacks = files.some(f => f.path.startsWith('resourcepacks/'))
    const options: CreateInstanceOption = {
      ...instance,
      name,
      version: matchedVersion?.id || instance.version,
      shaderpacks: hasShaderpacks,
      resourcepacks: hasResourcepacks,
      icon: iconUrl,
    }

    if (upstream) {
      options.upstream = upstream;
      (options.upstream as any).sha1 = cached.sha1
    }

    const path = await this.instanceService.createInstance(options)

    instanceInstallService.installInstanceFiles(upstream ? {
      path,
      files,
      upstream,
    } : {
      path,
      files,
      oldFiles: [],
    }).catch((e) => {
      this.error(e)
    })

    return {
      instancePath: path,
      version: options.version,
      runtime: instance.runtime!,
    }
  }

  /**
   * Export the instance as an modpack
   * @param options The modpack export options
   */
  async exportModpack(options: ExportModpackOptions) {
    requireObject(options)

    const { instancePath, destinationDirectory, files, name, version, gameVersion, author, emitCurseforge, emitModrinth, emitOffline } = options

    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      this.warn(`Cannot export unmanaged instance ${instancePath}`)
      return
    }

    if (!emitCurseforge && !emitModrinth && !emitOffline) {
      return
    }

    let curseforgeConfig: CurseforgeModpackManifest | undefined
    let modrinthManifest: ModrinthModpackManifest | undefined
    let xmclManifestExtension: SelectedXMCLFields = {
      disableElybyAuthlib: instance.disableElybyAuthlib,
      disableAuthlibInjector: instance.disableAuthlibInjector,
      upstream: instance.upstream,
      server: instance.server,
      resolution: instance.resolution,
      showLog: instance.showLog,
      hideLauncher: instance.hideLauncher,
    }

    if (emitCurseforge) {
      curseforgeConfig = getCurseforgeModpackFromInstance(instance)
      curseforgeConfig.author = author ?? curseforgeConfig.author
      curseforgeConfig.name = name ?? curseforgeConfig.name
      curseforgeConfig.version = version ?? curseforgeConfig.version
    }

    if (emitModrinth) {
      modrinthManifest = getModrinthModpackFromInstance(instance)
      modrinthManifest.versionId = version ?? modrinthManifest.versionId
    }

    const parentDir = destinationDirectory || this.app.host.getPath('downloads')
    const curseforgeZip = emitCurseforge ? new ZipTask(join(parentDir, `${name}-${version}.zip`)) : undefined
    const modrinthZip = emitModrinth ? new ZipTask(join(parentDir, `${name}-${version}.mrpack`)) : undefined
    const offlineZip = emitOffline ? new ZipTask(join(parentDir, `${name}-${version}-offline.zip`)) : undefined

    curseforgeZip?.addEmptyDirectory('overrides')
    modrinthZip?.addEmptyDirectory('overrides')

    const xmclJson = Buffer.from(JSON.stringify(xmclManifestExtension, null, 4))
    curseforgeZip?.addBuffer(xmclJson, 'xmcl.json')
    modrinthZip?.addBuffer(xmclJson, 'xmcl.json')
    offlineZip?.addBuffer(xmclJson, 'xmcl.json')

    const backfillModrinth: [ModrinthModpackManifest['files'][number], UpdateResourcePayload][] = []
    const instanceLockContent: InstanceLockSchema | undefined = await readJson(join(instancePath, 'instance-lock.json')).catch(() => undefined)
    const lockHashLookup = Object.fromEntries(instanceLockContent?.files.map(f => [f.path, f]) || [])

    const lookupFile = async (filePath: string) => {
      const fStat = await stat(filePath).catch(() => null)
      if (!fStat?.isFile()) {
        return undefined
      }
      const relativePath = relative(instancePath, filePath).replaceAll('\\', '/')
      const lockedFile = lockHashLookup[relativePath]
      if (lockedFile) {
        return lockedFile
      }

      const snapshot = await this.resourceManager.getSnapshotByIno(fStat.ino)
      let sha1: string | undefined
      if (!snapshot) {
        sha1 = await this.worker.checksum(filePath, 'sha1')
      } else {
        sha1 = snapshot.sha1
      }
      const metadata = await this.resourceManager.getMetadataByHash(sha1)
      const downloads = await this.resourceManager.getUriByHash(sha1).then(uris => uris.filter(u => u.startsWith('http')))
      return {
        path: relativePath,
        hashes: { sha1 },
        ...metadata,
        downloads
      }
    }

    if (offlineZip) {
      const versionService = await this.app.registry.get(VersionService)
      const resolved = await versionService.resolveLocalVersion(gameVersion)
      await exportOfflineModpack(offlineZip, this.getPath(), resolved)
    }

    const addAsOverride = (src: string, path: string) => {
      curseforgeZip?.addFile(src, `overrides/${path}`)
      modrinthZip?.addFile(src, `overrides/${path}`)
    }

    for (const file of files) {
      const filePath = join(instancePath, file.path)
      // Add offline anyway
      offlineZip?.addFile(filePath, file.path)
      if (file.path.startsWith('mods/') || file.path.startsWith('resourcepacks/') || file.path.startsWith('shaderpacks/')) {
        if (file.override) {
          addAsOverride(filePath, file.path)
        } else {
          const fileLike = await lookupFile(filePath)
          if (!fileLike) {
            addAsOverride(filePath, file.path)
            continue
          }

          if (fileLike.curseforge) {
            curseforgeConfig?.files?.push({ projectID: fileLike.curseforge.projectId, fileID: fileLike.curseforge.fileId, required: true })
          } else {
            curseforgeZip?.addFile(filePath, `overrides/${file.path}`)
          }
          if (fileLike.modrinth) {
            // modrinth not allowed to include curseforge source by regulation
            const urls = fileLike.downloads || []
            const availableDownloads = urls.filter(u => isAllowInModrinthModpack(u, options.strictModeInModrinth))
            const env = {} as Record<string, string>
            if (file.env?.client) {
              env.client = file.env.client
            }
            if (file.env?.server) {
              env.server = file.env.server
            }

            const result = {
              path: file.path,
              hashes: {
                sha1: fileLike.hashes.sha1 || await this.worker.checksum(filePath, 'sha1'),
                sha512: await this.worker.checksum(filePath, 'sha512'),
              },
              downloads: availableDownloads,
              fileSize: (await stat(filePath)).size,
              env: Object.keys(env).length > 0 ? env as any : undefined,
            }

            if (availableDownloads.length === 0) {
              backfillModrinth.push([result, {
                hash: result.hashes.sha1,
                metadata: fileLike,
                uris: urls,
              }])
            } else {
              modrinthManifest?.files.push(result)
            }
          } else {
            modrinthZip?.addFile(filePath, `overrides/${file.path}`)
          }
        }
      } else {
        addAsOverride(filePath, file.path)
      }
    }

    if (backfillModrinth.length > 0) {
      const modrinthClient = await this.app.registry.get(ModrinthV2Client)
      const result = await modrinthClient.getProjectVersionsByHash(backfillModrinth.map(v => v[1].hash), 'sha1')

      for (const [file, resource] of backfillModrinth) {
        const version = result[resource.hash]
        if (version) {
          const matched = version.files.find(f => f.hashes.sha1 === file.hashes.sha1)
          if (matched) {
            file.downloads.push(matched.url)
            modrinthManifest?.files.push(file)
            await this.resourceManager.updateMetadata([{
              hash: resource.hash,
              uris: [...(resource.uris || []), matched.url],
              metadata: {
                modrinth: {
                  projectId: version.project_id,
                  versionId: version.id,
                },
              },
            }])
            continue
          }
        }

        const filePath = join(instancePath, file.path)
        modrinthZip?.addFile(filePath, `overrides/${file.path}`)
      }
    }

    if (curseforgeConfig) {
      this.log(`Export instance ${instancePath} to curseforge ${JSON.stringify(curseforgeConfig, null, 4)}`)
      curseforgeZip?.addBuffer(Buffer.from(JSON.stringify(curseforgeConfig, null, 4)), 'manifest.json')
    }

    if (modrinthManifest) {
      this.log(`Export instance ${instancePath} to modrinth ${JSON.stringify(modrinthManifest, null, 4)}`)
      modrinthZip?.addBuffer(Buffer.from(JSON.stringify(modrinthManifest, null, 4)), 'modrinth.index.json')
    }

    if (curseforgeZip) {
      await this.submit(curseforgeZip)
    }
    if (modrinthZip) {
      await this.submit(modrinthZip)
    }
    if (offlineZip) {
      await this.submit(offlineZip)
    }

    const destinationPath = modrinthZip?.destination ?? curseforgeZip?.destination ?? offlineZip?.destination
    if (destinationPath) {
      this.app.shell.showItemInFolder(destinationPath)
    }
  }

  protected async getCachedInstallProfile(path: string) {
    const fStat = await stat(path)
    if (!fStat.isFile()) {
      throw new ModpackException({ type: 'requireModpackAFile', path }, `Cannot import modpack ${path}, since it's not a file!`)
    }

    const snapshot = await this.resourceManager.getSnapshotByIno(fStat.ino)
    const sha1 = snapshot?.sha1 ?? await this.worker.checksum(path, 'sha1')
    const metadata = await this.resourceManager.getMetadataByHash(sha1)

    if (metadata) {
      this.log(`Get modpack profile by cached ino ${path}`)
      const upstream: Instance['upstream'] = metadata.curseforge
        ? {
          type: 'curseforge-modpack',
          modId: metadata.curseforge.projectId,
          fileId: metadata.curseforge.fileId,
          sha1,
        }
        : metadata.modrinth
          ? {
            type: 'modrinth-modpack',
            projectId: metadata.modrinth.projectId,
            versionId: metadata.modrinth.versionId,
            sha1,
          }
          : undefined
      return {
        sha1,
        instance: metadata.instance ? transformInstance(metadata.instance) : undefined,
        upstream,
      }
    }

    return {
      sha1,
    }
  }

  async #processFiles<T>(handler: ModpackHandler, modpackFile: string, manifest: T, hash: string, entries: Entry[]) {
    const instanceFiles = await handler.resolveInstanceFiles(manifest)
    this.log(`Discovered modpack profile ${modpackFile} with ${instanceFiles.length} files`)

    const files = entries
      .filter((e) => !!handler.resolveUnpackPath(manifest, e) && !e.fileName.endsWith('/'))
      .map((e) => {
        const relativePath = handler.resolveUnpackPath(manifest, e)!
        const file: InstanceFile = {
          path: relativePath,
          size: e.uncompressedSize,
          hashes: {
            crc32: e.crc32.toString(),
          },
          downloads: [
            `zip:///${modpackFile}?entry=${encodeURIComponent(e.fileName)}`,
            `zip://${hash}/${e.fileName}`,
          ],
        }
        return file
      })
      .concat(instanceFiles)
      .filter(f => !f.path.endsWith('/'))

    for (const file of files) {
      transformFile(file)
    }

    return files
  }

  async openModpack(modpackFile: string): Promise<SharedState<ModpackState>> {
    const store = await this.app.registry.get(ServiceStateManager)
    const zipManager = await this.app.registry.getOrCreate(ZipManager)

    this.log(`Open modpack profile ${modpackFile}`)
    return store.registerOrGet(`modpack-file://${modpackFile}`, async () => {
      const cached = await this.getCachedInstallProfile(modpackFile)
      const zip = await zipManager.open(modpackFile)
      this.log(`Opened modpack profile ${modpackFile}`)
      const state = new ModpackState()
      state.modpackPath = modpackFile

      const hash = cached.sha1

      const entries = Object.values(zip.entries)
      const [manifest, handler, errors] = await this.getManifestAndHandler(zip.file, entries)
      if (!manifest || !handler) {
        for (const e of errors) {
          this.error(Object.assign(e, { name: e.name || 'ModpackParseError', cause: 'ModpackParsing' }))
        }
        state.error = new ModpackException({ type: 'invalidModpack', path: modpackFile })
        return [
          state,
          zip.dispose,
        ]
      }

      this.log(`Parse modpack profile ${modpackFile} with handler ${handler.constructor.name}`)
      const instance = handler.resolveInstanceOptions(manifest)

      let xmclCache: SelectedXMCLFields | undefined
      if (zip.entries['xmcl.json']) {
        try {
          const b = await readEntry(zip.file, zip.entries['xmcl.json'])
          xmclCache = JSON.parse(b.toString()) as SelectedXMCLFields
        } catch {}
      }

      state.config = {
        ...instance,
        ...xmclCache,
        upstream: cached.upstream,
      }

      if (typeof cached === 'object' && cached.instance) {
        this.log(`Use cached modpack profile ${modpackFile}`)
        state.files = cached.instance.files
        state.ready = true
        return [
          state,
          zip.dispose,
        ]
      }

      // Update the market metadata
      if (!cached.upstream) {
        this.log(`Update modpack market metadata ${modpackFile}`)
        handler.resolveModpackMarketMetadata?.(modpackFile, hash).then((metadata) => this.resourceManager.updateMetadata([{
          hash,
          metadata: {
            ...metadata,
          },
        }])).catch((e) => {
          this.error(new AnyError('ModpackInstallProfileError', 'Fail to update resource', { cause: e }))
        })
      }

      this.#processFiles(
        handler,
        modpackFile,
        manifest,
        hash,
        entries,
      ).then((files) => {
        state.modpackFiles(files)
        this.log(`Update instance resource modpack profile ${modpackFile}`)
        // cache the manifest
        return this.resourceManager.updateMetadata([{
          hash,
          metadata: {
            instance: {
              instance,
              files,
            },
          },
        }])
      }).catch(e => {
        this.error(new AnyError('ModpackInstallProfileError', 'Fail to update resource', { cause: e }))
        state.modpackError(e)
      })

      return [state, zip.dispose]
    })
  }

  private async getManifestAndHandler(zip: ZipFile, entries: Entry[]) {
    const errors = [] as any[]
    for (const handler of Object.values(this.handlers)) {
      const manifest = await handler.readManifest(zip, entries).catch((e) => {
        errors.push(e)
        return undefined
      })
      if (manifest) {
        return [manifest, handler, []] as const
      }
    }
    return [undefined, undefined, errors] as const
  }

  async showModpacksFolder(): Promise<void> {
    this.app.shell.openDirectory(this.getPath('modpacks'))
  }

  async watchModpackFolder(): Promise<SharedState<ResourceState>> {
    throw new Error('')
    // const states = await this.app.registry.getOrCreate(ServiceStateManager)
    // return states.registerOrGet('modpacks', async ({ doAsyncOperation }) => {
    //   const dir = this.getPath('modpacks')
    //   await ensureDir(dir)
    //   const { dispose, revalidate, state } = this.resourceManager.watch({
    //     directory: dir,
    //     domain: ResourceDomain.Modpacks,
    //     processUpdate: (func) => doAsyncOperation(func()),
    //   })
    //   return [state, dispose, revalidate]
    // })
  }

  async removeModpack(path: string): Promise<void> {
    const dir = dirname(path)
    const modpacksFolder = this.getPath('modpacks')
    if (dir !== modpacksFolder) {
      return
    }
    await unlink(path)
  }
}
