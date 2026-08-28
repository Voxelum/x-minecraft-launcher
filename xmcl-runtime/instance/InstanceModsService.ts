import { Resource, ResourceDomain, ResourceManager, type ResourceMetadata, type ResourceState } from '@xmcl/resource'
import { InstanceModsService as IInstanceModsService, InstanceModsServiceKey, ModMetadataService as IModMetadataService, Settings, SharedState, UpdateInstanceResourcesOptions, getInstanceModStateKey } from '@xmcl/runtime-api'
import { emptyDir, ensureDir, readdir, rename, stat } from 'fs-extra'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { ModMetadataService } from '~/moddb/ModMetadataService'
import { kResourceManager } from '~/resource'
import { ExposeServiceKey, ServiceStateManager } from '~/service'
import { kSettings } from '~/settings'
import { LauncherApp } from '../app/LauncherApp'
import { readdirIfPresent } from '../util/fs'
import { AbstractInstanceDomainService } from './AbstractInstanceDomainService'
import { getModIds, getRemovableConfigPaths, removeMappedConfigFile } from './modConfig'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
@ExposeServiceKey(InstanceModsServiceKey)
export class InstanceModsService extends AbstractInstanceDomainService implements IInstanceModsService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kResourceManager) private resourceManager: ResourceManager,
    @Inject(kSettings) private settings: SharedState<Settings>,
    @Inject(ModMetadataService) private modMetadataService: IModMetadataService,
  ) {
    super(app, ResourceDomain.Mods)
  }

  private getOperationLock(instancePath: string) {
    return this.mutex.of(`${getInstanceModStateKey(resolve(instancePath))}/operation`)
  }

  async install(options: UpdateInstanceResourcesOptions): Promise<string[]> {
    return this.getOperationLock(options.path).runExclusive(() => super.install(options))
  }

  async uninstall(options: UpdateInstanceResourcesOptions): Promise<void> {
    await this.getOperationLock(options.path).runExclusive(() => this.uninstallAndCleanup(options))
  }

  private async uninstallAndCleanup(options: UpdateInstanceResourcesOptions): Promise<void> {
    if (!this.settings.deleteModConfigsOnRemoval) {
      return super.uninstall(options)
    }

    let beforeRemoval: { resources: Array<{ path: string; metadata: ResourceMetadata }>; complete: boolean }
    try {
      beforeRemoval = await this.getInstalledModMetadata(options.path)
    } catch (e) {
      this.warn('Failed to read installed mod metadata for config cleanup', e)
      await super.uninstall(options)
      return
    }
    const requestedPaths = this.getRequestedModPaths(options)
    const removedResources = beforeRemoval.resources.filter(resource => requestedPaths.has(resolve(resource.path)))
    const removedPaths = await this.uninstallFiles(options)
    if (!beforeRemoval.complete) return

    let afterRemoval: { resources: Array<{ path: string; metadata: ResourceMetadata }>; complete: boolean }
    try {
      afterRemoval = await this.getInstalledModMetadata(options.path)
    } catch (e) {
      this.warn('Failed to verify remaining mod metadata for config cleanup', e)
      return
    }
    if (!afterRemoval.complete) return

    const removedAfterSuccessfulDelete = removedResources
      .filter(resource => removedPaths.has(resolve(resource.path)))
      .map(resource => resource.metadata)
    const removedModIds = new Set(removedAfterSuccessfulDelete.flatMap(metadata => metadata ? getModIds(metadata) : []))
    if (removedModIds.size === 0) return

    const installedModIds = new Set(afterRemoval.resources.flatMap(resource => getModIds(resource.metadata)))
    const allModIds = [...new Set([...removedModIds, ...installedModIds])]
    try {
      const mappings = await this.modMetadataService.lookupModConfigPaths(allModIds)
      const configPaths = getRemovableConfigPaths(mappings, removedModIds, installedModIds)
      await Promise.all(configPaths.map(async configPath => {
        try {
          if (await removeMappedConfigFile(options.path, configPath)) {
            this.log(`Removed config/${configPath} with its mod`)
          }
        } catch (e) {
          this.warn(`Failed to remove mapped mod config: ${configPath}`, e)
        }
      }))
    } catch (e) {
      this.warn('Failed to resolve mapped mod configs', e)
    }
  }

  private getRequestedModPaths({ files, path }: UpdateInstanceResourcesOptions) {
    const modsDirectory = resolve(path, ResourceDomain.Mods)
    const result = new Set<string>()
    for (const file of files) {
      if (typeof file !== 'string' || !file) continue
      const target = isAbsolute(file) ? resolve(file) : resolve(modsDirectory, file)
      const relativeTarget = relative(modsDirectory, target)
      if (!relativeTarget.startsWith('..') && !isAbsolute(relativeTarget)) result.add(target)
    }
    return result
  }

  private async getInstalledModMetadata(instancePath: string): Promise<{
    resources: Array<{ path: string; metadata: ResourceMetadata }>
    complete: boolean
  }> {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    const state = stateManager.get<SharedState<ResourceState>>(getInstanceModStateKey(instancePath))
    const stateByPath = new Map(state?.files.map(resource => [
      resolve(resource.path),
      resource.metadata,
    ]) ?? [])

    const modsDirectory = join(instancePath, ResourceDomain.Mods)
    const entries = await readdir(modsDirectory, { withFileTypes: true })
    let complete = true
    const resources = await Promise.all(entries.map(async entry => {
      const path = join(modsDirectory, entry.name)
      if (!entry.isFile()) {
        if (!entry.isSymbolicLink() || !(await stat(path).catch(() => undefined))?.isFile()) return
      }
      const stateMetadata = stateByPath.get(resolve(path))
      if (stateMetadata) return { path, metadata: stateMetadata }
      try {
        const snapshot = await this.resourceManager.getSnapshot(path)
        if (!snapshot) {
          complete = false
          return
        }
        const metadata = await this.resourceManager.getMetadataByHash(snapshot.sha1)
        if (!metadata) complete = false
        return metadata ? { path, metadata } : undefined
      } catch {
        complete = false
        return
      }
    }))
    return {
      resources: resources.filter((resource): resource is { path: string; metadata: ResourceMetadata } => !!resource),
      complete,
    }
  }

  async enable({ files: mods, path }: UpdateInstanceResourcesOptions): Promise<void> {
    this.log(`Enable ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      if (dirname(resource) !== instanceModsDir) {
        this.warn(`Skip to enable unmanaged mod file on ${resource}!`)
      } else if (!resource.endsWith('.disabled')) {
        this.warn(`Skip to enable enabled mod file on ${resource}!`)
      } else {
        promises.push(rename(resource, resource.substring(0, resource.length - '.disabled'.length)).catch(e => {
        }))
      }
    }
    await Promise.all(promises)
  }

  async disable({ files: mods, path }: UpdateInstanceResourcesOptions) {
    this.log(`Disable ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      if (dirname(resource) !== instanceModsDir) {
        this.warn(`Skip to disable unmanaged mod file on ${resource}!`)
      } else if (resource.endsWith('.disabled')) {
        this.warn(`Skip to disable disabled mod file on ${resource}!`)
      } else {
        promises.push(rename(resource, resource + '.disabled').catch(e => {
          this.warn(e)
        }))
      }
    }
    await Promise.all(promises)
  }

  async installToServerInstance(options: UpdateInstanceResourcesOptions): Promise<void> {
    this.log(`Install ${options.files.length} mods to server instance at ${options.path}`)
    const modsDir = join(options.path, 'server', 'mods')
    await ensureDir(modsDir)
    await emptyDir(modsDir)
    await this.install({ ...options, path: join(options.path, 'server') })
  }

  async getServerInstanceMods(path: string): Promise<Array<{ fileName: string; ino: number }>> {
    const result: Array<{ fileName: string; ino: number }> = []

    const modsDir = join(path, 'server', 'mods')
    const files = await readdirIfPresent(modsDir)
    for (const file of files) {
      const fstat = await stat(join(modsDir, file))
      result.push({ fileName: file, ino: fstat.ino })
    }

    return result
  }

  async searchInstalled(keyword: string): Promise<Resource[]> {
    return await this.resourceManager.getResourcesByKeyword(keyword, 'mods/')
  }
}
