import { ModrinthV2Client } from '@xmcl/modrinth'
import { CreateInstanceOption, CurseforgeModpackManifest, ExportModpackOptions, ModpackService as IModpackService, InstallMarketOptions, Instance, InstanceData, InstanceFile, McbbsModpackManifest, ModpackException, ModpackInstallProfile, ModpackServiceKey, ModpackState, ModrinthModpackManifest, SharedState, ResourceDomain, ResourceMetadata, ResourceState, UpdateResourcePayload, findMatchedVersion, getCurseforgeModpackFromInstance, getMcbbsModpackFromInstance, getModrinthModpackFromInstance, isAllowInModrinthModpack } from '@xmcl/runtime-api'
import { ensureDir, mkdir, readdir, remove, stat, unlink } from 'fs-extra'
import { dirname, join } from 'path'
import { Entry, ZipFile } from 'yauzl'
import { Inject, LauncherApp, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { kMarketProvider } from '~/market'
import { ResourceManager, ResourceWorker, kResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { TaskFn, kTaskExecutor } from '~/task'
import { VersionService } from '~/version'
import { ZipManager } from '~/zipManager/ZipManager'
import { AnyError, isSystemError } from '../util/error'
import { requireObject } from '../util/object'
import { ZipTask } from '../util/zip'
import { InstanceInstallService } from '~/instanceIO'

export interface ModpackDownloadableFile {
  destination: string
  downloads: string[]
  hashes: Record<string, string>
  metadata: ResourceMetadata
}

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
    @Inject(ResourceManager) private resourceManager: ResourceManager,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
  }

  registerHandler<M>(type: string, handler: ModpackHandler<M>) {
    this.handlers[type] = handler
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

    const { instancePath, destinationPath, files, name, version, gameVersion, author, emitCurseforge, emitMcbbs, emitModrinth = false } = options

    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      this.warn(`Cannot export unmanaged instance ${instancePath}`)
      return
    }

    let curseforgeConfig: CurseforgeModpackManifest | undefined
    let mcbbsManifest: McbbsModpackManifest | undefined
    let modrinthManifest: ModrinthModpackManifest | undefined
    let xmclManifestExtension: Pick<InstanceData, 'disableElybyAuthlib' | 'disableAuthlibInjector' | 'upstream' | 'server'> | undefined

    if (emitCurseforge) {
      curseforgeConfig = getCurseforgeModpackFromInstance(instance)
      curseforgeConfig.author = author ?? curseforgeConfig.author
      curseforgeConfig.name = name ?? curseforgeConfig.name
    }

    if (emitMcbbs) {
      mcbbsManifest = getMcbbsModpackFromInstance(instance)
      mcbbsManifest.author = author ?? mcbbsManifest.author
      mcbbsManifest.name = name ?? mcbbsManifest.name
    }
    if (emitModrinth) {
      modrinthManifest = getModrinthModpackFromInstance(instance)
    }

    const zipTask = new ZipTask(destinationPath)

    zipTask.addEmptyDirectory('overrides')

    const backfillModrinth: [ModrinthModpackManifest['files'][number], UpdateResourcePayload][] = []

    for (const file of files) {
      const filePath = join(instancePath, file.path)
      if (file.path.startsWith('mods/') || file.path.startsWith('resourcepacks/') || file.path.startsWith('shaderpacks/')) {
        const fStat = await stat(filePath)
        const snapshot = await this.resourceManager.getSnapshotByIno(fStat.ino)
        let sha1: string | undefined
        if (!snapshot) {
          sha1 = await this.worker.checksum(filePath, 'sha1')
        } else {
          sha1 = snapshot.sha1
        }
        const metadata = await this.resourceManager.getMetadataByHash(sha1)

        if (!file.override && metadata) {
          let handled = false
          if (metadata.curseforge && (curseforgeConfig || mcbbsManifest)) {
            // curseforge
            curseforgeConfig?.files?.push({ projectID: metadata.curseforge.projectId, fileID: metadata.curseforge.fileId, required: true })
            mcbbsManifest?.files!.push({ projectID: metadata.curseforge.projectId, fileID: metadata.curseforge.fileId, type: 'curse', force: false })
            handled = true
          }

          if (modrinthManifest) {
            const urls = await this.resourceManager.getUriByHash(sha1)
            // modrinth not allowed to include curseforge source by regulation
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
                sha1,
                sha512: await this.worker.checksum(filePath, 'sha512'),
              },
              downloads: availableDownloads,
              fileSize: (await stat(filePath)).size,
              env: Object.keys(env).length > 0 ? env as any : undefined,
            }

            if (availableDownloads.length === 0) {
              backfillModrinth.push([result, {
                hash: sha1,
                metadata,
                uris: urls,
              }])
            } else {
              modrinthManifest?.files.push(result)
            }
            handled = true
          }

          if (handled) {
            continue
          }
        }
      }
      zipTask.addFile(filePath, `overrides/${file.path}`)
      mcbbsManifest?.files!.push({ type: 'addon', force: false, path: file.path, hash: await this.worker.checksum(filePath, 'sha1') })
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
        zipTask.addFile(filePath, `overrides/${file.path}`)
      }
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

    await this.submit(zipTask)
    this.app.shell.showItemInFolder(destinationPath)
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

      if (typeof cached === 'object' && cached.instance) {
        this.log(`Use cached modpack profile ${modpackFile}`)
        state.config = {
          ...cached.instance.instance,
          upstream: cached.upstream,
        }
        state.files = cached.instance.files
        state.ready = true
        return [
          state,
          zip.dispose,
        ]
      }

      const hash = cached.sha1

      const entries = Object.values(zip.entries)
      const [manifest, handler, errors] = await this.getManifestAndHandler(zip.file, entries)
      if (!manifest || !handler) {
        for (const e of errors) {
          this.error(Object.assign(e, { name: e.name || 'ModpackParseError', cause: 'ModpackParsing' }))
        }
        throw new ModpackException({ type: 'invalidModpack', path: modpackFile })
      }

      this.log(`Parse modpack profile ${modpackFile} with handler ${handler.constructor.name}`)
      const instance = handler.resolveInstanceOptions(manifest)
      state.config = {
        ...instance,
        upstream: cached.upstream,
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
    const states = await this.app.registry.getOrCreate(ServiceStateManager)
    return states.registerOrGet('modpacks', async ({ doAsyncOperation }) => {
      const dir = this.getPath('modpacks')
      await ensureDir(dir)
      const { dispose, revalidate, state } = this.resourceManager.watch(dir,
        ResourceDomain.Modpacks,
        (func) => doAsyncOperation(func()),
      )
      return [state, dispose, revalidate]
    })
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
