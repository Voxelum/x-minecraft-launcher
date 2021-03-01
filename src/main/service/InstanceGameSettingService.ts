import { exists, missing } from '/@main/util/fs'
import { requireString } from '/@shared/util/assert'
import { compareRelease, compareSnapshot, isReleaseVersion, isSnapshotPreview } from '/@shared/entities/version'
import { Frame, parse, stringify } from '@xmcl/gamesetting'
import { readFile, writeFile, FSWatcher } from 'fs-extra'
import watch from 'node-watch'
import { join } from 'path'
import Service, { MutationTrigger, Singleton } from './Service'

export type EditGameSettingOptions = Frame

/**
 * The service for game setting
 */
export default class InstanceGameSettingService extends Service {
    private watcher: FSWatcher | undefined;

    private watchingInstance = '';

    private dirty = false;

    async dispose () {
      this.watcher?.close()
    }

    async init () {
      this.loadInstanceGameSettings(this.state.instance.path)
    }

    @MutationTrigger('instanceSelect')
    protected async onInstance (payload: string) {
      this.loadInstanceGameSettings(payload)
    }

    @Singleton()
    async loadInstanceGameSettings (path: string) {
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
          this.commit('instanceCache', { gamesettings: result })
        } catch (e) {
          if (!e.message.startsWith('ENOENT:')) {
            this.warn(`An error ocurrs during parse game options of ${path}.`)
            this.warn(e)
          }
          this.commit('instanceCache', { gamesettings: { resourcePacks: [] } })
        }
        this.dirty = false
      }
    }

    @MutationTrigger('instanceGameSettings')
    async saveInstanceGameSetting () {
      const optionsTxtPath = join(this.state.instance.path, 'options.txt')
      if (await exists(optionsTxtPath)) {
        const buf = await readFile(optionsTxtPath)
        const content = parse(buf.toString())
        for (const [key, value] of Object.entries(this.state.instance.settings)) {
          if (key in content && typeof value !== 'undefined' && value !== null) {
            (content as any)[key] = value
          }
        }
        await writeFile(optionsTxtPath, stringify(content))
      } else {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(this.state.instance.settings)) {
          if (typeof value !== 'undefined') {
            result[key] = value
          }
        }
        await writeFile(optionsTxtPath, stringify(result))
      }

      this.log(`Saved instance gamesettings ${this.state.instance.path}`)
    }

    /**
     * Edit the game setting of current instance
     * @param gameSetting The game setting edit options
     */
    edit (gameSetting: EditGameSettingOptions) {
      const current = this.state.instance.settings
      const result: Frame = {}
      for (const key of Object.keys(gameSetting)) {
        if (key === 'resourcePacks') continue
        if (key in current && (current as any)[key] !== (gameSetting as any)[key]) {
          (result as any)[key] = (gameSetting as any)[key]
        }
      }
      if (gameSetting.resourcePacks) {
        const mcversion = this.getters.instance.runtime.minecraft
        let resourcePacks: string[]
        if ((isReleaseVersion(mcversion) && compareRelease(mcversion, '1.13.0') >= 0) ||
                (isSnapshotPreview(mcversion) && compareSnapshot(mcversion, '17w43a') >= 0)) {
          resourcePacks = gameSetting.resourcePacks
            .map(r => (r !== 'vanilla' && !r.startsWith('file/') ? `file/${r}` : r))
          if (resourcePacks.every((p) => p !== 'vanilla')) {
            resourcePacks.unshift('vanilla')
          }
        } else {
          resourcePacks = gameSetting.resourcePacks.filter(r => r !== 'vanilla')
            .map(r => (r.startsWith('file/') ? r.substring(5) : r))
        }
        if (result.resourcePacks?.length !== resourcePacks.length || result.resourcePacks?.some((p, i) => p !== resourcePacks[i])) {
          result.resourcePacks = resourcePacks
        }
      }
      if (Object.keys(result).length > 0) {
        this.log(`Edit gamesetting: ${JSON.stringify(result, null, 4)}`)
        this.commit('instanceGameSettings', result)
      }
    }

    async showInFolder () {
      const optionTxt = join(this.watchingInstance, 'options.txt')
      if (await missing(optionTxt)) {
        this.app.openDirectory(this.watchingInstance)
      } else {
        this.app.showItemInFolder(optionTxt)
      }
    }
}
