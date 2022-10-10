import { HashAlgo } from '@xmcl/curseforge'
import { UnzipTask } from '@xmcl/installer'
import { CurseforgeModpackManifest, ExportModpackOptions, getResolvedVersion, ImportModpackOptions, InstanceFile, isAllowInModrinthModpack, LockKey, McbbsModpackManifest, ModpackException, ModpackFileInfoCurseforge, ModpackService as IModpackService, ModpackServiceKey, ModrinthModpackManifest, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { createHash } from 'crypto'
import { stat } from 'fs-extra'
import { basename, join, relative } from 'path'
import { pipeline } from 'stream/promises'
import { Entry, ZipFile } from 'yauzl'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { readMetadata, resolveInstanceOptions } from '../entities/modpack'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { checksumFromStream, isFile, sha1ByPath } from '../util/fs'
import { requireObject } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ZipTask } from '../util/zip'
import { BaseService } from './BaseService'
import { CurseForgeService } from './CurseForgeService'
import { InstallService } from './InstallService'
import { InstanceInstallService } from './InstanceInstallService'
import { InstanceIOService } from './InstanceIOService'
import { InstanceOptionsService } from './InstanceOptionsService'
import { InstanceService } from './InstanceService'
import { InstanceVersionService } from './InstanceVersionService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey } from './Service'
import { VersionService } from './VersionService'

export interface ModpackDownloadableFile {
  destination: string
  downloads: string[]
  hashes: Record<string, string>
  metadata: ResourceMetadata
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(ModpackServiceKey)
export class ModpackService extends AbstractService implements IModpackService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(InstallService) private installService: InstallService,
    @Inject(CurseForgeService) private curseforgeService: CurseForgeService,
    @Inject(InstanceIOService) private instanceIOService: InstanceIOService,
    @Inject(InstanceInstallService) private instanceInstallService: InstanceInstallService,
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

  async getInstallModpackProfile(path: string) {
    if (!await isFile(path)) {
      throw new ModpackException({ type: 'requireModpackAFile', path }, `Cannot import modpack ${path}, since it's not a file!`)
    }

    this.log(`Import modpack by path ${path}`)

    const resource = this.resourceService.getResourceByKey(path)

    const zip = await open(path)
    const entries = await readAllEntries(zip)

    const manifest = await readMetadata(zip, entries).catch(() => {
      throw new ModpackException({ type: 'invalidModpack', path })
    })
    const instance = resolveInstanceOptions(manifest)

    const getEntryPath = (e: Entry) => e.fileName.substring('overrides' in manifest ? manifest.overrides.length : 'overrides'.length)

    const files = (await Promise.all(entries
      .filter((e) => !e.fileName.endsWith('/') && e.fileName.startsWith('overrides' in manifest ? manifest.overrides : 'overrides'))
      .map(async (v) => {
        const sha1 = await checksumFromStream(await openEntryReadStream(zip, v), 'sha1')
        const file: InstanceFile = {
          path: getEntryPath(v),
          size: v.uncompressedSize,
          hashes: {
            sha1,
            crc32: v.crc32.toString(),
          },
          downloads: [`zip:${join(path, getEntryPath(v))}`],
        }
        return file
      })))
      .concat(await this.convertManifest(manifest))

    return {
      instance,
      files,
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
    const zip = await open(path)
    const entries = await readAllEntries(zip)

    const manifest = await readMetadata(zip, entries).catch(() => {
      throw new ModpackException({ type: 'invalidModpack', path })
    })

    const config = resolveInstanceOptions(manifest)
    let instancePath: string
    if ('instancePath' in options) {
      await this.instanceService.editInstance({
        instancePath: options.instancePath,
        ...config,
      })
      instancePath = options.instancePath
    } else {
      instancePath = await this.instanceService.createInstance({
        ...config,
        name: config.name || basename(options.path),
        ...options.instanceConfig,
      })
    }

    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))
    await lock.write(async () => {
      // If this failed, it will be the unzip failed. Then it should be safe to just fully retry.
      // No partial info should be caught.
      const unzippedFiles: InstanceFile[] = await this.submit(this.installModpackTask(zip, entries, manifest, instancePath))

      this.log(`Install ${unzippedFiles.length} files from modpack!`)
    }).catch((e) => {
      this.error(`Fail to install modpack: ${path}`)
      this.error(e)
      if (!('instancePath' in options)) {
        this.instanceService.deleteInstance(instancePath)
      }
      throw e
    })

    // Downloadable files
    const files = await this.convertManifest(manifest)

    // Try to install
    await this.instanceInstallService.installInstanceFiles({
      path: instancePath,
      files: files,
    })

    if (options.mountAfterSucceed) {
      await this.instanceService.mountInstance(instancePath)
    }

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

  private async convertManifest(manifest: CurseforgeModpackManifest | McbbsModpackManifest | ModrinthModpackManifest) {
    const infos = [] as InstanceFile[]
    const curseforgeService = this.curseforgeService
    if (manifest.files) {
      if ('manifestVersion' in manifest) {
        // curseforge or mcbbs
        const curseforgeFiles = manifest.files.map(f => f).filter((f): f is ModpackFileInfoCurseforge => !('type' in f) || f.type === 'curse' || 'hashes' in f)
        const files = await curseforgeService.fetchModFiles(curseforgeFiles.map(f => f.fileID))

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const domain = file.modules.some(f => f.name === 'META-INF') ? ResourceDomain.Mods : ResourceDomain.ResourcePacks
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
      } else {
        // modrinth
        for (const meta of manifest.files) {
          infos.push({
            downloads: meta.downloads,
            hashes: meta.hashes,
            path: meta.path,
            size: meta.fileSize ?? 0,
          })
        }
      }
    }
    return infos
  }

  private installModpackTask(zip: ZipFile, entries: Entry[], manifest: CurseforgeModpackManifest | McbbsModpackManifest | ModrinthModpackManifest, root: string) {
    return task('installModpack', async function () {
      // unzip
      const promises: Promise<InstanceFile>[] = []
      await this.yield(new UnzipTask(
        zip,
        entries.filter((e) => !e.fileName.endsWith('/') && e.fileName.startsWith('overrides' in manifest ? manifest.overrides : 'overrides')),
        root,
        (e) => e.fileName.substring('overrides' in manifest ? manifest.overrides.length : 'overrides'.length),
        async (input, file) => {
          const hash = createHash('sha1')
          let size = 0
          input.on('data', (buf) => {
            size += buf.length
          })
          promises.push(pipeline(input, hash).then(() => {
            const sha1 = hash.digest('hex')
            const relativePath = relative(root, file)
            return {
              path: relativePath,
              hashes: { sha1 },
              size,
              downloads: [`resource://${sha1}/${relativePath}`],
            }
          }))
        },
      ).setName('unpack'))

      return await Promise.all(promises)
    })
  }

  async showModpacksFolder(): Promise<void> {
    this.baseService.openDirectory(this.getPath('modpacks'))
  }
}
