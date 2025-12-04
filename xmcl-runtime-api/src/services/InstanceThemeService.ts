import { ServiceKey } from './Service'
import { MediaData, ThemeData } from './ThemeService'

export interface InstanceThemeService {
  /**
   * Get the instance-specific theme data
   * @param instancePath The instance path
   * @returns The theme data or undefined if no instance theme is set
   */
  getInstanceTheme(instancePath: string): Promise<ThemeData | undefined>

  /**
   * Set the instance-specific theme data
   * @param instancePath The instance path
   * @param theme The theme data or undefined to clear instance theme
   */
  setInstanceTheme(instancePath: string, theme: ThemeData | undefined): Promise<void>

  /**
   * Add a new media (music, picture) to an instance theme.
   * Media will be stored under the instance's theme folder.
   * @param instancePath The instance path
   * @param filePath The file path to the media
   * @returns The media url
   */
  addMedia(instancePath: string, filePath: string): Promise<MediaData>

  /**
   * Remove the media from an instance theme
   * @param instancePath The instance path
   * @param url The media url
   */
  removeMedia(instancePath: string, url: string): Promise<void>

  /**
   * Copy a global theme media file to an instance's theme folder
   * @param instancePath The instance path
   * @param url The global media url (http://launcher/theme-media/...)
   * @returns The new instance media url
   */
  copyMediaFromGlobal(instancePath: string, url: string): Promise<MediaData>

  /**
   * Show the media file in folder
   * @param instancePath The instance path
   * @param url The media url
   */
  showMediaInFolder(instancePath: string, url: string): Promise<void>
}

export const InstanceThemeServiceKey: ServiceKey<InstanceThemeService> = 'InstanceThemeService'
