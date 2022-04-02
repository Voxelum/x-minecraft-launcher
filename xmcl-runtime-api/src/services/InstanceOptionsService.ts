import type { Frame as GameSetting } from '@xmcl/gamesetting'
import { ShaderOptions } from '../entities/shaderpack'
import { Exception, InstanceNotFoundException } from '../entities/exception'
import { ServiceKey, StatefulService } from './Service'
export interface EditGameSettingOptions extends GameSetting {
  /**
   * The instance to edit game setting.
   *
   * By default this will be the selected instance.
   */
  instancePath?: string
}

export interface EditShaderOptions extends ShaderOptions {
  /**
   * The instance to edit shader config.
   *
   * By default this will be the selected instance.
   */
  instancePath?: string
}

export class InstanceOptionsState {
  options: {
    resourcePacks: Array<string>
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
  } = {
    resourcePacks: [],
    anaglyph3d: undefined,
    ao: undefined,
    useVbo: undefined,
    enableVsync: undefined,
    difficulty: undefined,
    entityShadows: undefined,
    fboEnable: undefined,
    fullscreen: undefined,
    renderDistance: undefined,
    fancyGraphics: undefined,
    renderClouds: undefined,
  }

  shaderoptions: ShaderOptions = {
    shaderPack: '',
  }

  instanceShaderOptions(options: ShaderOptions) {
    Object.assign(this.shaderoptions, options)
  }

  /**
   * Update the game settings in options.txt
   * @param payload The new game settings.
   */
  instanceGameSettingsLoad(settings: GameSetting) {
    const resourcePacks = settings.resourcePacks || []
    Object.assign(this.options, settings)
    this.options.resourcePacks = [...resourcePacks]
    this.options.anaglyph3d = settings.anaglyph3d
    this.options.ao = settings.ao
    this.options.useVbo = settings.useVbo
    this.options.enableVsync = settings.enableVsync
    this.options.difficulty = settings.difficulty
    this.options.entityShadows = settings.entityShadows
    this.options.fboEnable = settings.fboEnable
    this.options.fullscreen = settings.fullscreen
    this.options.renderDistance = settings.renderDistance
    this.options.fancyGraphics = settings.fancyGraphics
    this.options.renderClouds = settings.renderClouds
  }

  instanceGameSettings(settings: GameSetting) {
    const container = this.options as Record<string, any>
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
 * The service for game options & shader options
 */
export interface InstanceOptionsService extends StatefulService<InstanceOptionsState> {
  /**
   * Refersh the game setting from options.txt file
   */
  refresh(): Promise<void>
  getShaderOptions(instancePath: string): Promise<ShaderOptions>
  getGameOptions(instancePath: string): Promise<GameSetting>
  /**
   * Edit the game setting of current instance
   * @param options The game setting edit options
   */
  editGameSetting(options: EditGameSettingOptions): Promise<void>
  /**
   * Edit the shader options of current instance
   * @param options Edit shader options
   */
  editShaderOptions(options: EditShaderOptions): Promise<void>
  /**
   * Show open gamesetting instance
   */
  showOptionsFileInFolder(): Promise<void>

  showShaderOptionsInFolder(): Promise<void>
}

export const InstanceOptionsServiceKey: ServiceKey<InstanceOptionsService> = 'InstanceOptionsService'

export type InstanceOptionExceptions = InstanceNotFoundException

export class InstanceOptionException extends Exception<InstanceOptionExceptions> {}
