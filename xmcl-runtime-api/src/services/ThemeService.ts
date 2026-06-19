import { ServiceKey } from './Service'
import { GenericEventEmitter } from '../events'

export interface MediaData {
  url: string
  type: 'audio' | 'video' | 'image' | 'font'
  mimeType: string
}

export interface ThemeServiceEventMap {
  /**
   * Emitted when the current theme's custom CSS content changes (edited or
   * replaced by a theme import). Carries the new CSS content.
   */
  'custom-css-changed': string
}

export interface ThemeData {
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
   *
   * Notable keys:
   * - `customCssEnabled` (boolean): whether the theme's custom CSS is applied.
   */
  settings?: Record<string, string | number | boolean>
}

export interface StoredTheme {
  /**
   * The name of the stored theme (file name without extension)
   */
  name: string
}

export interface ThemeService extends GenericEventEmitter<ThemeServiceEventMap> {
  /**
   * Add a new media (music, picture) to the global theme.
   * Media will be stored in the 'theme-media' folder.
   * @param filePath The file path to the media
   * @returns The media data with url
   */
  addMedia(filePath: string): Promise<MediaData>
  /**
   * Remove the media from the global theme
   * @param url The media url
   */
  removeMedia(url: string): Promise<void>
  /**
   * Show the media file in the system file explorer
   * @param url The media url
   */
  showMediaItemInFolder(url: string): Promise<void>

  /**
   * Get the current active global theme.
   * This reads from theme.json in the appdata folder.
   * @returns The current theme data or undefined if not set
   */
  getCurrentTheme(): Promise<ThemeData | undefined>
  /**
   * Set the current active global theme.
   * This writes to theme.json in the appdata folder.
   * @param data The theme data to set
   */
  setCurrentTheme(data: ThemeData): Promise<void>

  /**
   * Get the list of stored themes (.xtheme files in the themes folder)
   * @returns Array of stored theme info
   */
  getStoredThemes(): Promise<StoredTheme[]>
  /**
   * Save the current theme to the themes store as an .xtheme file.
   * The current custom CSS (content + enabled state) is bundled into the zip.
   * If a theme with the same name exists, it will be replaced.
   * @param name The name for the stored theme
   */
  saveThemeToStore(name: string): Promise<void>
  /**
   * Load a theme from the store, replacing the current theme.
   * This will:
   * 1. Clear current theme-media folder
   * 2. Extract the stored theme's media to theme-media folder
   * 3. Update theme.json with the stored theme's settings
   * 4. Replace the current custom CSS with the theme's bundled custom CSS
   * @param name The name of the stored theme to load
   */
  loadThemeFromStore(name: string): Promise<ThemeData>
  /**
   * Delete a stored theme from the themes folder
   * @param name The name of the stored theme to delete
   */
  deleteStoredTheme(name: string): Promise<void>

  /**
   * Export current theme to a .xtheme file at specified location.
   * The current custom CSS (content + enabled state) is bundled into the zip.
   * @param destinationFile The destination file path
   * @returns The actual file path written
   */
  exportTheme(destinationFile: string): Promise<string>
  /**
   * Import a theme from a .xtheme file, replacing the current theme.
   * This will:
   * 1. Clear current theme-media folder  
   * 2. Extract the imported theme's media to theme-media folder
   * 3. Update theme.json with the imported theme's settings
   * 4. Replace the current custom CSS with the theme's bundled custom CSS
   * @param zipFilePath The path to the .xtheme file
   * @returns The imported theme data
   */
  importTheme(zipFilePath: string): Promise<ThemeData>

  /**
   * Get the current theme's custom CSS content. The enable/disable state is
   * stored in theme.json (settings.customCssEnabled), not here.
   * @returns The CSS content, or an empty string if none is set
   */
  getCustomCss(): Promise<string>
  /**
   * Set the current theme's custom CSS content. This writes a single css file
   * that is bundled into / replaced by the theme zip.
   * @param css The CSS content
   */
  setCustomCss(css: string): Promise<void>
}

export const ThemeServiceKey: ServiceKey<ThemeService> = 'ThemeService'
