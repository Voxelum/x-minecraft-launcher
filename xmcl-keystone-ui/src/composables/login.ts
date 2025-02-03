import { useLocalStorageCache, useLocalStorageCacheStringValue } from '@/composables/cache'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, AuthorityMetadata, YggdrasilApi } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'
import { injection } from '@/util/inject'
import { kUserContext } from './user'
import { kSettingsState } from './setting'
import { useLocalStorage } from '@vueuse/core'

export function useAccountSystemHistory() {
  const authority = useLocalStorageCacheStringValue('loginLastAuthAuthority', AUTHORITY_MICROSOFT as string, { legacyKey: 'last-auth-service' })
  const allHistoryRaw = useLocalStorage('loginAuthorityHistory', () => ([] as { name: string; authority: string }[]))
  const history = computed({
    get: () => allHistoryRaw.value.filter(v => v.authority === authority.value).map(v => v.name),
    set: (v) => {
      allHistoryRaw.value = [
        ...allHistoryRaw.value.filter(v => v.authority !== authority.value),
        ...v.map(x => ({ name: x, authority: authority.value })),
      ]
    },
  })
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

export function useAuthorityItems(authorities: Ref<AuthorityMetadata[] | undefined>) {
  const { t } = useI18n()
  const thirdParty = useAllowThirdparty()
  const items: Ref<AuthorityItem[]> = computed(() => {
    if (!authorities.value) return []
    const result = [] as AuthorityItem[]
    for (const v of authorities.value) {
      if (!thirdParty.value && v.authority !== AUTHORITY_MICROSOFT) continue
      if (v.authority === AUTHORITY_MICROSOFT) {
        result.push({
          value: AUTHORITY_MICROSOFT,
          text: t('userServices.microsoft.name'),
          icon: 'gavel',
        })
      }
      if (v.authority === AUTHORITY_DEV) {
        result.push({
          value: AUTHORITY_DEV,
          text: t('userServices.offline.name'),
          icon: 'wifi_off',
        })
      }
      result.push({
        value: v.authority,
        text: v.authlibInjector?.meta.serverName ?? new URL(v.authority).host,
        icon: v.favicon ?? '',
      })
    }
    return result
  })

  return items
}

export const LoginDialog: DialogKey<{ username?: string; service?: string; error?: string }> = 'login'
