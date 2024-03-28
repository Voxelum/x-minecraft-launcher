import { useLocalStorageCache, useLocalStorageCacheStringValue } from '@/composables/cache'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, YggdrasilApi } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'
import { injection } from '@/util/inject'
import { kUserContext } from './user'
import { kSettingsState } from './setting'

export function useAccountSystemHistory() {
  const authority = useLocalStorageCacheStringValue('loginLastAuthAuthority', AUTHORITY_MICROSOFT as string, { legacyKey: 'last-auth-service' })
  const history = computed(() => useLocalStorageCache<string[]>(computed(() => `loginAuthorityHistory:${authority.value}`), () => [], JSON.stringify, JSON.parse).value)

  return {
    authority,
    history,
  }
}
export interface AuthorityItem {
  icon: string
  text: string
  value: string
}

const strictLocales = [
  // 欧洲 (Europe)
  'de-DE', // 德国 (Germany)
  'en-GB', // 英国 (United Kingdom)
  'fr-FR', // 法国 (France)
  'es-ES', // 西班牙 (Spain)
  'it-IT', // 意大利 (Italy)
  'pt-PT', // 葡萄牙 (Portugal)
  'nl-NL', // 荷兰 (Netherlands)
  'sv-SE', // 瑞典 (Sweden)
  'da-DK', // 丹麦 (Denmark)
  'fi-FI', // 芬兰 (Finland)
  'no-NO', // 挪威 (Norway)
  'el-GR', // 希腊 (Greece)
  'tr-TR', // 土耳其 (Turkey)
  'is-IS', // 冰岛 (Iceland)
  'en-IE', // 爱尔兰 (Ireland)
  'el-CY', // 塞浦路斯 (Cyprus)

  // 澳洲 (Australia)
  'en-AU', // 澳大利亚 (Australia)

  // 北美 (North America)
  'en-US', // 美国 (United States)
  'en-CA', // 加拿大 (Canada)

  'ja-JP', // 日本 (Japan)
  'ko-KR', // 韩国 (South Korea)
]

export function useAllowThirdparty() {
  const { state: setting } = injection(kSettingsState)
  const { users } = injection(kUserContext)
  const allowThirdParty = computed(() => {
    if (users.value.some(u => u.authority === AUTHORITY_MICROSOFT)) return true
    if (setting.value?.developerMode) return true
    const locale = (new Intl.NumberFormat()).resolvedOptions().locale
    if (strictLocales.includes(locale)) return false
    return true
  })
  return allowThirdParty
}

export function useAuthorityItems(allowThirdparty: Ref<boolean>, services: Ref<YggdrasilApi[]>) {
  const { t } = useI18n()
  const items: Ref<AuthorityItem[]> = computed(() => {
    const items = [
      {
        value: AUTHORITY_MICROSOFT,
        text: t('userServices.microsoft.name'),
        icon: 'gavel',
      },
    ] as AuthorityItem[]

    if (allowThirdparty.value) {
      items.push({
        value: AUTHORITY_DEV,
        text: t('userServices.offline.name'),
        icon: 'wifi_off',
      })
      for (const api of services.value) {
        try {
          const host = new URL(api.url).host
          items.push({
            value: api.url,
            text: api.authlibInjector?.meta.serverName ?? host,
            icon: api.favicon ?? '',
          })
        } catch { }
      }
    }

    return items
  })

  return items
}

export const LoginDialog: DialogKey<{ username?: string; service?: string; error?: string }> = 'login'
