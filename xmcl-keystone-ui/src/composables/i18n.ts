import { clientCurseforgeV1Locale, clientModrinchV2Locale } from '@/util/clients'
import { Settings } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { Framework } from 'vuetify'

export function useI18nSync(framework: Framework, state: Ref<Settings | undefined>) {
  const { locale } = useI18n()
  watch(computed(() => state.value?.locale || ''), (newValue: string, oldValue: string) => {
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

    clientModrinchV2Locale.headers = {
      'Accept-Language': newValue,
    }
    clientCurseforgeV1Locale.headers = {
      'Accept-Language': newValue,
    }
  })
}
