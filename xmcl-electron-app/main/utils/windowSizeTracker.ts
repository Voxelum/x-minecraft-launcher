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
  }
  async function getConfig() {
    const configData = await readFile(configPath, 'utf-8').then((v) => JSON.parse(v)).catch(() => ({
      width: -1,
      height: -1,
      x: null,
      y: null,
    }))
    const newConfig = {
      width: typeof configData.width === 'number' ? configData.width as number : -1,
      height: typeof configData.height === 'number' ? configData.height as number : -1,
      x: typeof configData.x === 'number' ? configData.x as number : null,
      y: typeof configData.y === 'number' ? configData.y as number : null,
    }
    Object.assign(config, newConfig)
    return config
  }
  async function track(browserWindow: BrowserWindow) {
    const update = debounce(() => {
      const [width, height] = browserWindow.getSize()
      const [x, y] = browserWindow.getPosition()
      config.width = width
      config.height = height
      config.x = x
      config.y = y
      writeFile(configPath, JSON.stringify(config))
    }, 1000)
    browserWindow.on('resize', update)
    browserWindow.on('moved', update)
    browserWindow.on('move', update)
    browserWindow.on('will-move', update)
  }
  return {
    getConfig,
    track,
  }
}
