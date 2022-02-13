import Controller from '@/Controller'
import { ControllerPlugin } from './plugin'
import { getDiskInfo } from 'node-disk-info'
import { ipcMain } from 'electron'
import { join, parse } from 'path'

/**
 * Handle setup window preset request
 */
export const setupWindow: ControllerPlugin = function (this: Controller) {
  ipcMain.handle('preset', async () => {
    const drives = await getDiskInfo()
    const defaultPath = join(this.app.getPath('home'), '.xmcl')
    const getPath = (driveSymbol: string) => {
      const parsedHome = parse(defaultPath)
      if (parsedHome.root.toLocaleLowerCase().startsWith(driveSymbol.toLocaleLowerCase())) {
        return defaultPath
      }
      return join(driveSymbol, '.minecraft')
    }
    return {
      locale: this.app.getLocale(),
      minecraftPath: this.app.minecraftDataPath,
      defaultPath,
      drives: drives.map(d => ({
        filesystem: d.filesystem,
        blocks: d.blocks,
        used: d.used,
        available: d.available,
        capacity: d.capacity,
        mounted: d.mounted,
        selectedPath: getPath(d.mounted),
      })),
    }
  })
}
