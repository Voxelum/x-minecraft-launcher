import { InstanceScreenshotService as IInstanceScreenshotService, InstanceScreenshotServiceKey } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { readdir, unlink } from 'fs-extra'
import { join } from 'path'
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
    const urls = files.map(file => {
      const url = new URL('http://launcher/media')
      url.searchParams.append('path', join(join(screenshotsPath, file)))
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

  async deleteScreenshot(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url)
      const path = parsed.searchParams.get('path')
      if (path && existsSync(path)) {
        // Try to move to trash first
        try {
          await this.app.shell.trashItem(path)
          return true
        } catch {
          // If trash fails, delete directly
          await unlink(path)
          return true
        }
      }
      return false
    } catch (e) {
      this.error('Failed to delete screenshot:', e)
      return false
    }
  }
}
