import { ServiceKey } from './Service'

export interface ScreenshotItem {
  name: string
  url: string
  path: string
  size: number
  createdAt: number
}

export interface SaveScreenshotDataOptions {
  instancePath: string
  dataUrl: string
  originalUrl?: string
  saveAsCopy?: boolean
}

export interface InstanceScreenshotService {
  /**
   * The urls of the screenshots
   */
  getScreenshots(instancePath: string): Promise<string[]>

  /**
   * Get all screenshots with detailed metadata (name, url, file path, size, createdAt)
   */
  getScreenshotItems(instancePath: string): Promise<ScreenshotItem[]>

  /**
   * Reveal screenshot in system file manager
   */
  showScreenshot(url: string): Promise<void>

  /**
   * Delete a screenshot by its URL
   */
  deleteScreenshot(url: string): Promise<boolean>

  /**
   * Delete multiple screenshots by their URLs
   */
  deleteScreenshots(urls: string[]): Promise<number>

  /**
   * Export a screenshot without overwriting by default. Set overwrite only after explicit file confirmation.
   */
  saveScreenshotAs(url: string, targetPath: string, overwrite?: boolean): Promise<boolean>

  /**
   * Import photos or screenshots from external paths into the instance screenshots folder
   */
  importScreenshots(instancePath: string, filePaths: string[]): Promise<string[]>

  /**
   * Set a screenshot as the instance icon
   */
  setAsInstanceIcon(instancePath: string, url: string): Promise<void>

  /**
   * Save an edited screenshot from a data URL (PNG)
   */
  saveEditedScreenshot(options: SaveScreenshotDataOptions): Promise<ScreenshotItem>
}

export const InstanceScreenshotServiceKey: ServiceKey<InstanceScreenshotService> = 'InstanceScreenshotService'

