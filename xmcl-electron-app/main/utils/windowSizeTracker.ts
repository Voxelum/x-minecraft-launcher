import { InstalledAppManifest } from '@xmcl/runtime-api'
import { BrowserWindow, screen } from 'electron'
import { readFile, writeFileSync } from 'fs-extra'
import debounce from 'lodash.debounce'
import { join } from 'path'
import { LauncherApp } from '~/app'

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
    getWidth(defaultWidth: number, min: number) {
      return Math.max(this.width === -1 || !this.width ? defaultWidth : this.width, min)
    },
    getHeight(defaultHeight: number, min: number) {
      return Math.max(this.height === -1 || !this.height ? defaultHeight : this.height, min)
    },
  }
  function isInsideScreen(x: number, y: number, width: number, height: number) {
    const displays = screen.getAllDisplays().map(display => display.bounds)
    // Check coverage by the union of displays, not just one monitor. A window
    // spanning adjacent monitors is valid, but one spanning a desktop gap isn't.
    const edges = [...new Set([x, x + width, ...displays.flatMap(bounds => [bounds.x, bounds.x + bounds.width])])]
      .filter(edge => edge >= x && edge <= x + width).sort((a, b) => a - b)
    for (let i = 1; i < edges.length; i++) {
      const intervals = displays.filter(bounds => bounds.x <= edges[i - 1] && bounds.x + bounds.width >= edges[i])
        .sort((a, b) => a.y - b.y)
      let coveredY = y
      for (const bounds of intervals) {
        if (bounds.y > coveredY) break
        coveredY = Math.max(coveredY, bounds.y + bounds.height)
      }
      if (coveredY < y + height) return false
    }
    return true
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
      width: Number.isFinite(configData?.width) && configData.width > 0 ? configData.width as number : -1,
      height: Number.isFinite(configData?.height) && configData.height > 0 ? configData.height as number : -1,
      x: Number.isFinite(configData?.x) ? configData.x as number : undefined,
      y: Number.isFinite(configData?.y) ? configData.y as number : undefined,
      maximized: !!configData?.maximized,
    }
    if (newConfig.x === undefined || newConfig.y === undefined || newConfig.width <= 0 || newConfig.height <= 0 || !isInsideScreen(newConfig.x, newConfig.y, newConfig.width, newConfig.height)) {
      newConfig.x = undefined
      newConfig.y = undefined
    }
    Object.assign(config, newConfig)
    return config
  }
  function track(browserWindow: BrowserWindow) {
    // Keep writes ordered and finish before Electron can quit on the last close.
    // This tiny file is debounced during dragging, but synchronously flushed on close.
    const writeToFile = debounce(() => {
      try {
        writeFileSync(configPath, JSON.stringify(config))
      } catch (e) {
        console.warn(`Failed to save window state to ${configPath}`, e)
      }
    }, 1000)
    const update = () => {
      if (browserWindow.isDestroyed()) return
      // Windows can report minimized coordinates such as (-32000, -32000).
      // Fullscreen bounds are not the user's normal window bounds either.
      if (browserWindow.isMinimized() || browserWindow.isFullScreen()) return
      const { width, height, x, y } = browserWindow.getNormalBounds()
      config.width = width
      config.height = height
      config.x = x
      config.y = y
      writeToFile()
    }
    const updateMaximized = () => {
      if (browserWindow.isDestroyed() || browserWindow.isMinimized() || browserWindow.isFullScreen()) return
      config.maximized = browserWindow.isMaximized()
      update()
    }
    const close = () => {
      updateMaximized()
      writeToFile.flush()
    }
    browserWindow.on('resize', update)
    browserWindow.on('moved', update)
    browserWindow.on('move', update)
    browserWindow.on('maximize', updateMaximized)
    browserWindow.on('unmaximize', updateMaximized)
    browserWindow.on('close', close)
    browserWindow.once('closed', () => {
      // Also flush an already captured state if the window was destroyed directly.
      writeToFile.flush()
      browserWindow.removeListener('resize', update)
      browserWindow.removeListener('moved', update)
      browserWindow.removeListener('move', update)
      browserWindow.removeListener('maximize', updateMaximized)
      browserWindow.removeListener('unmaximize', updateMaximized)
      browserWindow.removeListener('close', close)
    })
  }

  return {
    getConfig,
    track,
  }
}
