import { InstalledAppManifest } from '@xmcl/runtime-api'
import type { LauncherApp } from '@xmcl/runtime/app'
import { readFile, writeFile } from 'fs-extra'
import { join } from 'path'

export interface WindowConfig {
  width?: number
  height?: number
  x: number | null
  y: number | null
  maximized: boolean
  getWidth(defaultWidth: number, min: number): number
  getHeight(defaultHeight: number, min: number): number
}

/**
 * Port of `xmcl-electron-app/main/utils/windowSizeTracker.ts` without Electron.
 * The saved geometry file is the same one the Electron build writes, so a user
 * switching shells keeps their window size.
 *
 * The Electron version dropped an off-screen position by asking `screen` for
 * the display bounds. Here the shell is the only one who knows the monitors, so
 * geometry it cannot satisfy is clamped on the Rust side instead.
 */
export function createWindowTracker(app: LauncherApp, role: string, man: InstalledAppManifest) {
  const basename = `${role}-window-config.json`
  const configPath = man === app.builtinAppManifest
    ? join(app.appDataPath, basename)
    : join(app.launcherAppManager.getAppRoot(man.url), basename)

  const config: WindowConfig = {
    width: undefined,
    height: undefined,
    x: null,
    y: null,
    maximized: false,
    getWidth(defaultWidth: number, min: number) {
      return Math.max(this.width === -1 || !this.width ? defaultWidth : this.width, min)
    },
    getHeight(defaultHeight: number, min: number) {
      return Math.max(this.height === -1 || !this.height ? defaultHeight : this.height, min)
    },
  }

  async function getConfig() {
    const data = await readFile(configPath, 'utf-8').then((v) => JSON.parse(v)).catch(() => ({}))
    config.width = typeof data.width === 'number' ? data.width : -1
    config.height = typeof data.height === 'number' ? data.height : -1
    config.x = typeof data.x === 'number' ? data.x : null
    config.y = typeof data.y === 'number' ? data.y : null
    config.maximized = !!data.maximized
    return config
  }

  async function save(next: Partial<Pick<WindowConfig, 'width' | 'height' | 'x' | 'y' | 'maximized'>>) {
    Object.assign(config, next)
    await writeFile(configPath, JSON.stringify({
      width: config.width,
      height: config.height,
      x: config.x,
      y: config.y,
      maximized: config.maximized,
    })).catch(() => undefined)
  }

  return { getConfig, save, configPath }
}
