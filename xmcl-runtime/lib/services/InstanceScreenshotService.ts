import { InstanceScreenshotService as IInstanceScreenshotService, InstanceScreenshotServiceKey } from '@xmcl/runtime-api'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { InstanceService } from './InstanceService'
import { ExposeServiceKey, AbstractService } from './Service'

@ExposeServiceKey(InstanceScreenshotServiceKey)
export class InstanceScreenshotService extends AbstractService implements IInstanceScreenshotService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService) {
    super(app)
  }

  async getScreenshots(instancePath: string): Promise<string[]> {
    const screenshotsPath = join(instancePath, 'screenshots')
    if (!existsSync(screenshotsPath)) {
      return []
    }
    const files = await readdir(screenshotsPath)
    const urls = files.map(file => pathToFileURL(join(screenshotsPath, file)).toString().replace('file://', 'image://'))
    return urls
  }

  async showScreenshot(url: string): Promise<void> {
    const fileUrl = url.replace('image://', 'file://')
    const path = fileURLToPath(fileUrl)

    if (existsSync(path)) {
      this.app.shell.showItemInFolder(path)
    }
  }
}
