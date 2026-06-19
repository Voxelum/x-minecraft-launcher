import { Settings } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useLocale } from 'vuetify'
import { useI18nSearchFlights } from './flights'

const locales = import.meta.glob('../../locales/*.yaml')

export function useI18nSync(state: Ref<Settings | undefined>) {
  const { locale, setLocaleMessage } = useI18n()
  const vuetifyLocale = useLocale()
  watch(computed(() => state.value?.locale || ''), (newValue: string, oldValue: string) => {
    console.log(`Locale changed ${oldValue} -> ${newValue}`)
    if (newValue === 'zh-CN') {
      vuetifyLocale.current.value = 'zhHans'
    } else if (newValue === 'ru') {
      vuetifyLocale.current.value = 'ru'
    } else if (newValue === 'ar') {
      vuetifyLocale.current.value = 'ar'
    } else {
      vuetifyLocale.current.value = 'en'
    }

    if (typeof document !== 'undefined') {
      document.documentElement.dir = newValue === 'ar' ? 'rtl' : 'ltr'
    }

    if (!locales[`../../locales/${newValue}.yaml`]) {
      newValue = 'en'
    }

    locales[`../../locales/${newValue}.yaml`]().then((message: any) => {
      setLocaleMessage(newValue, message.default)
      locale.value = newValue
    })

    // Persist for windows that boot before the settings service is ready (e.g.
    // the migration progress window), which read it straight from localStorage.
    try {
      localStorage.setItem('locale', newValue)
    } catch {
      // Ignore storage failures — this is only a hint for other windows.
    }
  })
}


export function useAutoI18nEnabled() {
  const i18nSearch = useI18nSearchFlights()
  const { locale } = useI18n()
  if (i18nSearch?.includes(locale.value)) {
    return true
  }
  return false
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
