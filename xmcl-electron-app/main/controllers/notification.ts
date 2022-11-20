import Controller from '@/Controller'
import { app } from 'electron'
import { ControllerPlugin } from './plugin'

export const notificationSetupPlugin: ControllerPlugin = function (this: Controller) {
  this.app.once('engine-ready', () => {
    if (this.app.platform.name === 'windows') {
      app.setAppUserModelId('X Minecraft Launcher')
    }
  })
}
