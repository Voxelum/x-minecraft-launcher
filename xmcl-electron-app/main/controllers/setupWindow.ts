import { ElectronController } from '@/ElectronController'
import { ControllerPlugin } from './plugin'
import { getDiskInfo } from 'node-disk-info'
import { ipcMain } from 'electron'
import { join, parse } from 'path'
import type Drive from 'node-disk-info/dist/classes/drive'

/**
 * Handle setup window preset request
 */
export const setupWindow: ControllerPlugin = function (this: ElectronController) {
  ipcMain.handle('preset', async () => {
    const drives = await new Promise<Drive[]>((resolve) => {
      getDiskInfo().then(resolve, () => resolve([]))
      setTimeout(() => { resolve([]) }, 4000)
    })
    const defaultPath = join(this.app.host.getPath('home'), '.xmcl')
    const getPath = (driveSymbol: string) => {
      const parsedHome = parse(defaultPath)
      if (parsedHome.root.toLocaleLowerCase().startsWith(driveSymbol.toLocaleLowerCase())) {
        return defaultPath
      }
      return join(driveSymbol, '.xmcl')
    }
    return {
      locale: this.app.host.getLocale(),
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
