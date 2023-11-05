import { Frame, parse } from '@xmcl/gamesetting'
import { EditGameSettingOptions, EditShaderOptions, GameOptionsState, InstanceOptionsService as IInstanceOptionsService, InstanceOptionException, InstanceOptionsServiceKey, ResourceDomain, compareRelease, compareSnapshot, getInstanceGameOptionKey, isCompatible, isReleaseVersion, isSnapshotPreview, packFormatVersionRange, parseShaderOptions, stringifyShaderOptions } from '@xmcl/runtime-api'
import { readFile, writeFile } from 'fs/promises'
import watch from 'node-watch'
import { basename, join, relative } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { isSystemError } from '../util/error'
import { missing } from '../util/fs'
import { requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey } from './Service'

/**
 * The service to watch game setting (options.txt) and shader options (optionsshader.txt)
 */
@ExposeServiceKey(InstanceOptionsServiceKey)
export class InstanceOptionsService extends AbstractService implements IInstanceOptionsService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) resourceService: ResourceService,
  ) {
    super(app)
    resourceService.registerInstaller(ResourceDomain.ResourcePacks, async (resource, instancePath) => {
    })

    resourceService.registerInstaller(ResourceDomain.ShaderPacks, async (resource, instancePath) => {
      await this.editShaderOptions({
        shaderPack: relative(resource.path, instancePath),
        instancePath,
      })
    })
  }

  async watch(path: string) {
    requireString(path)

    return this.storeManager.registerOrGet(getInstanceGameOptionKey(path), async () => {
      const state = new GameOptionsState()

      const loadShaderOptions = async (path: string) => {
        try {
          const result = await this.getShaderOptions(path)
          state.shaderPackSet(result.shaderPack)
        } catch (e) {
          if (isSystemError(e)) {
            this.warn(`An error ocurred during load shader options of ${path}.`)
            this.warn(e)
          }
        }
      }

      const loadOptions = async (path: string) => {
        try {
          const result = await this.getGameOptions(path)
          state.gameOptionsSet(result)
        } catch (e) {
          if (isSystemError(e)) {
            this.warn(`An error ocurred during parse game options of ${path}.`)
            this.warn(e)
          }
        }
      }

      this.log(`Start to watch instance options.txt in ${path}`)

      const watcher = watch(path, (event, file) => {
        if (basename(file) === ('options.txt')) {
          loadOptions(path)
        } else if (basename(file) === ('optionsshaders.txt')) {
          loadShaderOptions(path)
        }
      })

      await Promise.all([loadOptions(path), loadShaderOptions(path)])

      return [state, () => {
        watcher.close()
      }]
    })
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

  async editIrisShaderOptions(options: EditShaderOptions): Promise<void> {
    const instancePath = options.instancePath
    const pack = options.shaderPack
    const current = await this.getIrisShaderOptions(instancePath)
    current.shaderPack = pack
    const configFile = join(instancePath, 'config', 'iris.properties')
    await writeFile(configFile, Object.entries(current).map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
  }

  async getIrisShaderOptions(instancePath: string): Promise<Record<string, string>> {
    const filePath = join(instancePath, 'config', 'iris.properties')
    if (await missing(filePath)) return {}

    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n').map(l => l.split('=').map(s => s.trim()))
    const options = lines.reduce((a, b) => Object.assign(a, { [b[0]]: b[1] }), {}) as Record<string, string>
    return options
  }

  async editShaderOptions(options: EditShaderOptions): Promise<void> {
    const instancePath = options.instancePath
    // const instance = this.instanceService.state.all[instancePath]
    // if (!instance) {
    //   throw new InstanceOptionException({ type: 'instanceNotFound', instancePath: options.instancePath! })
    // }
    const current = await this.getShaderOptions(instancePath)

    current.shaderPack = options.shaderPack

    const configFile = join(instancePath, 'optionsshaders.txt')
    await writeFile(configFile, stringifyShaderOptions(current))
  }

  async editGameSetting(options: EditGameSettingOptions) {
    const instancePath = options.instancePath
    const current = await this.getGameOptions(instancePath)

    const diff: Frame = {}
    if (Object.keys(current).length !== 0) {
      for (const key of Object.keys(options)) {
        if (key === 'instancePath') continue
        if (key in current && (current as any)[key] !== (options as any)[key]) {
          (diff as any)[key] = (options as any)[key]
        }
      }
    } else {
      for (const key of Object.keys(options)) {
        if (key === 'instancePath') continue
        (diff as any)[key] = (options as any)[key]
      }
    }
    if (diff.lang) {
      diff.lang = diff.lang.toLowerCase().replace('-', '_')
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
