import { AppManifest, AppsHost, InstalledAppManifest } from '@xmcl/runtime-api'
import { XMLParser } from 'fast-xml-parser'
import filenamifyCombined from 'filenamify'
import { ensureDir, readdir, readJson, readJSON, remove, stat, writeFile, writeJson } from 'fs-extra'
import { join } from 'path'
import { request } from 'undici'
import { URL } from 'url'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Manager } from '../managers'
import { isSystemError } from '../util/error'
import { ENOENT_ERROR } from '../util/fs'
import { createLinkWin32, installWin32, removeShortcut } from './win32'

export interface InstallAppOptions {
  createDesktopShortcut?: boolean

  createStartMenuShortcut?: boolean
}

export class LauncherAppManager extends Manager implements AppsHost {
  private logger = this.app.logManager.getLogger('LauncherAppManager')

  constructor(app: LauncherApp) {
    super(app)

    this.app.handle('get-installed-apps', () => this.getInstalledApps())
    this.app.handle('install-app', (_, url) => this.installApp(url))
    this.app.handle('uninstall-app', (_, url) => this.uninstallApp(url))
    this.app.handle('get-app-info', (_, url) => this.getAppInfo(url))
    this.app.handle('get-default-app', () => this.getDefaultApp())
    this.app.handle('launch-app', (_, url) => this.bootAppByUrl(url))
    this.app.handle('create-app-shortcut', (_, url) => this.createShortcut(url))

    app.registerUrlHandler((url) => {
      const parsed = new URL(url, 'xmcl://launcher')
      if (parsed.host === 'launcher' && parsed.pathname === '/app') {
        const params = parsed.searchParams
        const appUrl = params.get('url')
        if (appUrl) {
          this.logger.log(`Boot app from app url ${appUrl}!`)
          this.bootAppByUrl(appUrl)
          return true
        } else {
          return false
        }
      }
      return false
    })
  }

  get root() {
    return join(this.app.appDataPath, 'apps')
  }

  getAppRoot(url: string) {
    const urlObj = new URL(url)
    return join(this.root, filenamifyCombined(urlObj.host + urlObj.pathname, { replacement: '@' }))
  }

  async bootAppByUrl(url: string): Promise<void> {
    await ensureDir(this.root)
    const app = await this.installApp(url)
    await writeJson(join(this.root, 'apps.json'), { default: url })
    await this.app.controller.activate(app)
  }

  async getDefaultApp(): Promise<string> {
    await ensureDir(this.root)
    const config = await readJson(join(this.root, 'apps.json')).catch(() => undefined)
    return config?.default ?? this.app.builtinAppManifest.url
  }

  async createShortcut(url: string): Promise<void> {
    if (this.app.platform.name === 'windows') {
      this.logger.log(`Try to create shortcut to app ${url}`)
      if (url === this.app.builtinAppManifest.url) {
        this.logger.log(`Skip to create shortcut builtin app ${url}`)
        return
      }
      const appMan = await this.getInstalledApp(url)
      if (!appMan) {
        throw new Error(`Cannot find the app with url: ${url}`)
      }
      createLinkWin32(this.app, this.app.getPath('exe'), this.app.getPath('desktop'), appMan, true)

      const startMenuDir = join(this.app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
      createLinkWin32(this.app, this.app.getPath('exe'), startMenuDir, appMan, true)
    }
  }

  async tryGetInstalledApp(url: string): Promise<InstalledAppManifest | undefined> {
    if (url === this.app.builtinAppManifest.url) {
      return this.app.builtinAppManifest
    }
    const path = this.getAppRoot(url)
    const validJson = await readJson(join(path, 'app.xmclx')).catch((e) => {
      if (isSystemError(e) && e.code === ENOENT_ERROR) {
        return undefined
      }
      throw e
    })
    return validJson
  }

  async getInstalledApp(url: string): Promise<InstalledAppManifest> {
    if (url === this.app.builtinAppManifest.url) {
      return this.app.builtinAppManifest
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
    this.logger.log(`Load ${apps.length} third-party apps`)
    return [this.app.builtinAppManifest, ...apps]
  }

  async uninstallApp(url: string) {
    this.logger.log(`Try to uninstall app ${url}`)
    if (url === this.app.builtinAppManifest.url) {
      this.logger.log(`Skip to uninstall default app ${url}`)
      return
    }

    if (this.app.platform.name === 'windows') {
      const appMan = await this.getInstalledApp(url).catch(() => undefined)
      if (appMan) {
        await removeShortcut(this.app.getPath('desktop'), appMan)
        const startMenuDir = join(this.app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        await removeShortcut(startMenuDir, appMan)
      }
    }

    const urlObj = new URL(url)
    const appDir = join(this.root, filenamifyCombined(urlObj.host + urlObj.pathname, { replacement: '@' }))
    await remove(appDir)

    if (url === await this.getDefaultApp()) {
      await writeJson(join(this.root, 'apps.json'), { default: this.app.builtinAppManifest.url })
    }
  }

  async installApp(url: string, options: InstallAppOptions = {}) {
    this.logger.log(`Try to install app ${url}`)
    if (url === this.app.builtinAppManifest.url) {
      this.logger.log(`Skip to install default app ${url}`)
      return this.app.builtinAppManifest
    }
    const webMan = await this.getAppInfo(url)
    const urlObj = new URL(url)
    const appDir = join(this.root, filenamifyCombined(urlObj.host + urlObj.pathname, { replacement: '@' }))
    await ensureDir(appDir)
    if (this.app.platform.name === 'windows') {
      const appMan = await installWin32(url, appDir, webMan)
      await writeFile(join(appDir, 'app.xmclx'), JSON.stringify(appMan))

      if (options.createDesktopShortcut) {
        createLinkWin32(this.app, this.app.getPath('exe'), this.app.getPath('desktop'), appMan, true)
      }

      if (options.createStartMenuShortcut) {
        const startMenuDir = join(this.app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        createLinkWin32(this.app, this.app.getPath('exe'), startMenuDir, appMan, true)
      }

      return appMan
    } /* else if (this.app.platform.name === 'osx') {
    } */
    throw new Error()
  }

  async getAppInfo(url: string): Promise<AppManifest> {
    if (url === this.app.builtinAppManifest.url) {
      return this.app.builtinAppManifest
    }
    const msg = await request(url)

    if (msg.headers['content-type']?.startsWith('text/html')) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        // preserveOrder: true,
        unpairedTags: ['hr', 'br', 'link', 'meta'],
        stopNodes: ['*.pre', '*.script'],
        processEntities: true,
        htmlEntities: true,
      })
      const dom = parser.parse(await msg.body.text())
      const link = dom.html.head.link
      if (link) {
        const links = link instanceof Array ? link : [link]
        const manifestNode = links.find(l => l['@_rel'] === 'launcher-manifest')
        if (manifestNode) {
          const manifestUrl = manifestNode['@_href']
          if (manifestUrl) {
            const man: AppManifest = await (await request(new URL(manifestUrl, url))).body.json()
            return man
          }
        }
      }
      throw new Error('InvalidHTML')
    }
    throw new Error('NonHTML')
  }
}
