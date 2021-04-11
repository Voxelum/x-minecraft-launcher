import { BrowserWindow } from 'electron'
import { writeJSON } from 'fs-extra'
import debounce from 'lodash.debounce'

export interface WindowsTransform {
  width: number
  height: number
  x: number | null
  y: number | null
}

export function trackWindowSize(browserWindow: BrowserWindow, config: WindowsTransform, configPath: string) {
  const update = debounce(() => {
    const [width, height] = browserWindow.getSize()
    const [x, y] = browserWindow.getPosition()
    config.width = width
    config.height = height
    config.x = x
    config.y = y
    writeJSON(configPath, config)
  }, 1000)
  browserWindow.on('resize', update)
  browserWindow.on('moved', update)
  browserWindow.on('move', update)
  browserWindow.on('will-move', update)
}
