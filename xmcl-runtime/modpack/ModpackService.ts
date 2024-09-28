import { ModrinthV2Client } from '@xmcl/modrinth'
import { CurseforgeModpackManifest, ExportModpackOptions, ModpackService as IModpackService, InstanceFile, McbbsModpackManifest, ModpackException, ModpackInstallProfile, ModpackServiceKey, ModrinthModpackManifest, Resource, ResourceMetadata, getCurseforgeModpackFromInstance, getMcbbsModpackFromInstance, getModrinthModpackFromInstance, isAllowInModrinthModpack } from '@xmcl/runtime-api'
import { open, readAllEntries } from '@xmcl/unzip'
import { stat } from 'fs-extra'
import { join } from 'path'
import { Entry, ZipFile } from 'yauzl'
import { Inject, LauncherApp, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceService, ResourceWorker, kResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey } from '~/service'
import { TaskFn, kTaskExecutor } from '~/task'
import { AnyError } from '../util/error'
import { requireObject } from '../util/object'
import { ZipTask } from '../util/zip'

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

  resolveModpackMetadata?(path: string, sha1: string): Promise<ResourceMetadata | undefined>
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(ModpackServiceKey)
export class ModpackService extends AbstractService implements IModpackService {
  private handlers: Record<string, ModpackHandler> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
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

    const backfillModrinth: [ModrinthModpackManifest['files'][number], Resource][] = []

    for (const file of files) {
      const filePath = join(instancePath, file.path)
      if (file.path.startsWith('mods/') || file.path.startsWith('resourcepacks/') || file.path.startsWith('shaderpacks/')) {
        const fStat = await stat(filePath)
        let resource = await this.resourceService.getReosurceByIno(fStat.ino)
        if (!resource) {
          const sha1 = await this.worker.checksum(filePath, 'sha1')
          resource = await this.resourceService.getResourceByHash(sha1)
        }

        if (!file.override && resource) {
          let handled = false
          if (resource.metadata.curseforge && (curseforgeConfig || mcbbsManifest)) {
            // curseforge
            curseforgeConfig?.files.push({ projectID: resource.metadata.curseforge.projectId, fileID: resource.metadata.curseforge.fileId, required: true })
            mcbbsManifest?.files!.push({ projectID: resource.metadata.curseforge.projectId, fileID: resource.metadata.curseforge.fileId, type: 'curse', force: false })
            handled = true
          }

          if (modrinthManifest) {
            // modrinth not allowed to include curseforge source by regulation
            const availableDownloads = resource.uris.filter(u => isAllowInModrinthModpack(u, options.strictModeInModrinth))
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
                sha1: resource.hash,
                sha512: await this.worker.checksum(filePath, 'sha512'),
              },
              downloads: availableDownloads,
              fileSize: (await stat(filePath)).size,
              env: Object.keys(env).length > 0 ? env as any : undefined,
            }

            if (availableDownloads.length === 0) {
              backfillModrinth.push([result, resource])
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
            await this.resourceService.updateResources([{
              hash: resource.hash,
              uris: [...resource.uris, matched.url],
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

    try {
      await this.submit(zipTask)
      // TODO: move this to client
      // this.instanceService.editInstance({ instancePath, modpackVersion: version })
      this.app.shell.showItemInFolder(destinationPath)
    } finally {
      // TODO: handle
    }
  }

  protected async getCachedInstallProfile(path: string) {
    const fStat = await stat(path)
    if (!fStat.isFile()) {
      throw new ModpackException({ type: 'requireModpackAFile', path }, `Cannot import modpack ${path}, since it's not a file!`)
    }

    let resource = await this.resourceService.getReosurceByIno(fStat.ino)

    if (resource && resource.metadata.instance) {
      this.log(`Get modpack profile by cached ino ${path}`)
      return transformInstance(resource.metadata.instance)
    }

    const hash = await this.worker.checksum(path, 'sha1')
    resource = await this.resourceService.getResourceByHash(hash)
    if (resource && resource.metadata.instance) {
      this.log(`Get modpack profile by cached hash ${path}`)
      return transformInstance(resource.metadata.instance)
    }

    return hash
  }

  async getModpackInstallFiles(modpackFile: string): Promise<InstanceFile[]> {
    const cacheOrHash = await this.getCachedInstallProfile(modpackFile)

    if (typeof cacheOrHash === 'object') return cacheOrHash.files

    this.log(`Parse modpack profile ${modpackFile}`)

    const zip = await open(modpackFile)

    const entries = await readAllEntries(zip)

    const [manifest, handler] = await this.getManifestAndHandler(zip, entries)

    if (!manifest || !handler) throw new ModpackException({ type: 'invalidModpack', path: modpackFile })

    const instance = handler.resolveInstanceOptions(manifest)

    const instanceFiles = await handler.resolveInstanceFiles(manifest)

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
            `zip://${cacheOrHash}/${e.fileName}`,
          ],
        }
        return file
      })
      .concat(instanceFiles)
      .filter(f => !f.path.endsWith('/'))

    for (const file of files) {
      transformFile(file)
    }

    this.log(`Update instance resource modpack profile ${modpackFile}`)
    await this.resourceService.updateResources([{
      hash: cacheOrHash,
      metadata: {
        instance: {
          instance,
          files,
        },
      },
    }])
    handler.resolveModpackMetadata?.(modpackFile, cacheOrHash).then((metadata) => this.resourceService.updateResources([{
      hash: cacheOrHash,
      metadata: {
        ...metadata,
      },
    }])).catch((e) => {
      this.error(new AnyError('ModpackInstallProfileError', 'Fail to update resource', { cause: e }))
    })

    return files
  }

  private async getManifestAndHandler(zip: ZipFile, entries: Entry[]) {
    for (const handler of Object.values(this.handlers)) {
      const manifest = await handler.readManifest(zip, entries).catch(e => undefined)
      if (manifest) {
        return [manifest, handler] as const
      }
    }
    return [undefined, undefined]
  }

  async showModpacksFolder(): Promise<void> {
    this.app.shell.openDirectory(this.getPath('modpacks'))
  }
}
