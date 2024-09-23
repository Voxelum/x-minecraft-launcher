import { AppManifest, AppsHost, InstalledAppManifest } from '@xmcl/runtime-api'
import { XMLParser } from 'fast-xml-parser'
import filenamifyCombined from 'filenamify'
import { ensureDir, readFile, readdir, rm, stat, writeFile } from 'fs-extra'
import { join } from 'path'
import { Logger } from '~/logger'
import { LauncherApp } from '../app/LauncherApp'
import { isSystemError } from '../util/error'
import { ENOENT_ERROR } from '../util/fs'
import { createLinkWin32, installWin32, removeShortcut } from './win32'

export interface InstallAppOptions {
  createDesktopShortcut?: boolean

  createStartMenuShortcut?: boolean
}

export class LauncherAppManager implements AppsHost {
  private logger: Logger

  constructor(private app: LauncherApp) {
    this.logger = this.app.getLogger('LauncherAppManager')
    this.app.controller.handle('get-installed-apps', () => this.getInstalledApps())
    this.app.controller.handle('install-app', (_, url) => this.installApp(url))
    this.app.controller.handle('uninstall-app', (_, url) => this.uninstallApp(url))
    this.app.controller.handle('get-app-info', (_, url) => this.getAppInfo(url))
    this.app.controller.handle('get-default-app', () => this.getDefaultApp())
    this.app.controller.handle('launch-app', (_, url) => this.bootAppByUrl(url))
    this.app.controller.handle('create-app-shortcut', (_, url) => this.createShortcut(url))

    app.protocol.registerHandler('xmcl', ({ request, response }) => {
      const parsed = request.url
      if (parsed.host === 'launcher' && parsed.pathname === '/app') {
        const params = parsed.searchParams
        const appUrl = params.get('url')
        if (appUrl) {
          this.logger.log(`Boot app from app url ${appUrl}!`)
          this.bootAppByUrl(appUrl)
          response.status = 200
        }
      }
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
    await writeFile(join(this.root, 'apps.json'), JSON.stringify({ default: url }))
    await this.app.controller.activate(app)
  }

  async getDefaultApp(): Promise<string> {
    await ensureDir(this.root)
    const config = await readFile(join(this.root, 'apps.json'), 'utf-8').then(JSON.parse, () => undefined)
    return config?.default ?? this.app.builtinAppManifest.url
  }

  async createShortcut(url: string): Promise<void> {
    if (this.app.platform.os === 'windows') {
      this.logger.log(`Try to create shortcut to app ${url}`)
      if (url === this.app.builtinAppManifest.url) {
        this.logger.log(`Skip to create shortcut builtin app ${url}`)
        return
      }
      const appMan = await this.getInstalledApp(url)
      if (!appMan) {
        throw new Error(`Cannot find the app with url: ${url}`)
      }
      createLinkWin32(this.app, this.app.host.getPath('exe'), this.app.host.getPath('desktop'), appMan, true)

      const startMenuDir = join(this.app.host.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
      createLinkWin32(this.app, this.app.host.getPath('exe'), startMenuDir, appMan, true)
    }
  }

  async tryGetInstalledApp(url: string): Promise<InstalledAppManifest | undefined> {
    if (url === this.app.builtinAppManifest.url) {
      return this.app.builtinAppManifest
    }
    const path = this.getAppRoot(url)
    const validJson = await readFile(join(path, 'app.xmclx'), 'utf8').then(JSON.parse, (e) => {
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
    return readFile(join(path, 'app.xmclx'), 'utf8').then(JSON.parse)
  }

  async getInstalledApps(): Promise<InstalledAppManifest[]> {
    await ensureDir(this.root)
    const files = await readdir(this.root).then((files) => files.map(f => join(this.root, f, 'app.xmclx')))
    const results = await Promise.all(files.map(async (file) => {
      const validFile = await stat(file).then(s => s.isFile() ? file : undefined, () => undefined)
      if (validFile) {
        return readFile(validFile, 'utf8').then(JSON.parse)
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

    if (this.app.platform.os === 'windows') {
      const appMan = await this.getInstalledApp(url).catch(() => undefined)
      if (appMan) {
        await removeShortcut(this.app.host.getPath('desktop'), appMan)
        const startMenuDir = join(this.app.host.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        await removeShortcut(startMenuDir, appMan)
      }
    }

    const urlObj = new URL(url)
    const appDir = join(this.root, filenamifyCombined(urlObj.host + urlObj.pathname, { replacement: '@' }))
    await rm(appDir, { recursive: true, force: true })

    if (url === await this.getDefaultApp()) {
      await writeFile(join(this.root, 'apps.json'), JSON.stringify({ default: this.app.builtinAppManifest.url }))
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
    if (this.app.platform.os === 'windows') {
      const appMan = await installWin32(url, appDir, webMan)
      await writeFile(join(appDir, 'app.xmclx'), JSON.stringify(appMan))

      if (options.createDesktopShortcut) {
        createLinkWin32(this.app, this.app.host.getPath('exe'), this.app.host.getPath('desktop'), appMan, true)
      }

      if (options.createStartMenuShortcut) {
        const startMenuDir = join(this.app.host.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        createLinkWin32(this.app, this.app.host.getPath('exe'), startMenuDir, appMan, true)
      }

      return appMan
    } /* else if (this.app.platform.os === 'osx') {
    } */
    throw new Error()
  }

  async getAppInfo(url: string): Promise<AppManifest> {
    if (url === this.app.builtinAppManifest.url) {
      return this.app.builtinAppManifest
    }
    const msg = await this.app.fetch(url)

    if (typeof msg.headers.get('content-type') === 'string' && msg.headers.get('content-type')?.startsWith('text/html')) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        // preserveOrder: true,
        unpairedTags: ['hr', 'br', 'link', 'meta'],
        stopNodes: ['*.pre', '*.script'],
        processEntities: true,
        htmlEntities: true,
      })
      const dom = parser.parse(await msg.text())
      const link = dom.html.head.link
      if (link) {
        const links = link instanceof Array ? link : [link]
        const manifestNode = links.find(l => l['@_rel'] === 'launcher-manifest')
        if (manifestNode) {
          const manifestUrl = manifestNode['@_href']
          if (manifestUrl) {
            const man: AppManifest = await (await this.app.fetch(new URL(manifestUrl, url))).json() as any
            return man
          }
        }
      }
      throw new SyntaxError('InvalidHTML')
    }
    throw new SyntaxError('NonHTML')
  }
}
