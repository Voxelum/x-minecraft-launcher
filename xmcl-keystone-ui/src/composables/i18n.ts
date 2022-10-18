import { BaseServiceKey } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import VueI18n from 'vue-i18n'

import { injection } from '../util/inject'
import { useService } from './service'
import { kVuetify } from './vuetify'

export function useI18nSync() {
  const { state } = useService(BaseServiceKey)
  const framework = injection(kVuetify)
  const { locale } = useI18n()
  watch(computed(() => state.locale), (newValue: string, oldValue: string) => {
    console.log(`Locale changed ${oldValue} -> ${newValue}`)
    locale.value = newValue
    const lang = framework.lang
    if (newValue === 'zh-CN') {
      lang.current = 'zhHans'
    } else if (newValue === 'ru') {
      lang.current = 'ru'
    } else {
      lang.current = 'en'
    }
  })
}
