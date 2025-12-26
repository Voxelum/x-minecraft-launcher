import { InstanceScreenshotService as IInstanceScreenshotService, InstanceScreenshotServiceKey } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { readdir } from 'fs-extra'
import { join, extname } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, Inject } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'

const IMAGE_EXTENSIONS: readonly string[] = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']

@ExposeServiceKey(InstanceScreenshotServiceKey)
export class InstanceScreenshotService extends AbstractService implements IInstanceScreenshotService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  async getScreenshots(instancePath: string): Promise<string[]> {
    const screenshotsPath = join(instancePath, 'screenshots')
    if (!existsSync(screenshotsPath)) {
      return []
    }
    const entries = await readdir(screenshotsPath, { withFileTypes: true })
    
    // Filter out directories and non-image files
    const imageFiles = entries
      .filter(entry => {
        if (!entry.isFile()) {
          return false
        }
        const ext = extname(entry.name).toLowerCase()
        return IMAGE_EXTENSIONS.includes(ext)
      })
      .map(entry => entry.name)
    
    const urls = imageFiles.map(file => {
      const url = new URL('http://launcher/media')
      url.searchParams.append('path', join(screenshotsPath, file))
      return url.toString()
    })
    return urls
  }

  async showScreenshot(url: string): Promise<void> {
    const parsed = new URL(url)
    const path = parsed.searchParams.get('path')
    if (path && existsSync(path)) {
      this.app.shell.showItemInFolder(path)
    }
  }
}
