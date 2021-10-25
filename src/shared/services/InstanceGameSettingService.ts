import type { Frame as GameSetting } from '@xmcl/gamesetting'
import { StatefulService, ServiceKey, State, ServiceTemplate } from './Service'
export interface EditGameSettingOptions extends GameSetting {
  /**
   * The instance to edit game setting.
   *
   * By default this will be the selected instance.
   */
  instancePath?: string
}

export class GameSettingState implements GameSetting {
  resourcePacks = [] as Array<string>
  anaglyph3d: boolean | undefined
  ao: any
  useVbo: boolean | undefined
  enableVsync: boolean | undefined
  difficulty: any
  entityShadows: boolean | undefined
  fboEnable: boolean | undefined
  fullscreen: boolean | undefined
  renderDistance: GameSetting['renderDistance']
  fancyGraphics: boolean | undefined
  renderClouds: 'fast' | boolean | undefined

  /**
   * Update the game settings in options.txt
   * @param payload The new game settings.
   */
  instanceGameSettingsLoad(settings: GameSetting) {
    const resourcePacks = settings.resourcePacks || []
    this.resourcePacks = [...resourcePacks]
    this.anaglyph3d = settings.anaglyph3d
    this.ao = settings.ao
    this.useVbo = settings.useVbo
    this.enableVsync = settings.enableVsync
    this.difficulty = settings.difficulty
    this.entityShadows = settings.entityShadows
    this.fboEnable = settings.fboEnable
    this.fullscreen = settings.fullscreen
    this.renderDistance = settings.renderDistance
    this.fancyGraphics = settings.fancyGraphics
    this.renderClouds = settings.renderClouds
  }

  instanceGameSettings(settings: GameSetting) {
    const container = this as Record<string, any>
    if (settings.resourcePacks && settings.resourcePacks instanceof Array) {
      container.resourcePacks = [...settings.resourcePacks]
    }
    for (const [key, value] of Object.entries(settings)) {
      if (key in container) {
        container[key] = value
      } else {
        container[key] = value
        // TODO: remove in vue3
        // set(container, key)
      }
    }
  }
}

/**
 * The service for game setting
 */
export interface InstanceGameSettingService extends StatefulService<GameSettingState> {
  /**
   * Refersh the game setting from options.txt file
   */
  refresh(): Promise<void>
  /**
   * Save current gamesetting to the instance options.txt file
   */
  saveInstanceGameSetting(): Promise<void>
  /**
   * Read the instance game settings. If the instance does not have game setting, then it will return the empty object {}.
   * @param path The instance path
   */
  getInstanceGameSettings(path: string): Promise<GameSetting>
  /**
   * Edit the game setting of current instance
   * @param gameSetting The game setting edit options
   */
  edit(gameSetting: EditGameSettingOptions): Promise<void>
  /**
   * Show open gamesetting instance
   */
  showInFolder(): Promise<void>
}

export const InstanceGameSettingServiceKey: ServiceKey<InstanceGameSettingService> = 'InstanceGameSettingService'
export const InstanceGameSettingServiceMethods: ServiceTemplate<InstanceGameSettingService> = {
  refresh: undefined,
  saveInstanceGameSetting: undefined,
  getInstanceGameSettings: undefined,
  edit: undefined,
  showInFolder: undefined,
  state: undefined
}
