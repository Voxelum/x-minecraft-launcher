import { clientCurseforgeV1Locale, clientModrinchV2Locale } from '@/util/clients'
import { Settings } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { Framework } from 'vuetify'

const locales = import.meta.glob('../../locales/*.yaml')

export function useI18nSync(framework: Framework, state: Ref<Settings | undefined>) {
  const { locale, setLocaleMessage } = useI18n()
  watch(computed(() => state.value?.locale || ''), (newValue: string, oldValue: string) => {
    console.log(`Locale changed ${oldValue} -> ${newValue}`)
    const lang = framework.lang
    if (newValue === 'zh-CN') {
      lang.current = 'zhHans'
    } else if (newValue === 'ru') {
      lang.current = 'ru'
    } else {
      lang.current = 'en'
    }

    locales[`../../locales/${newValue}.yaml`]().then((message: any) => {
      setLocaleMessage(newValue, message.default)
      locale.value = newValue
    })

    clientModrinchV2Locale.headers = {
      'Accept-Language': newValue,
    }
    clientCurseforgeV1Locale.headers = {
      'Accept-Language': newValue,
    }
  })
}
