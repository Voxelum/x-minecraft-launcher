import { Frame, parse } from '@xmcl/gamesetting'
import { compareRelease, compareSnapshot, EditGameSettingOptions, EditShaderOptions, InstanceOptionException, InstanceOptionsService as IInstanceOptionsService, InstanceOptionsServiceKey, InstanceOptionsState, isCompatible, isReleaseVersion, isSnapshotPreview, packFormatVersionRange, parseShaderOptions, ResourceDomain, stringifyShaderOptions } from '@xmcl/runtime-api'
import { FSWatcher } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import watch from 'node-watch'
import { basename, join, relative } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { deepClone } from '../util/clone'
import { isSystemError } from '../util/error'
import { missing } from '../util/fs'
import { requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

/**
 * The service to watch game setting (options.txt) and shader options (optionsshader.txt)
 */
@ExposeServiceKey(InstanceOptionsServiceKey)
export class InstanceOptionsService extends StatefulService<InstanceOptionsState> implements IInstanceOptionsService {
  private watcher: FSWatcher | undefined

  private watchingInstance = ''

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, () => new InstanceOptionsState())
    this.storeManager.subscribe('instanceSelect', (payload: string) => {
      this.mount(payload)
    })

    resourceService.registerInstaller(ResourceDomain.ResourcePacks, async (resource, instancePath) => {
      if (instancePath !== this.instanceService.state.path) {
        const frame = await this.getGameOptions(instancePath)
        await this.editGameSetting({
          ...frame,
          resourcePacks: [...(frame.resourcePacks || []), relative(resource.path, instancePath)],
        })
      } else {
        if (this.state.options.resourcePacks instanceof Array) {
          await this.editGameSetting({
            resourcePacks: [...this.state.options.resourcePacks, relative(resource.path, instancePath)],
          })
        } else {
          this.error(new Error(`Invalid options resourcepack ${this.state.options.resourcePacks}`))
        }
      }
    })

    resourceService.registerInstaller(ResourceDomain.ShaderPacks, async (resource, instancePath) => {
      await this.editShaderOptions({
        shaderPack: relative(resource.path, instancePath),
      })
    })
  }

  async dispose() {
    this.watcher?.close()
  }

  @Singleton()
  async refresh() {
    if (this.watchingInstance) {
      this.mount(this.watchingInstance)
    }
  }

  // TODO: use lock for this
  @Singleton()
  async mount(path: string) {
    requireString(path)

    if (this.watchingInstance !== path) {
      this.log(`Start to watch instance options.txt in ${path}`)
      this.watcher = watch(path, (event, file) => {
        if (basename(file) === ('options.txt')) {
          this.loadOptionsTxt(this.watchingInstance)
        }
        if (basename(file) === ('optionsshaders.txt')) {
          this.loadShaderOptions(this.watchingInstance)
        }
      })
      this.watchingInstance = path
      await this.loadOptionsTxt(this.watchingInstance)
      await this.loadShaderOptions(this.watchingInstance)
    }
  }

  private async loadShaderOptions(path: string) {
    try {
      const result = await this.getShaderOptions(path)
      this.state.instanceShaderOptions(result)
    } catch (e) {
      if (isSystemError(e)) {
        this.warn(`An error ocurred during load shader options of ${path}.`)
        this.warn(e)
      }
      this.state.instanceShaderOptions({ shaderPack: '' })
    }
  }

  private async loadOptionsTxt(path: string) {
    try {
      const result = await this.getGameOptions(path)
      this.state.instanceGameSettingsLoad(result)
    } catch (e) {
      if (isSystemError(e)) {
        this.warn(`An error ocurred during parse game options of ${path}.`)
        this.warn(e)
      }
      this.state.instanceGameSettingsLoad({ resourcePacks: [] })
    }
  }

  /**
   * Load `optionsshader.txt` file
   */
  async getShaderOptions(instancePath: string) {
    const optionsPath = join(instancePath, 'optionsshaders.txt')

    const content = await readFile(optionsPath, 'utf-8').catch((e) => '')
    const options = parseShaderOptions(content)

    return options
  }

  async getGameOptions(instancePath: string) {
    const optionsPath = join(instancePath, 'options.txt')
    const result = await readFile(optionsPath, 'utf-8').then(parse, () => ({} as Frame))

    if (typeof result.resourcePacks === 'string') {
      result.resourcePacks = JSON.parse(result.resourcePacks)
    }

    return result
  }

  async editShaderOptions(options: EditShaderOptions): Promise<void> {
    const instancePath = options.instancePath ?? this.watchingInstance
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      throw new InstanceOptionException({ type: 'instanceNotFound', instancePath: options.instancePath! })
    }
    const current = instancePath !== this.watchingInstance
      ? await this.getShaderOptions(instancePath)
      : deepClone(this.state.shaderoptions)

    current.shaderPack = options.shaderPack

    const configFile = join(instancePath, 'optionsshaders.txt')
    await writeFile(configFile, stringifyShaderOptions(current))
  }

  async editGameSetting(options: EditGameSettingOptions) {
    const instancePath = options.instancePath ?? this.watchingInstance
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      throw new InstanceOptionException({ type: 'instanceNotFound', instancePath: options.instancePath! })
    }
    const current = instancePath !== this.watchingInstance
      ? await this.getGameOptions(instancePath)
      : deepClone(this.state.options)

    const diff: Frame = {}
    for (const key of Object.keys(options)) {
      if (key === 'instancePath') continue
      if (key === 'resourcePacks') continue
      if (key in current && (current as any)[key] !== (options as any)[key]) {
        (diff as any)[key] = (options as any)[key]
      }
    }
    // resourcePacks:["vanilla","file/§lDefault§r..§l3D§r..Low§0§o.zip"]
    if (options.resourcePacks) {
      const mcversion = instance.runtime.minecraft
      let resourcePacks: string[]
      if ((isReleaseVersion(mcversion) && compareRelease(mcversion, '1.13.0') >= 0) ||
        (isSnapshotPreview(mcversion) && compareSnapshot(mcversion, '17w43a') >= 0)) {
        resourcePacks = options.resourcePacks
          .map(r => (r !== 'vanilla' && !r.startsWith('file/') ? `file/${r}` : r))
        if (resourcePacks.every((p) => p !== 'vanilla')) {
          resourcePacks.unshift('vanilla')
        }
      } else {
        resourcePacks = options.resourcePacks.filter(r => r !== 'vanilla')
          .map(r => (r.startsWith('file/') ? r.substring(5) : r))
      }
      if (diff.resourcePacks?.length !== resourcePacks.length || diff.resourcePacks?.some((p, i) => p !== resourcePacks[i])) {
        diff.resourcePacks = resourcePacks
      }
    }

    if (diff.resourcePacks) {
      const incompatibleResourcePacks = [] as string[]
      for (const path of diff.resourcePacks) {
        if (path === 'vanilla') {
          continue
        }
        const resourceName = path.startsWith('file/') ? path.substring('file/'.length) : path
        const resource = await this.resourceService.getResourceUnder({ domain: ResourceDomain.ResourcePacks, fileName: resourceName })
        if (resource && resource.metadata.resourcepack?.pack_format) {
          const format = resource.metadata.resourcepack.pack_format
          const versionRange = packFormatVersionRange[format]
          if (versionRange) {
            if (!isCompatible(versionRange, instance.runtime.minecraft)) {
              incompatibleResourcePacks.push(path)
            } else {
              continue
            }
          }
        }
        incompatibleResourcePacks.push(path)
      }
    }

    if (Object.keys(diff).length > 0) {
      this.log(`Edit gamesetting: ${JSON.stringify(diff, null, 4)} to ${instancePath}`)
      const optionsTxtPath = join(instancePath, 'options.txt')
      Object.assign(current, diff)
      await writeFile(optionsTxtPath, Object.entries(current)
        .map(([k, v]) => typeof v !== 'string' ? `${k}:${JSON.stringify(v)}` : `${k}:${v}`)
        .join('\n') + '\n')
    }
  }

  async showOptionsFileInFolder() {
    const optionTxt = join(this.watchingInstance, 'options.txt')
    if (await missing(optionTxt)) {
      this.app.shell.openDirectory(this.watchingInstance)
    } else {
      this.app.shell.showItemInFolder(optionTxt)
    }
  }

  async showShaderOptionsInFolder() {
    const optionTxt = join(this.watchingInstance, 'optionsshaders.txt')
    if (await missing(optionTxt)) {
      this.app.shell.openDirectory(this.watchingInstance)
    } else {
      this.app.shell.showItemInFolder(optionTxt)
    }
  }
}
