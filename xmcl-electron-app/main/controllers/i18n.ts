import Controller from '@/Controller'
import { BaseService, BaseServiceKey } from '@xmcl/runtime-api'
import { ControllerPlugin } from './plugin'

export const i18n: ControllerPlugin = function (this: Controller) {
  this.app.on('service-ready', (serv) => {
    if (serv.name === BaseServiceKey) {
      const baseService = serv as any as BaseService
      if (baseService) {
        baseService.state.localesSet(['en', 'zh-CN', 'ru'])
        this.app.log(`Set locale for the app ${baseService.state.locales}`)
      } else {
        this.app.log(`Cannot find base service via ${BaseServiceKey}`)
      }
    }
  })
}
