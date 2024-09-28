import type { Frame as GameSetting } from '@xmcl/gamesetting'
import { Exception, InstanceNotFoundException } from '../entities/exception'
import { ShaderOptions } from '../entities/shaderpack'
import { MutableState } from '../util/MutableState'
import { ServiceKey } from './Service'
export interface EditGameSettingOptions extends GameSetting {
  /**
   * The instance to edit game setting.
   */
  instancePath: string
}

export interface EditShaderOptions extends ShaderOptions {
  /**
   * The instance to edit shader config.
   */
  instancePath: string
}

export interface GameOptions {
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
  lang: string
  shaderPack: string
}

export function getInstanceGameOptionKey(path: string) {
  return 'instance-game-option://' + path
}

export class GameOptionsState implements GameOptions {
  resourcePacks = []
  anaglyph3d = undefined
  ao = undefined
  useVbo = undefined
  enableVsync = undefined
  difficulty = undefined
  entityShadows = undefined
  fboEnable = undefined
  fullscreen = undefined
  renderDistance = undefined
  fancyGraphics = undefined
  renderClouds = undefined
  lang = ''
  shaderPack = ''

  gameOptionsSet(settings: GameSetting) {
    const container = this as Record<string, any>
    if (settings.resourcePacks && settings.resourcePacks instanceof Array) {
      container.resourcePacks = [...settings.resourcePacks]
    }
    for (const [key, value] of Object.entries(settings)) {
      if (key in container) {
        container[key] = value
      }
    }
  }

  shaderPackSet(pack: string) {
    this.shaderPack = pack
  }
}

/**
 * The service for game options & shader options
 */
export interface InstanceOptionsService {
  watch(path: string): Promise<MutableState<GameOptionsState>>
  /**
   * Get the shader setting of the specific instance
   * @param instancePath The instance path
   */
  getShaderOptions(instancePath: string): Promise<ShaderOptions>
  /**
   * Get the game setting of the specific instance
   * @param instancePath The instance path
   */
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
  showOptionsFileInFolder(instancePath: string): Promise<void>

  showShaderOptionsInFolder(instancePath: string): Promise<void>

  editIrisShaderOptions(options: EditShaderOptions): Promise<void>

  editOculusShaderOptions(options: EditShaderOptions): Promise<void>

  getIrisShaderOptions(instancePath: string): Promise<Record<string, string>>

  getOculusShaderOptions(instancePath: string): Promise<Record<string, string>>

  getEULA(instancePath: string): Promise<boolean>

  setEULA(instancePath: string, value: boolean): Promise<void>

  getServerProperties(instancePath: string): Promise<Record<string, string>>

  setServerProperties(instancePath: string, properties: Record<string, string>): Promise<void>
}

export const InstanceOptionsServiceKey: ServiceKey<InstanceOptionsService> = 'InstanceOptionsService'

export type InstanceOptionExceptions = InstanceNotFoundException

export class InstanceOptionException extends Exception<InstanceOptionExceptions> { }
