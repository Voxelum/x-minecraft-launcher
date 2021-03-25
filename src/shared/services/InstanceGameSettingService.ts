import { Frame } from '@xmcl/gamesetting'
import { ServiceKey } from './Service'
export declare type EditGameSettingOptions = Frame
/**
 * The service for game setting
 */
export interface InstanceGameSettingService {
  refresh(): Promise<void>
  saveInstanceGameSetting(): Promise<void>
  /**
   * Edit the game setting of current instance
   * @param gameSetting The game setting edit options
   */
  edit(gameSetting: EditGameSettingOptions): void
  showInFolder(): Promise<void>
}

export const InstanceGameSettingServiceKey: ServiceKey<InstanceGameSettingService> = 'InstanceGameSettingService'
