import { ElectronController } from '@/ElectronController'
import { kSettings } from '@xmcl/runtime/settings'
import localeMappings from '../../../assets/locales.json'
import { ControllerPlugin } from './plugin'

export const i18n: ControllerPlugin = async function (this: ElectronController) {
  const logger = this.app.getLogger('i18n')
  const state = await this.app.registry.get(kSettings)
  state.localesSet(Object.entries(localeMappings).map(([locale, name]) => ({ locale, name })))
  logger.log(`Set locale for the app ${state.locales.map(l => l.name)}`)
  this.i18n.use(state.locale)
  state.subscribe('config', (c) => {
    this.i18n.use(c.locale)
    logger.log(`Set locale for the app ${c.locale}`)
  }).subscribe('localeSet', (l) => {
    this.i18n.use(l)
    logger.log(`Set locale for the app ${l}`)
  })
}
