import { ElectronController } from '@/ElectronController'
import { LaunchService } from '@xmcl/runtime/launch'
import { ControllerPlugin } from './plugin'

/**
 * Control the behavior of window during game launch/exit, and also redirect the minecraft stdout/stderr during game
 */
export const gameLaunch: ControllerPlugin = function (this: ElectronController) {
  this.app.once('engine-ready', () => {
    this.app.registry.get(LaunchService).then((service) => {
      service.on('minecraft-window-ready', ({ hideLauncher }) => {
        if (this.mainWin && (this.mainWin.isVisible() || this.mainWin.isMinimized())) {
          this.mainWin.webContents.send('minecraft-window-ready')

          if (hideLauncher) {
            this.mainWin.hide()
          }
        }
      }).on('minecraft-start', ({ showLog }) => {
        this.parking = true
        if (!this.getLoggerWindow() && showLog) {
          this.createMonitorWindow()
        }
      }).on('minecraft-exit', (status) => {
        this.parking = false
        if (this.mainWin && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
        this.app.controller.broadcast('minecraft-exit', status)
        const loggerWin = this.getLoggerWindow()
        if (loggerWin) {
          if (service.getProcesses().length === 0 && !status.crashReport && status.code === 0) {
            loggerWin.close()
            this.loggerWin = undefined
          }
        }
      })
    })
  })
}
