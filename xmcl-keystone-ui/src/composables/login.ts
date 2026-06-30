import {
  AUTHORITY_DEV,
  AUTHORITY_MICROSOFT,
  AUTHORITY_MOJANG,
  AuthorityMetadata,
  YggdrasilApi,
} from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'
import { injection } from '@/util/inject'
import { kUserContext } from './user'
import { kSettingsState } from './setting'
import { useLocalStorage } from '@vueuse/core'

export function useAccountSystemHistory() {
  const authority = useLocalStorage(
    'loginLastAuthAuthority',
    AUTHORITY_MICROSOFT as string,
    { writeDefaults: false },
  )
  const allHistoryRaw = useLocalStorage(
    'loginAuthorityHistory',
    () => [] as { name: string; authority: string }[],
  )
  const history = computed({
    get: () =>
      allHistoryRaw.value.filter((v) => v.authority === authority.value).map((v) => v.name),
    set: (v) => {
      allHistoryRaw.value = [
        ...allHistoryRaw.value.filter((v) => v.authority !== authority.value),
        ...v.map((x) => ({ name: x, authority: authority.value })),
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
    if (users.value.some((u) => u.authority === AUTHORITY_MICROSOFT)) return true
    if (setting.value?.developerMode) return true
    const locale = new Intl.NumberFormat().resolvedOptions().locale
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
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMSAyMSI+PHJlY3QgeD0iMSIgeT0iMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iI2YyNTAyMiIvPjxyZWN0IHg9IjExIiB5PSIxIiB3aWR0aD0iOSIgaGVpZ2h0PSI5IiBmaWxsPSIjN2ZiYTAwIi8+PHJlY3QgeD0iMSIgeT0iMTEiIHdpZHRoPSI5IiBoZWlnaHQ9IjkiIGZpbGw9IiMwMGE0ZWYiLz48cmVjdCB4PSIxMSIgeT0iMTEiIHdpZHRoPSI5IiBoZWlnaHQ9IjkiIGZpbGw9IiNmZmI5MDAiLz48L3N2Zz4=',
        })
      } else if (v.authority === AUTHORITY_DEV) {
        result.push({
          value: AUTHORITY_DEV,
          text: t('userServices.offline.name'),
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzg4OCIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTQuMmMtMi41IDAtNC43MS0xLjI4LTYtMy4yMi4wMy0xLjk5IDQtMy4wOCA2LTMuMDggMS45OSAwIDUuOTcgMS4wOSA2IDMuMDgtMS4yOSAxLjk0LTMuNSAzLjIyLTYgMy4yMnoiLz48L3N2Zz4=',
        })
      } else {
        // Use custom SVG icons or fallback to favicon
        let icon = v.favicon ?? ''
        if (v.authority.includes('ely.by') && !icon) {
          icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzFhOGM2NiIgZD0iTTIyIDEyYzAgNS41LTQuNSAxMC0xMCAxMFMyIDE3LjUgMiAxMiA2LjUgMiAxMiAyczEwIDQuNSAxMCAxMHpNOCA3djEwaDh2LTJoLTZ2LTJoNXYtMmgtNVY5aDZWN0g4eiIvPjwvc3ZnPg=='
        } else if (v.authority.includes('littleskin') && !icon) {
          icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzYjgyZjYiLz48dGV4dCB4PSIxMiIgeT0iMTYiIGZvbnQtZmFtaWx5PSJBcmlhbCxHZW5ldmEsc2Fucy1zZXJpZiIgZm9udC1zaXplPSI5IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TFM8L3RleHQ+PC9zdmc+'
        }

        result.push({
          value: v.authority,
          text: v.authlibInjector?.meta.serverName ?? new URL(v.authority).host,
          icon,
        })
      }
    }
    return result
  })

  return items
}

export const LoginDialog: DialogKey<{ username?: string; service?: string; error?: string }> =
  'login'
