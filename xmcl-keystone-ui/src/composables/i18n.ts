import { vuetify } from '@/vuetify'
import { Settings } from '@xmcl/runtime-api'
import { Ref } from 'vue'

const locales = import.meta.glob('../../locales/*.yaml')

export function useI18nSync( state: Ref<Settings | undefined>) {
  const { locale, setLocaleMessage } = useI18n()
  watch(computed(() => state.value?.locale || ''), (newValue: string, oldValue: string) => {
    console.log(`Locale changed ${oldValue} -> ${newValue}`)
    const lang = vuetify.locale
    if (newValue === 'zh-CN') {
      lang.current.value = 'zhHans'
    } else if (newValue === 'ru') {
      lang.current.value = 'ru'
    } else {
      lang.current.value = 'en'
    }

    if (!locales[`../../locales/${newValue}.yaml`]) {
      newValue = 'en'
    }

    locales[`../../locales/${newValue}.yaml`]().then((message: any) => {
      setLocaleMessage(newValue, message.default)
      locale.value = newValue
    })
  })
}

export function useAutoI18nCommunityContent(allowLocale: string[] = []) {
  const { locale } = useI18n()

  async function getContent(type: 'modrinth' | 'curseforge', id: string | number) {
    if (!allowLocale.includes(locale.value)) {
      return ''
    }

    const url = new URL('https://api.xmcl.app/translation')
    url.searchParams.append('type', type)
    url.searchParams.append('id', id.toString())
    const response = await fetch(url, {
      headers: {
        'Accept-Language': locale.value,
      },
      cache: 'force-cache',
    })

    if (!response.ok) {
      throw new Error(`Fail to get translation for ${type} ${id}`)
    }

    return await response.text()
  }

  return {
    getContent,
  }
}
