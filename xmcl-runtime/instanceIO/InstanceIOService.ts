import { CreateInstanceOption, ExportInstanceAsServerOptions, ExportInstanceOptions, InstanceIOService as IInstanceIOService, InstanceFile, InstanceIOServiceKey, InstanceType, LaunchOptions, LockKey, ThirdPartyLauncherManifest } from '@xmcl/runtime-api'
import { readFile, readdir } from 'fs-extra'
import { basename, join, resolve } from 'path'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { VersionMetadataService } from '~/install'
import { InstanceService } from '~/instance'
import { kResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey } from '~/service'
import { TaskFn, kTaskExecutor } from '~/task'
import { AnyError, isSystemError } from '~/util/error'
import { VersionService } from '~/version'
import { LauncherApp } from '../app/LauncherApp'
import { copyPassively, exists } from '../util/fs'
import { isFulfilled, requireObject } from '../util/object'
import { ZipTask } from '../util/zip'
import { parseCurseforgeInstance } from './parseCurseforgeInstance'
import { parseModrinthInstance, parseModrinthInstanceFiles } from './parseModrinthInstance'
import { detectMMCRoot, parseMultiMCInstance, parseMultiMcInstanceFiles } from './parseMultiMCInstance'
import { parseVanillaInstance, parseVanillaInstanceFiles } from './parseVanillaInstance'
import { exportInstanceAsServer } from './exportInstanceAsServer'

@ExposeServiceKey(InstanceIOServiceKey)
export class InstanceIOService extends AbstractService implements IInstanceIOService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kTaskExecutor) protected submit: TaskFn,
    @Inject(kGameDataPath) protected getPath: PathResolver,
    @Inject(VersionService) protected versionService: VersionService,
  ) {
    super(app)
  }

  async exportInstanceAsServer(options: ExportInstanceAsServerOptions): Promise<void> {
    await exportInstanceAsServer.call(this, options)
  }

  async getGameDefaultPath(type?: 'modrinth' | 'modrinth-instances' | 'vanilla' | 'curseforge') {
    if (type === 'modrinth' || type === 'modrinth-instances') {
      const dir = join(this.app.host.getPath('appData'), 'com.modrinth.theseus')
      if (type === 'modrinth-instances') {
        return join(dir, 'profiles')
      }
      return dir
    }
    if (type === 'curseforge') {
      return join(this.app.host.getPath('home'), 'curseforge', 'minecraft')
    }
    return join(this.app.host.getPath('appData'), '.minecraft')
  }

  async parseInstanceFiles(path: string, type?: InstanceType): Promise<InstanceFile[]> {
    if (type === 'mmc') {
      return await parseMultiMcInstanceFiles(path, this.logger)
    }
    if (type === 'modrinth') {
      const worker = await this.app.registry.get(kResourceWorker)
      return await parseModrinthInstanceFiles(path, worker, this.logger)
    }
    return await parseVanillaInstanceFiles(path, this.logger)
  }

  async parseLauncherData(path: string, type?: InstanceType): Promise<ThirdPartyLauncherManifest> {
    try {
      if (type === 'mmc') {
        path = detectMMCRoot(path)
        const instancesPath = join(path, 'instances')
        const instances = await readdir(instancesPath)
        const manifests = await Promise.allSettled(instances.map(async (instance) => {
          const instancePath = join(instancesPath, instance)
          const options = await parseMultiMCInstance(instancePath)
          return {
            options,
            path: instancePath,
          }
        }))
        return {
          folder: {
            assets: join(path, 'assets'),
            libraries: join(path, 'libraries'),
            versions: '',
          },
          instances: manifests.filter(isFulfilled).map((m) => m.value),
        }
      }

      if (type === 'modrinth') {
        const instancesPath = join(path, 'profiles')
        const instances = await readdir(instancesPath)
        const manifests = await Promise.allSettled(instances.map(async (instance) => {
          const instancePath = join(instancesPath, instance)
          const options = await parseModrinthInstance(instancePath)
          return {
            options,
            path: instancePath,
          }
        }))

        const assets = join(path, 'meta', 'assets')
        const libraries = join(path, 'meta', 'libraries')
        const versions = join(path, 'meta', 'versions')
        const jre = join(path, 'meta', 'java_versions')

        return {
          folder: {
            assets: await exists(assets) ? assets : '',
            libraries: await exists(libraries) ? libraries : '',
            versions: await exists(versions) ? versions : '',
            jre: await exists(jre) ? jre : undefined,
          },
          instances: manifests.filter(isFulfilled).map((m) => m.value),
        }
      }

      if (type === 'curseforge') {
        const instancesPath = join(path, 'Instances')
        const minecraftDataPath = join(path, 'Install')

        const instances = await readdir(instancesPath)
        const manifests = await Promise.allSettled(instances.map(async (instance) => {
          const instancePath = join(instancesPath, instance)
          const options = await parseCurseforgeInstance(instancePath)
          return {
            options,
            path: instancePath,
          }
        }))

        const versionDir = join(minecraftDataPath, 'versions')
        const libDir = join(minecraftDataPath, 'libraries')
        const assetsDir = join(minecraftDataPath, 'assets')

        return {
          folder: {
            versions: await exists(versionDir) ? versionDir : '',
            libraries: await exists(libDir) ? libDir : '',
            assets: await exists(assetsDir) ? assetsDir : '',
          },
          instances: manifests.filter(isFulfilled).map((m) => m.value),
        }
      }

      const versionMetadataService = await this.app.registry.get(VersionMetadataService)
      const vanillaInstances = await parseVanillaInstance(path, versionMetadataService)

      const assets = join(path, 'assets')
      const libraries = join(path, 'libraries')
      const versions = join(path, 'versions')
      const jre = join(path, 'jre')

      return {
        folder: {
          assets: await exists(assets) ? assets : '',
          libraries: await exists(libraries) ? libraries : '',
          versions: await exists(versions) ? versions : '',
          jre: await exists(jre) ? jre : '',
        },
        instances: vanillaInstances.map((v) => ({
          options: v.options,
          path: v.path,
        })),
      }
    } catch (e) {
      if (isSystemError(e)) {
        if (e.code === 'ENOENT') {
          throw new AnyError('BadInstance', undefined, { cause: e }, { path })
        }
      }
      throw e
    }
  }

  async importLauncherData(data: ThirdPartyLauncherManifest): Promise<void> {
    const { instances, folder } = data

    if (folder.assets) {
      await copyPassively(folder.assets, this.getPath('assets'))
    }
    if (folder.libraries) {
      await copyPassively(folder.libraries, this.getPath('libraries'))
    }
    if (folder.versions) {
      await copyPassively(folder.versions, this.getPath('versions'))
    }
    if (folder.jre) {
      await copyPassively(folder.jre, this.getPath('jre'))
    }

    await Promise.allSettled(instances.map(async ({ path, options }) => {
      options.name = options.name || basename(path)
      const instPath = await this.instanceService.createInstance(options)
      await copyPassively(path, instPath, (name) => {
        if (name === 'libraries') {
          return false
        }
        if (name === 'assets') {
          return false
        }
        if (name === 'versions') {
          return false
        }
        if (name === 'java_versions') {
          return false
        }
        if (name === 'jre') {
          return false
        }
        return true
      })
    }))
  }

  /**
   * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
   * @param options The export instance options
   */
  async exportInstance(options: ExportInstanceOptions) {
    requireObject(options)

    const { src, destinationPath: dest, includeAssets = true, includeLibraries = true, files, includeVersionJar = true } = options

    const version = await this.versionService.resolveLocalVersion(options.version)

    const root = this.getPath()
    const from = src

    const zipTask = new ZipTask(dest).setName('modpack.export')

    const releases: Array<() => void> = []

    // add assets
    if (includeAssets) {
      releases.push(await this.mutex.of(LockKey.assets).acquire())
      const assetsJson = resolve(root, 'assets', 'indexes', `${version.assets}.json`)
      zipTask.addFile(assetsJson, `assets/indexes/${version.assets}.json`)
      const objects = await readFile(assetsJson, 'utf8').then(JSON.parse).then(manifest => manifest.objects)
      for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
        zipTask.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`)
      }
    }

    // add version json and jar
    const versionsChain = version.pathChain
    for (const versionPath of versionsChain) {
      const versionId = basename(versionPath)
      releases.push(await this.mutex.of(LockKey.version(versionId)).acquire())
      if (includeVersionJar && await exists(join(versionPath, `${versionId}.jar`))) {
        zipTask.addFile(join(versionPath, `${versionId}.jar`), `versions/${versionId}/${versionId}.jar`)
      }
      zipTask.addFile(join(versionPath, `${versionId}.json`), `versions/${versionId}/${versionId}.json`)
    }

    // add libraries
    if (includeLibraries) {
      releases.push(await this.mutex.of(LockKey.libraries).acquire())
      for (const lib of version.libraries) {
        zipTask.addFile(resolve(root, 'libraries', lib.download.path),
          `libraries/${lib.download.path}`)
      }
    }

    // add misc files like config, log...
    if (files) {
      for (const file of files) {
        zipTask.addFile(join(src, file), file)
      }
    } else {
      await zipTask.includeAs(from, '')
    }

    try {
      await this.submit(zipTask)
    } finally {
      releases.forEach(l => l())
    }
  }

  async importInstance(options: CreateInstanceOption & { importPath: string }) {
    const { importPath } = options

    const mcDir = importPath

    const instancePath = await this.instanceService.createInstance(options)

    await copyPassively(mcDir, instancePath, (v) => {
      if (v.endsWith('libraries')) {
        return false
      }
      if (v.endsWith('assets')) {
        return false
      }
      if (v.endsWith('versions')) {
        return false
      }
      return true
    })

    if (await exists(join(mcDir, 'libraries'))) {
      await copyPassively(join(mcDir, 'libraries'), this.getPath('libraries'))
    }
    if (await exists(join(mcDir, 'assets'))) {
      await copyPassively(join(mcDir, 'assets'), this.getPath('assets'))
    }
    if (await exists(join(mcDir, 'versions'))) {
      await copyPassively(join(mcDir, 'versions'), this.getPath('versions'))
    }

    return instancePath
  }
}
