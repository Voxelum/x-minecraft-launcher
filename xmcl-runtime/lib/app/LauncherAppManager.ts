import { XMLParser } from 'fast-xml-parser'
import filenamifyCombined from 'filenamify'
import { ensureDir, writeFile } from 'fs-extra'
import got from 'got/dist/source'
import { join } from 'path'
import { URL } from 'url'
import { LauncherApp } from '..'
import { AppManifest } from './AppManifest'
import { WebManifest } from './WebManifest'
import { createShortcutWin32, installWin32 } from './win32'

export interface InstallAppOptions {
  createDesktopShortcut?: boolean

  createStartMenuShortcut?: boolean
}

export class LauncherAppManager {
  readonly root: string

  constructor(readonly app: LauncherApp) {
  }

  private apps: AppManifest[] = []

  async installApp(url: string, options: InstallAppOptions = {}) {
    const webMan = await this.getAppInfo(url)
    const urlObj = new URL(url)
    const appDir = join(this.root, filenamifyCombined(urlObj.host + urlObj.pathname, { replacement: '@' }))
    await ensureDir(appDir)
    if (this.app.platform.name === 'windows') {
      const appMan = await installWin32(url, appDir, webMan)
      await writeFile(join(appDir, 'app.xmclx'), JSON.stringify(appMan))

      if (options.createDesktopShortcut) {
        await createShortcutWin32(this.app.getPath('exe'), this.app.getPath('desktop'), appMan, true)
      }

      if (options.createStartMenuShortcut) {
        const startMenuDir = join(this.app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        await createShortcutWin32(this.app.getPath('exe'), startMenuDir, appMan, true)
      }
    } else if (this.app.platform.name === 'osx') {
      throw new Error()
    }
  }

  async getAppInfo(url: string): Promise<WebManifest> {
    const msg = await got(url)

    if (msg.headers['content-type'] === 'text/html') {
      const parser = new XMLParser({
        ignoreAttributes: false,
        // preserveOrder: true,
        unpairedTags: ['hr', 'br', 'link', 'meta'],
        stopNodes: ['*.pre', '*.script'],
        processEntities: true,
        htmlEntities: true,
      })
      const dom = parser.parse(msg.body)
      const link = dom.html.head.link
      if (link) {
        const links = link instanceof Array ? link : [link]
        const manifestNode = links.find(l => l['@_ref'] === 'manifest')
        if (manifestNode) {
          const manifestUrl = manifestNode['@_href']
          const man: WebManifest = await got(manifestUrl).json()
          return man
        }
      }
    }
    throw new Error('')
  }
}
