import { InstalledAppManifest } from '@xmcl/runtime-api'
import { BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs-extra'
import debounce from 'lodash.debounce'
import { join } from 'path'
import { LauncherApp } from '~/app'

export interface WindowsTransform {
  width: number
  height: number
  x: number | null
  y: number | null
}

export function createWindowTracker(app: LauncherApp, role: string, man: InstalledAppManifest) {
  const appDir = app.launcherAppManager.getAppRoot(man.url)
  const basename = `${role}-window-config.json`
  const configPath = man === app.builtinAppManifest ? join(app.appDataPath, basename) : join(appDir, basename)

  const config = {
    width: undefined as undefined | number,
    height: undefined as undefined | number,
    x: undefined as undefined | number,
    y: undefined as undefined | number,
    maximized: false,
    getWidth(min: number) {
      return Math.max(this.width || 0, min)
    },
    getHeight(min: number) {
      return Math.max(this.height || 0, min)
    },
  }
  async function getConfig() {
    const configData = await readFile(configPath, 'utf-8').then((v) => JSON.parse(v)).catch(() => ({
      width: -1,
      height: -1,
      x: null,
      y: null,
      maximized: false,
    }))
    const newConfig = {
      width: typeof configData.width === 'number' ? configData.width as number : -1,
      height: typeof configData.height === 'number' ? configData.height as number : -1,
      x: typeof configData.x === 'number' ? configData.x as number : null,
      y: typeof configData.y === 'number' ? configData.y as number : null,
      maximized: !!configData.maximized,
    }
    Object.assign(config, newConfig)
    return config
  }
  async function track(browserWindow: BrowserWindow) {
    const update = () => {
      if (browserWindow.isDestroyed()) return
      if (browserWindow.isMaximized()) return
      const [width, height] = browserWindow.getSize()
      const [x, y] = browserWindow.getPosition()
      config.width = width
      config.height = height
      config.x = x
      config.y = y
      writeToFile()
    }
    const updateViaMaximized = () => {
      if (browserWindow.isDestroyed()) return
      config.maximized = browserWindow.isMaximized()
      writeToFile()
    }
    const writeToFile = debounce(() => {
      writeFile(configPath, JSON.stringify(config))
    }, 1000)
    browserWindow.on('resize', update)
    browserWindow.on('moved', update)
    browserWindow.on('move', update)
    browserWindow.on('maximize', updateViaMaximized)
    browserWindow.on('unmaximize', updateViaMaximized)
    browserWindow.on('will-move', update)
    browserWindow.on('closed', () => {
      browserWindow.removeListener('resize', update)
      browserWindow.removeListener('moved', update)
      browserWindow.removeListener('move', update)
      browserWindow.removeListener('will-move', update)
      browserWindow.removeListener('closed', update)
    })
  }
  return {
    getConfig,
    track,
  }
}
