import { ElectronController } from '@/ElectronController'
import { kSetupWorker } from '@/setupWorker'
import { ipcMain } from 'electron'
import { join, parse } from 'path'
import { setTimeout } from 'timers/promises'
import { ControllerPlugin } from './plugin'

/**
 * Handle setup window preset request
 */
export const setupWindow: ControllerPlugin = function (this: ElectronController) {
  ipcMain.handle('preset', async () => {
    const drives = await Promise.race([
      this.app.registry.get(kSetupWorker).then(w => w.getDiskInfo()),
      setTimeout(4000).then(() => []),
    ])
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
