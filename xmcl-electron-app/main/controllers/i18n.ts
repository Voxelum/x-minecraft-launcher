import Controller from '@/Controller'
import { BaseService } from '@xmcl/runtime'
import { ControllerPlugin } from './plugin'

export const localeMappings: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ru: 'Русский язык',
  'es-ES': 'Español',
  fr: 'French',
}

export const i18n: ControllerPlugin = function (this: Controller) {
  this.app.once('engine-ready', () => {
    const baseService = this.app.serviceManager.get(BaseService)
    baseService.state.localesSet(Object.entries(localeMappings).map(([locale, name]) => ({ locale, name })))
    this.app.log(`Set locale for the app ${baseService.state.locales.map(l => l.name)}`)
    this.i18n.use(baseService.state.locale)
    this.app.serviceStateManager.subscribe('config', (c) => {
      this.i18n.use(c.locale)
      this.app.log(`Set locale for the app ${c.locale}`)
    })
    this.app.serviceStateManager.subscribe('localeSet', (l) => {
      this.i18n.use(l)
      this.app.log(`Set locale for the app ${l}`)
    })
  })
}
