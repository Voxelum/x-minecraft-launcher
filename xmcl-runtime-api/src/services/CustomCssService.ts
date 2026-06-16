import { ServiceKey } from './Service'

export interface CustomCssEntry {
  /**
   * Unique identifier for this CSS entry
   */
  id: string
  /**
   * Display name for this CSS entry
   */
  name: string
  /**
   * The CSS content
   */
  css: string
  /**
   * Whether this entry is currently enabled
   */
  enabled: boolean
  /**
   * How this entry was added
   */
  source: 'manual' | 'file' | 'zip'
  /**
   * When this entry was created
   */
  createdAt: number
}

export interface CustomCssState {
  /**
   * Whether the custom CSS system is globally enabled
   */
  globalEnabled: boolean
  /**
   * All custom CSS entries
   */
  entries: CustomCssEntry[]
}

export interface CustomCssService {
  /**
   * Get all custom CSS entries and the global enabled state
   */
  getCustomCssState(): Promise<CustomCssState>
  /**
   * Create a new CSS entry from text input
   * @param name Display name
   * @param css CSS content
   */
  addCustomCssFromText(name: string, css: string): Promise<CustomCssEntry>
  /**
   * Import a CSS entry from a .css file
   * @param filePath Path to the .css file
   */
  addCustomCssFromFile(filePath: string): Promise<CustomCssEntry>
  /**
   * Import CSS entries from a .zip file containing .css files
   * @param filePath Path to the .zip file
   */
  addCustomCssFromZip(filePath: string): Promise<CustomCssEntry[]>
  /**
   * Update an existing CSS entry (name, css content, or enabled state)
   * @param id Entry ID
   * @param patch Fields to update
   */
  updateCustomCssEntry(id: string, patch: Partial<Pick<CustomCssEntry, 'name' | 'css' | 'enabled'>>): Promise<CustomCssEntry>
  /**
   * Remove a CSS entry
   * @param id Entry ID to remove
   */
  removeCustomCssEntry(id: string): Promise<void>
  /**
   * Export an entry's CSS content to a file on disk
   * @param id Entry ID to export
   * @param filePath Destination file path
   */
  exportCustomCssToFile(id: string, filePath: string): Promise<void>
  /**
   * Set whether the entire custom CSS system is enabled
   * @param enabled Whether to enable custom CSS globally
   */
  setGlobalCustomCssEnabled(enabled: boolean): Promise<void>
}

export const CustomCssServiceKey: ServiceKey<CustomCssService> = 'CustomCssService'
