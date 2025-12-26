import { InstanceScreenshotService as IInstanceScreenshotService, InstanceScreenshotServiceKey } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs-extra'
import { join, extname } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, Inject } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'

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
    const files = await readdir(screenshotsPath)
    
    // Filter out directories and non-image files
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
    const imageFiles = await Promise.all(
      files.map(async (file) => {
        const fullPath = join(screenshotsPath, file)
        try {
          const fileStat = await stat(fullPath)
          if (fileStat.isFile()) {
            const ext = extname(file).toLowerCase()
            if (imageExtensions.includes(ext)) {
              return file
            }
          }
        } catch (e) {
          // Ignore files that can't be stat'd
        }
        return null
      })
    )
    
    const urls = imageFiles
      .filter((file): file is string => file !== null)
      .map(file => {
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
