import { File, HashAlgo } from '@xmcl/curseforge'
import { CurseforgeModpackManifest, ExportModpackOptions, ModpackService as IModpackService, InstanceFile, McbbsModpackManifest, ModpackException, ModpackFileInfoCurseforge, ModpackInstallProfile, ModpackServiceKey, ModrinthModpackManifest, ResourceDomain, ResourceMetadata, getCurseforgeModpackFromInstance, getInstanceConfigFromCurseforgeModpack, getInstanceConfigFromMcbbsModpack, getInstanceConfigFromModrinthModpack, getMcbbsModpackFromInstance, getModrinthModpackFromInstance, isAllowInModrinthModpack } from '@xmcl/runtime-api'
import { open, openEntryReadStream, readAllEntries, readEntry } from '@xmcl/unzip'
import { stat } from 'fs/promises'
import { join } from 'path'
import { Entry, ZipFile } from 'yauzl'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { PathResolver, kGameDataPath } from '../entities/gameDataPath'
import { ResourceWorker, kResourceWorker } from '../entities/resourceWorker'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { AnyError } from '../util/error'
import { checksumFromStream } from '../util/fs'
import { requireObject } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ZipTask } from '../util/zip'
import { BaseService } from './BaseService'
import { CurseForgeService } from './CurseForgeService'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey } from './Service'

export interface ModpackDownloadableFile {
  destination: string
  downloads: string[]
  hashes: Record<string, string>
  metadata: ResourceMetadata
}

export interface ModpackHandler<M = any> {
  /**
   * @return The relative path of the entry after unpack to the instance root. `undefine` means not to unpack.
   */
  resolveUnpackPath(manifest: M, e: Entry): string | void

  readMetadata(zipFile: ZipFile, entries: Entry[]): Promise<M | undefined>
  resolveInstanceOptions(manifest: M): ModpackInstallProfile['instance']
  resolveInstanceFiles(manifest: M): Promise<InstanceFile[]>
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(ModpackServiceKey)
export class ModpackService extends AbstractService implements IModpackService {
  private handlers: Record<string, ModpackHandler> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(CurseForgeService) curseforgeService: CurseForgeService,
  ) {
    super(app)

    this.registerHandler<ModrinthModpackManifest>('modrinth', {
      async readMetadata(zip, entries) {
        const modrinthManifest = entries.find(e => e.fileName === 'modrinth.index.json')
        if (modrinthManifest) {
          const b = await readEntry(zip, modrinthManifest)
          return JSON.parse(b.toString()) as ModrinthModpackManifest
        }
        return Promise.resolve(undefined)
      },
      resolveUnpackPath: (manifest: ModrinthModpackManifest, e: Entry) => {
        if (e.fileName.startsWith('overrides')) {
          return e.fileName.substring('overrides/'.length)
        }
        if (e.fileName.startsWith('client-overrides')) {
          return e.fileName.substring('client-overrides/'.length)
        }
      },
      resolveInstanceOptions: getInstanceConfigFromModrinthModpack,
      resolveInstanceFiles: (manifest: ModrinthModpackManifest): Promise<InstanceFile[]> => {
        return Promise.resolve(manifest.files.map(meta => ({
          downloads: meta.downloads,
          hashes: meta.hashes,
          path: meta.path,
          size: meta.fileSize ?? 0,
        })))
      },
    })

    this.registerHandler<CurseforgeModpackManifest>('curseforge', {
      resolveUnpackPath: function (manifest: CurseforgeModpackManifest, e: Entry) {
        let overridePrefix = manifest.overrides ?? 'overrides/'
        if (!overridePrefix.endsWith('/')) overridePrefix += '/'
        if (e.fileName.startsWith(overridePrefix)) {
          return e.fileName.substring(overridePrefix.length)
        }
      },
      readMetadata: async (zipFile: ZipFile, entries: Entry[]): Promise<CurseforgeModpackManifest | undefined> => {
        const curseforgeManifest = entries.find(e => e.fileName === 'manifest.json')
        if (curseforgeManifest) {
          const b = await readEntry(zipFile, curseforgeManifest)
          return JSON.parse(b.toString()) as CurseforgeModpackManifest
        }
      },
      resolveInstanceOptions: getInstanceConfigFromCurseforgeModpack,
      resolveInstanceFiles: async (manifest: CurseforgeModpackManifest): Promise<InstanceFile[]> => {
        // curseforge or mcbbs
        const curseforgeFiles = manifest.files
        const files = await curseforgeService.client.getFiles(curseforgeFiles.map(f => f.fileID))
        const infos: InstanceFile[] = []

        const dict: Record<string, File> = {}
        for (const file of files) {
          if (dict[file.id]) {
            this.warn(`Duplicated curseforge file return from curseforge API: ${file.id}`)
          }
          dict[file.id] = file
        }

        for (let i = 0; i < manifest.files.length; i++) {
          const manifestFile = manifest.files[i]
          const file = dict[manifestFile.fileID]
          if (!file) {
            this.warn(`Skip file ${manifestFile.fileID} because it is not found in curseforge API`)
            continue
          }
          const domain = file.fileName.endsWith('.jar') ? ResourceDomain.Mods : file.modules.some(f => f.name === 'META-INF') ? ResourceDomain.Mods : ResourceDomain.ResourcePacks
          const sha1 = file.hashes.find(v => v.algo === HashAlgo.Sha1)?.value
          infos.push({
            downloads: file.downloadUrl ? [file.downloadUrl] : guessCurseforgeFileUrl(file.id, file.fileName),
            path: join(domain, file.fileName),
            hashes: sha1
              ? {
                sha1: file.hashes.find(v => v.algo === HashAlgo.Sha1)?.value,
              } as Record<string, string>
              : {},
            curseforge: {
              fileId: file.id,
              projectId: file.modId,
            },
            size: file.fileLength,
          })
        }

        return infos
      },
    })

    this.registerHandler<McbbsModpackManifest>('mcbbs', {
      readMetadata: async (zip, entries) => {
        const mcbbsManifest = entries.find(e => e.fileName === 'mcbbs.packmeta')
        if (mcbbsManifest) {
          return readEntry(zip, mcbbsManifest).then(b => JSON.parse(b.toString()) as McbbsModpackManifest)
        }
      },
      resolveInstanceOptions: getInstanceConfigFromMcbbsModpack,
      resolveInstanceFiles: async (manifest) => {
        const infos: InstanceFile[] = []
        if (manifest.files) {
          // curseforge or mcbbs
          const curseforgeFiles = manifest.files.map(f => f).filter((f): f is ModpackFileInfoCurseforge => !('type' in f) || f.type === 'curse' || 'hashes' in f)
          const files = await curseforgeService.client.getFiles(curseforgeFiles.map(f => f.fileID))

          const dict: Record<string, File> = {}
          for (const file of files) {
            if (dict[file.id]) {
              this.warn(`Duplicated curseforge file return from curseforge API: ${file.id}`)
            }
            dict[file.id] = file
          }

          for (let i = 0; i < files.length; i++) {
            const manifestFile = manifest.files[i]
            if (!('fileID' in manifestFile)) {
              continue
            }
            const file = dict[manifestFile.fileID]
            if (!file) {
              this.warn(`Skip file ${manifestFile.fileID} because it is not found in curseforge API`)
              continue
            }
            const domain = file.fileName.endsWith('.jar') ? ResourceDomain.Mods : file.modules.some(f => f.name === 'META-INF') ? ResourceDomain.Mods : ResourceDomain.ResourcePacks
            const sha1 = file.hashes.find(v => v.algo === HashAlgo.Sha1)?.value
            infos.push({
              downloads: file.downloadUrl ? [file.downloadUrl] : guessCurseforgeFileUrl(file.id, file.fileName),
              path: join(domain, file.fileName),
              hashes: sha1
                ? {
                  sha1: file.hashes.find(v => v.algo === HashAlgo.Sha1)?.value,
                } as Record<string, string>
                : {},
              curseforge: {
                fileId: file.id,
                projectId: file.modId,
              },
              size: file.fileLength,
            })
          }
        }
        return infos
      },
      resolveUnpackPath: function (manifest: McbbsModpackManifest, e: Entry) {
        const overridePrefix = 'overrides/'
        if (e.fileName.startsWith(overridePrefix)) {
          return e.fileName.substring(overridePrefix.length)
        }
      },
    })
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

    const { instancePath, destinationPath, files, name, version, gameVersion, author, emitCurseforge = true, emitMcbbs = true, emitModrinth = false } = options

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
          if (resource.metadata.curseforge) {
            // curseforge
            curseforgeConfig?.files.push({ projectID: resource.metadata.curseforge.projectId, fileID: resource.metadata.curseforge.fileId, required: true })
            mcbbsManifest?.files!.push({ projectID: resource.metadata.curseforge.projectId, fileID: resource.metadata.curseforge.fileId, type: 'curse', force: false })
            continue
          } else if (!file.override && resource) {
            // modrinth not allowed to include curseforge source by regulation
            const availableDownloads = resource.uris.filter(u => isAllowInModrinthModpack(u, options.strictModeInModrinth))
            if (availableDownloads.length > 0) {
              modrinthManifest?.files.push({
                path: file.path,
                hashes: {
                  sha1: await this.worker.checksum(filePath, 'sha1'),
                  sha256: await this.worker.checksum(filePath, 'sha256'),
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
      mcbbsManifest?.files!.push({ type: 'addon', force: false, path: file.path, hash: await this.worker.checksum(filePath, 'sha1') })
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
      this.baseService.showItemInDirectory(destinationPath)
    } finally {
      // TODO: handle
    }
  }

  async getModpackInstallProfile(path: string): Promise<ModpackInstallProfile> {
    const fStat = await stat(path)
    if (!fStat.isFile()) {
      throw new ModpackException({ type: 'requireModpackAFile', path }, `Cannot import modpack ${path}, since it's not a file!`)
    }

    const transformFile = (file: InstanceFile) => {
      file.path = file.path.replaceAll('\\', '/')
      return file
    }

    const transformInstance = <T extends { files: InstanceFile[] }>(o: T) => {
      for (const file of o.files) transformFile(file)
      return o
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

    this.log(`Parse modpack profile ${path}`)

    const zip = await open(path)
    const entries = await readAllEntries(zip)

    const [manifest, handler] = await this.getManifestAndHandler(zip, entries)

    if (!manifest || !handler) throw new ModpackException({ type: 'invalidModpack', path })

    const instance = handler.resolveInstanceOptions(manifest)

    const instanceFiles = await handler.resolveInstanceFiles(manifest)

    const files = (await Promise.all(entries
      .filter((e) => !!handler.resolveUnpackPath(manifest, e) && !e.fileName.endsWith('/'))
      .map(async (e) => {
        const sha1 = await checksumFromStream(await openEntryReadStream(zip, e), 'sha1')
        const relativePath = handler.resolveUnpackPath(manifest, e)!
        const file: InstanceFile = {
          path: relativePath,
          size: e.uncompressedSize,
          hashes: {
            sha1,
            crc32: e.crc32.toString(),
          },
          downloads: [
            `zip:///${path}?entry=${encodeURIComponent(e.fileName)}`,
            `zip://${sha1}/${e.fileName}`,
          ],
        }
        return file
      })))
      .concat(instanceFiles)
      .filter(f => !f.path.endsWith('/'))

    for (const file of files) {
      transformFile(file)
    }

    try {
      // Update the resource
      this.log(`Update instance resource modpack profile ${path}`)
      await this.resourceService.updateResources([{
        hash,
        metadata: {
          instance: {
            instance,
            files,
          },
        },
      }])
    } catch (e) {
      this.error(new AnyError('ModpackInstallProfileError', 'Fail to update resource', { cause: e }))
    }

    return {
      instance,
      files,
    }
  }

  private async getManifestAndHandler(zip: ZipFile, entries: Entry[]) {
    for (const handler of Object.values(this.handlers)) {
      const manifest = await handler.readMetadata(zip, entries).catch(e => undefined)
      if (manifest) {
        return [manifest, handler] as const
      }
    }
    return [undefined, undefined]
  }

  async showModpacksFolder(): Promise<void> {
    this.baseService.openDirectory(this.getPath('modpacks'))
  }
}
