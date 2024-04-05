import { ServiceKey } from './Service'

export interface MediaData {
  url: string
  type: 'audio' | 'video' | 'image'
  mimeType: string
}

export interface ThemeData {
  name: string

  assets: Record<string, MediaData | MediaData[]>
  colors?: Record<string, string>
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
   * @param destinationFolder The destination folder
   */
  exportTheme(data: ThemeData, destinationFolder: string): Promise<string>
  /**
   * Import the theme zip file
   * @param zipFilePath The zip file path
   */
  importTheme(zipFilePath: string): Promise<ThemeData>
}

export const ThemeServiceKey: ServiceKey<ThemeService> = 'ThemeService'
