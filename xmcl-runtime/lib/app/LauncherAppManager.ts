import { AppManifest, AppsHost, InstalledAppManifest } from '@xmcl/runtime-api'
import { XMLParser } from 'fast-xml-parser'
import filenamifyCombined from 'filenamify'
import { ensureDir, readdir, readJson, readJSON, remove, stat, writeFile, writeJson } from 'fs-extra'
import got from 'got'
import { join } from 'path'
import { URL } from 'url'
import { LauncherApp } from '../app/LauncherApp'
import { Manager } from '../managers'
import { createShortcutWin32, installWin32 } from './win32'

export interface InstallAppOptions {
  createDesktopShortcut?: boolean

  createStartMenuShortcut?: boolean
}

export class LauncherAppManager extends Manager implements AppsHost {
  constructor(app: LauncherApp) {
    super(app)
  }

  get root() {
    return join(this.app.appDataPath, 'apps')
  }

  getAppRoot(url: string) {
    const urlObj = new URL(url)
    return join(this.root, filenamifyCombined(urlObj.host + urlObj.pathname, { replacement: '@' }))
  }

  engineReady(): void | Promise<void> {
    this.app.handle('get-installed-apps', () => this.getInstalledApps())
    this.app.handle('install-app', (_, url) => this.installApp(url))
    this.app.handle('uninstall-app', (_, url) => this.uninstallApp(url))
    this.app.handle('get-app-info', (_, url) => this.getAppInfo(url))
    this.app.handle('get-default-app', () => this.getDefaultApp())
    this.app.handle('launch-app', (_, url) => this.bootAppByUrl(url))
  }

  async bootAppByUrl(url: string): Promise<void> {
    await ensureDir(this.root)
    const app = await this.installApp(url)
    await writeJson(join(this.root, 'apps.json'), { default: url })
    await this.app.controller.bootApp(app)
  }

  async getDefaultApp(): Promise<string> {
    await ensureDir(this.root)
    const config = await readJson(join(this.root, 'apps.json')).catch(() => undefined)
    return config?.default ?? this.app.getDefaultAppManifest().url
  }

  async getInstalledApp(url: string): Promise<InstalledAppManifest> {
    if (url === this.app.getDefaultAppManifest().url) {
      return this.app.getDefaultAppManifest()
    }
    const path = this.getAppRoot(url)
    return readJson(join(path, 'app.xmclx'))
  }

  async getInstalledApps(): Promise<InstalledAppManifest[]> {
    await ensureDir(this.root)
    const files = await readdir(this.root).then((files) => files.map(f => join(this.root, f, 'app.xmclx')))
    const results = await Promise.all(files.map(async (file) => {
      const validFile = await stat(file).then(s => s.isFile() ? file : undefined, () => undefined)
      if (validFile) {
        return readJSON(validFile)
      }
    }))
    const apps = results.filter(v => !!v)
    this.log(`Load ${apps.length} third-party apps`)
    return [this.app.getDefaultAppManifest(), ...apps]
  }

  async uninstallApp(url: string) {
    this.log(`Try to uninstall app ${url}`)
    if (url === this.app.getDefaultAppManifest().url) {
      this.log(`Skip to uninstall default app ${url}`)
      return
    }
    const urlObj = new URL(url)
    const appDir = join(this.root, filenamifyCombined(urlObj.host + urlObj.pathname, { replacement: '@' }))
    await remove(appDir)

    if (url === await this.getDefaultApp()) {
      await writeJson(join(this.root, 'apps.json'), { default: this.app.getDefaultAppManifest().url })
    }
  }

  async installApp(url: string, options: InstallAppOptions = {}) {
    this.log(`Try to install app ${url}`)
    if (url === this.app.getDefaultAppManifest().url) {
      this.log(`Skip to install default app ${url}`)
      return this.app.getDefaultAppManifest()
    }
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

      return appMan
    } /* else if (this.app.platform.name === 'osx') {
    } */
    throw new Error()
  }

  async getAppInfo(url: string): Promise<AppManifest> {
    if (url === this.app.getDefaultAppManifest().url) {
      return this.app.getDefaultAppManifest()
    }
    const msg = await got(url)

    if (msg.headers['content-type']?.startsWith('text/html')) {
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
        const manifestNode = links.find(l => l['@_rel'] === 'manifest')
        if (manifestNode) {
          const manifestUrl = manifestNode['@_href']
          if (manifestUrl) {
            const man: AppManifest = await got(new URL(manifestUrl, url)).json()
            return man
          }
        }
      }
      throw new Error('InvalidHTML')
    }
    throw new Error('NonHTML')
  }
}
