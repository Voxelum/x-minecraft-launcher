import { Frame } from '@xmcl/gamesetting'
import { ServiceKey } from './Service'
export interface EditGameSettingOptions extends Frame {
  /**
   * The instance to edit game setting.
   *
   * By default this will be the selected instance.
   */
  instancePath?: string
}
/**
 * The service for game setting
 */
export interface InstanceGameSettingService {
  refresh(): Promise<void>
  saveInstanceGameSetting(): Promise<void>
  /**
   * Read the instance game settings. If the instance does not have game setting, then it will return the empty object {}.
   * @param path The instance path
   */
  getInstanceGameSettings(path: string): Promise<Frame>
  /**
   * Edit the game setting of current instance
   * @param gameSetting The game setting edit options
   */
  edit(gameSetting: EditGameSettingOptions): Promise<void>
  showInFolder(): Promise<void>
}

export const InstanceGameSettingServiceKey: ServiceKey<InstanceGameSettingService> = 'InstanceGameSettingService'
