import { copyFile, ensureDir, FSWatcher, link, unlink } from 'fs-extra'
import debounce from 'lodash.debounce'
import watch from 'node-watch'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import ResourceService from './ResourceService'
import AbstractService, { Service, Singleton, Subscribe } from './Service'
import { mutateResource } from '/@main/entities/resource'
import { readdirIfPresent } from '/@main/util/fs'
import { AnyResource, isModResource, isResourcePackResource, PersistedResource } from '/@shared/entities/resource'
import { ResourceDomain } from '/@shared/entities/resource.schema'
import { DeployOptions, InstanceResourceService as IInstanceResourceService, InstanceResourceServiceKey } from '/@shared/services/InstanceResourceService'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
@Service(InstanceResourceServiceKey)
export default class InstanceResourceService extends AbstractService implements IInstanceResourceService {
  private watchingMods = ''

  private modsWatcher: FSWatcher | undefined

  private watchingResourcePack = ''

  private resourcepacksWatcher: FSWatcher | undefined

  private addModQueue: AnyResource[] = []

  private removeModQueue: AnyResource[] = []

  private addResourcePackQueue: AnyResource[] = []

  private removeResourcePackQueue: AnyResource[] = []

  private commitUpdate = debounce(() => {
    if (this.addModQueue.length > 0) {
      this.commit('instanceModAdd', this.addModQueue)
      this.addModQueue = []
    }
    if (this.removeModQueue.length > 0) {
      this.commit('instanceModRemove', this.removeModQueue)
      this.removeModQueue = []
    }
    if (this.addResourcePackQueue.length > 0) {
      this.commit('instanceResourcepackAdd', this.addResourcePackQueue)
      this.addResourcePackQueue = []
    }
    if (this.removeResourcePackQueue.length > 0) {
      this.commit('instanceResourcepackRemove', this.removeResourcePackQueue)
      this.removeResourcePackQueue = []
    }
  }, 1000)

  constructor(
    app: LauncherApp,
    private resourceService: ResourceService,
  ) {
    super(app)
  }

  private async scanMods() {
    const instance = this.getters.instance
    const dir = join(instance.path, 'mods')
    const files = await readdirIfPresent(dir)

    const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
      path: join(dir, file),
      url: [] as string[],
      source: undefined,
    }))
    const resources = await this.resourceService.importFiles({
      files: fileArgs,
      restrictToDomain: ResourceDomain.Mods,
      type: 'mods',
    })
    return resources.map((r, i) => mutateResource(r, (r) => { r.path = fileArgs[i].path }))
      .filter(isModResource)
  }

  private async scanResourcepacks() {
    const instance = this.getters.instance
    const dir = join(instance.path, 'resourcepacks')
    const files = await readdirIfPresent(dir)

    const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
      path: join(dir, file),
      url: [] as string[],
      source: undefined,
    }))

    const resources = await this.resourceService.importFiles({
      files: fileArgs,
      restrictToDomain: ResourceDomain.ResourcePacks,
      type: 'resourcepack',
    })
    return resources.map((r, i) => mutateResource(r, (r) => { r.path = fileArgs[i].path }))
      .filter(isResourcePackResource)
  }

  @Subscribe('instanceSelect')
  protected onInstance() {
    this.mountModResources()
    this.mountResourcepacks()
  }

  async dispose() {
    if (this.modsWatcher) {
      this.modsWatcher.close()
    }
    if (this.resourcepacksWatcher) {
      this.resourcepacksWatcher.close()
    }
  }

  /**
   * Read all mods under the current instance
   */
  @Singleton()
  async mountModResources(): Promise<void> {
    const basePath = join(this.state.instance.path, 'mods')

    if (this.watchingMods !== basePath || !this.modsWatcher) {
      if (this.modsWatcher) {
        this.modsWatcher.close()
      }
      this.watchingMods = basePath
      await ensureDir(basePath)
      await this.resourceService.whenModsReady()
      this.commit('instanceMods', await this.scanMods())
      this.modsWatcher = watch(basePath, (event, name) => {
        if (name.startsWith('.')) return
        const filePath = name
        if (event === 'update') {
          this.resourceService.importFile({ path: filePath, type: 'mods', background: true }).then((resource) => {
            if (isModResource(resource)) {
              this.log(`Instace mod add ${filePath}`)
            } else {
              this.warn(`Non mod resource added in /mods directory! ${filePath}`)
            }
            this.addModQueue.push(mutateResource(resource, (r) => { r.path = filePath }))
            this.commitUpdate()
          })
        } else {
          const target = this.state.instanceResource.mods.find(r => r.path === filePath)
          if (target) {
            this.log(`Instace mod remove ${filePath}`)
            this.removeModQueue.push(target)
            this.commitUpdate()
          } else {
            this.warn(`Cannot remove the mod ${filePath} as it's not found in memory cache!`)
          }
        }
      })
      this.log(`Mounted on instance mods: ${basePath}`)
    }
  }

  @Singleton()
  async mountResourcepacks(): Promise<void> {
    const basePath = join(this.state.instance.path, 'resourcepacks')

    if (this.watchingResourcePack !== basePath || !this.resourcepacksWatcher) {
      if (this.resourcepacksWatcher) {
        this.resourcepacksWatcher.close()
      }
      this.watchingResourcePack = basePath
      await ensureDir(basePath)
      await this.resourceService.whenResourcePacksReady()
      this.commit('instanceResourcepacks', await this.scanResourcepacks())
      this.resourcepacksWatcher = watch(basePath, (event, name) => {
        if (name.startsWith('.')) return
        const filePath = name
        if (event === 'update') {
          this.resourceService.importFile({ path: filePath, type: 'resourcepacks' }).then((resource) => {
            if (isResourcePackResource(resource)) {
              this.log(`Instace resource pack add ${filePath}`)
              this.addResourcePackQueue.push(mutateResource(resource, (r) => { r.path = filePath }))
              this.commitUpdate()
            } else {
              this.warn(`Non resource pack resource added in /resourcepacks directory! ${filePath}`)
            }
          })
        } else {
          const target = this.state.instanceResource.resourcepacks.find(r => r.path === filePath)
          if (target) {
            this.log(`Instace resource pack remove ${filePath}`)
            this.removeResourcePackQueue.push(target)
            this.commitUpdate()
          } else {
            this.warn(`Cannot remove the resource pack ${filePath} as it's not found in memory cache!`)
          }
        }
      })
      this.log(`Mounted on instance resource packs: ${basePath}`)
    }
  }

  deployMod(options: DeployOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }

  deployResourcePack(options: DeployOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async deploy({ resources, path = this.state.instance.path }: DeployOptions) {
    const promises: Promise<void>[] = []
    if (!path) {
      path = this.state.instance.path
    }
    if (!this.state.instance.all[path]) {
      this.warn(`Cannot deploy to the instance ${path}, as it's not found!`)
      path = this.state.instance.path
    }
    this.log(`Deploy ${resources.length} to ${path}`)
    for (const resource of resources) {
      if (resource.domain !== ResourceDomain.Mods && resource.domain !== ResourceDomain.ResourcePacks) {
        this.warn(`Skip to deploy ${resource.name} as it's not a mod or resourcepack`)
      } else {
        const src = join(this.state.root, resource.location + resource.ext)
        const dest = join(path, resource.location + resource.ext)
        promises.push(link(src, dest).catch(() => copyFile(src, dest)).catch((e) => {
          this.error(`Cannot deploy the resource from ${src} to ${dest}`)
          this.error(e)
          throw e
        }))
      }
    }
    await Promise.all(promises)
  }

  async ensureResourcePacksDeployment() {
    const allPacks = this.state.resource.resourcepacks
    const deploiedPacks = this.state.instanceResource.resourcepacks

    const toBeDeploiedPacks = allPacks.filter(p => !deploiedPacks.find((r) => r.hash === p.hash))
    this.log(`Deploying ${toBeDeploiedPacks.length} resource packs`)

    await this.deploy({ resources: toBeDeploiedPacks })
  }

  async undeploy(resources: PersistedResource[]) {
    this.log(`Undeploy ${resources.length} from ${this.state.instance.path}`)
    const promises: Promise<void>[] = []
    const path = this.state.instance.path
    for (const resource of resources) {
      if (resource.domain !== ResourceDomain.Mods && resource.domain !== ResourceDomain.ResourcePacks) {
        this.warn(`Skip to undeploy ${resource.name} as it's not a mod or resourcepack`)
      } else {
        const dest = join(path, resource.location + resource.ext)
        promises.push(unlink(dest))
      }
    }
    await Promise.all(promises)
  }
}
