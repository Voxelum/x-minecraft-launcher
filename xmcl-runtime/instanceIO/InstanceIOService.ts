import { CreateInstanceManifest, CreateInstanceOption, ExportInstanceOptions, InstanceIOService as IInstanceIOService, InstanceFile, InstanceIOServiceKey, InstanceType, LockKey } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
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
import { requireObject } from '../util/object'
import { ZipTask } from '../util/zip'
import { parseModrinthInstance, parseModrinthInstanceFiles } from './parseModrinthInstance'
import { parseMultiMCInstance, parseMultiMcInstanceFiles } from './parseMultiMCInstance'
import { parseVanillaInstance, parseVanillaInstanceFiles } from './parseVanillaInstance'

@ExposeServiceKey(InstanceIOServiceKey)
export class InstanceIOService extends AbstractService implements IInstanceIOService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(VersionService) private versionService: VersionService,
  ) {
    super(app)
  }

  async getGameDefaultPath(type?: 'modrinth-root' | 'modrinth-instances' | 'vanilla') {
    if (type === 'modrinth-root' || type === 'modrinth-instances') {
      const dir = join(this.app.host.getPath('appData'), 'com.modrinth.theseus')
      if (type === 'modrinth-instances') {
        return join(dir, 'profiles')
      }
      return dir
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

  async parseInstances(path: string, type?: InstanceType): Promise<CreateInstanceManifest[]> {
    try {
      if (type === 'mmc') {
        const options = await parseMultiMCInstance(path)
        return [{
          options,
          path: join(path, '.minecraft'),
          isIsolated: true,
        }]
      }

      if (type === 'modrinth') {
        // const instancesPath = join(path, 'profiles')
        // const instances = await readdir(instancesPath)
        // const manifests = await Promise.all(instances.map(async (instance) => {
        // const instancePath = join(instancesPath, instance)
        const options = await parseModrinthInstance(path)
        return [{
          options,
          path,
          isIsolated: true,
        }]
      }

      const versionMetadataService = await this.app.registry.get(VersionMetadataService)
      const vanillaInstances = await parseVanillaInstance(path, versionMetadataService)

      return vanillaInstances
    } catch (e) {
      if (isSystemError(e)) {
        if (e.code === 'ENOENT') {
          throw new AnyError('BadInstance', undefined, { cause: e }, { path })
        }
      }
      throw e
    }
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
      releases.push(await this.semaphoreManager.getLock(LockKey.assets).acquireRead())
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
      releases.push(await this.semaphoreManager.getLock(LockKey.version(versionId)).acquireRead())
      if (includeVersionJar && await exists(join(versionPath, `${versionId}.jar`))) {
        zipTask.addFile(join(versionPath, `${versionId}.jar`), `versions/${versionId}/${versionId}.jar`)
      }
      zipTask.addFile(join(versionPath, `${versionId}.json`), `versions/${versionId}/${versionId}.json`)
    }

    // add libraries
    if (includeLibraries) {
      releases.push(await this.semaphoreManager.getLock(LockKey.libraries).acquireRead())
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
