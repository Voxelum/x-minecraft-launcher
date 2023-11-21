import { ElectronController } from '@/ElectronController'
import { ControllerPlugin } from './plugin'
import { nativeTheme } from 'electron'
import { kSettings } from '@xmcl/runtime/settings'

const expectedValues = ['dark', 'light', 'system']
export const themePlugin: ControllerPlugin = function (this: ElectronController) {
  const logger = this.app.getLogger('theme')
  this.app.on('engine-ready', async () => {
    const settings = await this.app.registry.get(kSettings)
    if (expectedValues.indexOf(settings.theme) === -1) {
      logger.warn(`Cannot set theme source to unexpected value ${settings.theme}. Use dark as default.`)
      nativeTheme.themeSource = 'dark'
    } else {
      nativeTheme.themeSource = settings.theme
    }
  })
}
