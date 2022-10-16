import Controller from '@/Controller'
import { ControllerPlugin } from './plugin'
import { nativeTheme } from 'electron'
import { BaseService } from '@xmcl/runtime'

const expectedValues = ['dark', 'light', 'system']
export const themePlugin: ControllerPlugin = function (this: Controller) {
  this.app.on('engine-ready', () => {
    const baseService = this.app.serviceManager.get(BaseService)
    this.app.serviceManager.get(BaseService).initialize().then(() => {
      if (expectedValues.indexOf(baseService.state.theme) === -1) {
        this.app.warn(`Cannot set theme source to unexpected value ${baseService.state.theme}. Use dark as default.`)
        nativeTheme.themeSource = 'dark'
      } else {
        nativeTheme.themeSource = baseService.state.theme
      }
    })
  })
}
