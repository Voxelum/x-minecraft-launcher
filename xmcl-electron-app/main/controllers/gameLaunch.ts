import Controller from '@/Controller'
import { InstanceServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'
import { ControllerPlugin } from './plugin'

/**
 * Control the behavior of window during game launch/exit, and also redirect the minecraft stdout/stderr during game
 */
export const gameLaunch: ControllerPlugin = function (this: Controller) {
  this.app.once('engine-ready', () => {
    this.app.serviceManager.getService(LaunchServiceKey)?.on('minecraft-window-ready', () => {
      const instance = this.app.serviceManager.getService(InstanceServiceKey)?.state.instance
      if (!instance) {
        this.app.warn('Cannot find active instance while Minecraft window ready! Perhaps something strange happed?')
        return
      }
      if (this.mainWin && this.mainWin.isVisible()) {
        this.mainWin.webContents.send('minecraft-window-ready')

        const { hideLauncher } = instance
        if (hideLauncher) {
          this.mainWin.hide()
        }
      }

      if (this.loggerWin === undefined && instance.showLog) {
        this.createMonitorWindow()
      }
    }).on('minecraft-exit', (status) => {
      const instance = this.app.serviceManager.getService(InstanceServiceKey)?.state.instance
      if (!instance) {
        this.app.warn('Cannot find active instance while Minecraft exit! Perhaps something strange happed?')
        return
      }
      const { hideLauncher } = instance
      if (hideLauncher) {
        if (this.mainWin) {
          this.mainWin.show()
        }
      }
      this.app.broadcast('minecraft-exit', status)
      if (this.loggerWin) {
        const launchServ = this.app.serviceManager.getService(LaunchServiceKey)!
        if (launchServ.state.activeCount === 0) {
          this.loggerWin.close()
          this.loggerWin = undefined
        }
      }
    })
  })
}
