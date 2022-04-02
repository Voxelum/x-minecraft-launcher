import Controller from '@/Controller'
import { BaseService, BaseServiceKey } from '@xmcl/runtime-api'
import { ControllerPlugin } from './plugin'

export const i18n: ControllerPlugin = function (this: Controller) {
  this.app.once('engine-ready', () => {
    this.app.serviceStateManager.subscribe('localeSet', (l) => {
      this.i18n.use(l)
      this.app.log(`Set locale for the app ${l}`)
    })
  })
  this.app.on('service-ready', (serv) => {
    if (serv.name === BaseServiceKey) {
      const baseService = serv as any as BaseService
      if (baseService) {
        baseService.state.localesSet(['en', 'zh-CN', 'ru'])
        this.app.log(`Set locale for the app ${baseService.state.locales}`)
        this.i18n.use(baseService.state.locale)
      } else {
        this.app.log(`Cannot find base service via ${BaseServiceKey}`)
      }
    }
  })
}
