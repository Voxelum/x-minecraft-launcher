import { Frame, parse, stringify } from '@xmcl/gamesetting'
import { FSWatcher, readFile, writeFile } from 'fs-extra'
import watch from 'node-watch'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { isSystemError } from '../util/error'
import InstanceService from './InstanceService'
import { ExportService, Inject, Singleton, StatefulService, Subscribe } from './Service'
import { exists, missing } from '/@main/util/fs'
import { Exception } from '/@shared/entities/exception'
import { compareRelease, compareSnapshot, isReleaseVersion, isSnapshotPreview } from '/@shared/entities/version'
import { EditGameSettingOptions, GameSettingState, InstanceGameSettingService as IInstanceGameSettingService, InstanceGameSettingServiceKey } from '/@shared/services/InstanceGameSettingService'
import { requireString } from '/@shared/util/assert'

/**
 * The service for game setting
 */
@ExportService(InstanceGameSettingServiceKey)
export default class InstanceGameSettingService extends StatefulService<GameSettingState> implements IInstanceGameSettingService {
  createState() { return new GameSettingState() }

  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService) {
    super(app)
  }

  private watcher: FSWatcher | undefined

  private watchingInstance = ''

  private dirty = false

  async dispose() {
    this.watcher?.close()
  }

  @Subscribe('instanceSelect')
  protected async onInstance(payload: string) {
    this.loadInstanceGameSettings(payload)
  }

  @Singleton()
  async refresh() {
    if (this.watchingInstance) {
      this.loadInstanceGameSettings(this.watchingInstance)
    }
  }

  @Singleton()
  private async loadInstanceGameSettings(path: string) {
    requireString(path)

    if (this.watchingInstance !== path) {
      this.log(`Start to watch instance options.txt in ${path}`)
      this.watcher = watch(path, (event, file) => {
        if (file.endsWith('options.txt')) {
          this.dirty = true
        }
      })
      this.watchingInstance = path
      this.dirty = true
    }
    if (this.dirty) {
      try {
        const optionsPath = join(path, 'options.txt')
        this.log(`Load instance options.txt ${optionsPath}`)
        const result = await readFile(optionsPath, 'utf-8').then(parse)
        this.state.instanceGameSettingsLoad(result)
      } catch (e) {
        if (isSystemError(e)) {
          this.warn(`An error ocurrs during parse game options of ${path}.`)
          this.warn(e)
        }
        this.state.instanceGameSettingsLoad({ resourcePacks: [] })
      }
      this.dirty = false
    }
  }

  async getInstanceGameSettings(path: string) {
    const optionsPath = join(path, 'options.txt')
    const result = await readFile(optionsPath, 'utf-8').then(parse, () => ({} as Frame))
    return result
  }

  @Subscribe('instanceGameSettings')
  async saveInstanceGameSetting() {
    const instancePath = this.watchingInstance
    const optionsTxtPath = join(instancePath, 'options.txt')

    if (await exists(optionsTxtPath)) {
      const buf = await readFile(optionsTxtPath)
      const content = parse(buf.toString())
      for (const [key, value] of Object.entries(this.state)) {
        if (key in content && typeof value !== 'undefined' && value !== null) {
          (content as any)[key] = value
        }
      }
      await writeFile(optionsTxtPath, stringify(content))
    } else {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(this.state)) {
        if (typeof value !== 'undefined') {
          result[key] = value
        }
      }
      await writeFile(optionsTxtPath, stringify(result))
    }

    this.log(`Saved instance gamesettings ${instancePath}`)
  }

  async edit(options: EditGameSettingOptions) {
    const instancePath = options.instancePath ?? this.watchingInstance
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      throw new Exception({ type: 'instanceNotFound', instancePath: options.instancePath! })
    }
    const current = instancePath !== this.watchingInstance
      ? await this.getInstanceGameSettings(instancePath)
      : this.state

    const result: Frame = {}
    for (const key of Object.keys(options)) {
      if (key === 'instancePath') continue
      if (key === 'resourcePacks') continue
      if (key in current && (current as any)[key] !== (options as any)[key]) {
        (result as any)[key] = (options as any)[key]
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
      if (result.resourcePacks?.length !== resourcePacks.length || result.resourcePacks?.some((p, i) => p !== resourcePacks[i])) {
        result.resourcePacks = resourcePacks
      }
    }
    if (Object.keys(result).length > 0) {
      this.log(`Edit gamesetting: ${JSON.stringify(result, null, 4)} to ${instancePath}`)
      this.state.instanceGameSettings(result)
    }
  }

  async showInFolder() {
    const optionTxt = join(this.watchingInstance, 'options.txt')
    if (await missing(optionTxt)) {
      this.app.openDirectory(this.watchingInstance)
    } else {
      this.app.showItemInFolder(optionTxt)
    }
  }
}
