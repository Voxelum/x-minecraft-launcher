import { ElectronController } from '@/ElectronController'
import { LaunchService } from '@xmcl/runtime'
import { ControllerPlugin } from './plugin'

/**
 * Control the behavior of window during game launch/exit, and also redirect the minecraft stdout/stderr during game
 */
export const gameLaunch: ControllerPlugin = function (this: ElectronController) {
  this.app.once('engine-ready', () => {
    this.app.registry.get(LaunchService).then((service) => {
      service.on('minecraft-window-ready', ({ hideLauncher }) => {
        if (this.mainWin && this.mainWin.isVisible()) {
          this.mainWin.webContents.send('minecraft-window-ready')

          if (hideLauncher) {
            this.mainWin.hide()
          }
        }
      }).on('minecraft-start', ({ showLog }) => {
        if (this.loggerWin === undefined && showLog) {
          this.createMonitorWindow()
        }
      }).on('minecraft-exit', (status) => {
        if (status.hideLauncher) {
          if (this.mainWin) {
            this.mainWin.show()
          }
        }
        this.app.controller.broadcast('minecraft-exit', status)
        if (this.loggerWin) {
          if (service.getProcesses().length === 0) {
            this.loggerWin.close()
            this.loggerWin = undefined
          }
        }
      })
    })
  })
}
