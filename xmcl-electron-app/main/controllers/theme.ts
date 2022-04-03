import Controller from '@/Controller'
import { ControllerPlugin } from './plugin'
import { nativeTheme } from 'electron'
import { BaseServiceKey, BaseService } from '@xmcl/runtime-api'

const expectedValues = ['dark', 'light', 'system']
export const themePlugin: ControllerPlugin = function (this: Controller) {
  this.app.on('service-ready', (serv) => {
    if (serv.name === BaseServiceKey) {
      const baseService = serv as any as BaseService
      if (expectedValues.indexOf(baseService.state.theme) === -1) {
        this.app.warn(`Cannot set theme source to unexpected value ${baseService.state.theme}. Use dark as default.`)
        nativeTheme.themeSource = 'dark'
      } else {
        nativeTheme.themeSource = baseService.state.theme
      }
    }
  })
}
