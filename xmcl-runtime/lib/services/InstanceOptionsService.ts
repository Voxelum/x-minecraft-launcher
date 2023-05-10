import { Frame, parse } from '@xmcl/gamesetting'
import { EditGameSettingOptions, EditShaderOptions, InstanceOptionsService as IInstanceOptionsService, InstanceOptionException, InstanceOptionsServiceKey, InstanceOptionsState, ResourceDomain, compareRelease, compareSnapshot, isCompatible, isReleaseVersion, isSnapshotPreview, packFormatVersionRange, parseShaderOptions, stringifyShaderOptions } from '@xmcl/runtime-api'
import { readFile, writeFile } from 'fs/promises'
import watch from 'node-watch'
import { basename, join, relative } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { isSystemError } from '../util/error'
import { missing } from '../util/fs'
import { requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey } from './Service'

/**
 * The service to watch game setting (options.txt) and shader options (optionsshader.txt)
 */
@ExposeServiceKey(InstanceOptionsServiceKey)
export class InstanceOptionsService extends AbstractService implements IInstanceOptionsService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)
    resourceService.registerInstaller(ResourceDomain.ResourcePacks, async (resource, instancePath) => {
      await this.editGameSetting({
        instancePath,
        addResourcePack: [relative(resource.path, instancePath)],
      })
    })

    resourceService.registerInstaller(ResourceDomain.ShaderPacks, async (resource, instancePath) => {
      await this.editShaderOptions({
        shaderPack: relative(resource.path, instancePath),
        instancePath,
      })
    })
  }

  async watchOptions(path: string) {
    requireString(path)
    const state = this.storeManager.register('InstaneOptions/' + path, new InstanceOptionsState())

    const loadShaderOptions = async (path: string) => {
      try {
        const result = await this.getShaderOptions(path)
        state.instanceShaderOptions(result)
      } catch (e) {
        if (isSystemError(e)) {
          this.warn(`An error ocurred during load shader options of ${path}.`)
          this.warn(e)
        }
        state.instanceShaderOptions({ shaderPack: '' })
      }
    }

    const loadOptionsTxt = async (path: string) => {
      try {
        const result = await this.getGameOptions(path)
        state.instanceGameSettingsLoad(result)
      } catch (e) {
        if (isSystemError(e)) {
          this.warn(`An error ocurred during parse game options of ${path}.`)
          this.warn(e)
        }
        state.instanceGameSettingsLoad({ resourcePacks: [] })
      }
    }

    this.log(`Start to watch instance options.txt in ${path}`)

    const watcher = watch(path, (event, file) => {
      if (basename(file) === ('options.txt')) {
        loadOptionsTxt(path)
      }
      if (basename(file) === ('optionsshaders.txt')) {
        loadShaderOptions(path)
      }
    })

    await loadOptionsTxt(path)
    await loadShaderOptions(path)

    return state
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
    const instancePath = options.instancePath
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      throw new InstanceOptionException({ type: 'instanceNotFound', instancePath: options.instancePath! })
    }
    const current = await this.getShaderOptions(instancePath)

    current.shaderPack = options.shaderPack

    const configFile = join(instancePath, 'optionsshaders.txt')
    await writeFile(configFile, stringifyShaderOptions(current))
  }

  async editGameSetting(options: EditGameSettingOptions) {
    const instancePath = options.instancePath
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      throw new InstanceOptionException({ type: 'instanceNotFound', instancePath: options.instancePath! })
    }
    const current = await this.getGameOptions(instancePath)

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

  async showOptionsFileInFolder(path: string) {
    const optionTxt = join(path, 'options.txt')
    if (await missing(optionTxt)) {
      this.app.shell.openDirectory(path)
    } else {
      this.app.shell.showItemInFolder(optionTxt)
    }
  }

  async showShaderOptionsInFolder(path: string) {
    const optionTxt = join(path, 'optionsshaders.txt')
    if (await missing(optionTxt)) {
      this.app.shell.openDirectory(path)
    } else {
      this.app.shell.showItemInFolder(optionTxt)
    }
  }
}
