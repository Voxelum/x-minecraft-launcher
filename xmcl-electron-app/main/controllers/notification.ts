import { ElectronController } from '@/ElectronController'
import { app } from 'electron'
import { ControllerPlugin } from './plugin'

export const notificationSetupPlugin: ControllerPlugin = function (this: ElectronController) {
  this.app.waitEngineReady().then(() => {
    if (this.app.platform.os === 'windows') {
      app.setAppUserModelId('X Minecraft Launcher')
    }
  })
}
