import { ServiceKey } from './Service'

export interface MediaData {
  url: string
  type: 'audio' | 'video' | 'image' | 'font'
  mimeType: string
}

export interface ThemeData {
  name: string
  /**
   * What UI this theme is for. It should be the same as the UI name.
   */
  ui: string
  /**
   * The version of the theme.
   */
  version: number
  /**
   * The assets included in the theme.
   */
  assets: Record<string, MediaData | MediaData[]>
  /**
   * The colors of the theme.
   */
  colors?: Record<string, string>
  /**
   * The other settings of the theme.
   */
  settings?: Record<string, string | number | boolean>
}

export interface ThemeService {
  /**
   * Add a new media (music, picture) to the theme.
   * @param filePath The file path to the media
   * @returns The media url
   */
  addMedia(filePath: string): Promise<MediaData>
  /**
   * Remove the media from the theme
   * @param url The media url
   */
  removeMedia(url: string): Promise<void>
  /**
   * Export a theme to a .xtheme (zip) file
   * @param data The theme data
   * @param destinationFile The destination file
   */
  exportTheme(data: ThemeData, destinationFile: string): Promise<string>
  /**
   * Import the theme zip file
   * @param zipFilePath The zip file path
   */
  importTheme(zipFilePath: string): Promise<ThemeData>

  showMediaItemInFolder(url: string): Promise<void>
}

export const ThemeServiceKey: ServiceKey<ThemeService> = 'ThemeService'
