import { ServiceKey } from './Service'

export interface InstanceScreenshotService {
  /**
   * The urls of the screenshots
   */
  getScreenshots(instancePath: string): Promise<string[]>

  showScreenshot(url: string): Promise<void>
}

export const InstanceScreenshotServiceKey: ServiceKey<InstanceScreenshotService> = 'InstanceScreenshotService'
