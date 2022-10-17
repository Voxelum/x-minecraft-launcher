import Controller from '@/Controller'
import { app } from 'electron'
import { ControllerPlugin } from './plugin'

export const notificationSetupPlugin: ControllerPlugin = function (this: Controller) {
  this.app.once('engine-ready', () => {
    if (this.app.platform.name === 'windows') {
      app.setAppUserModelId('X Minecraft Launcher')
    }
    // const { t } = this.i18n
    // const service = this.app.serviceManager.getServiceByKey(ResourceServiceKey)
    // service?.on('modpackImport', ({ path, name }) => {
    //   new Notification({
    //     title: t('modpackImport.title')
    //   })
    // })
  })
}
