import { useLocalStorageCache, useLocalStorageCacheStringValue } from '@/composables/cache'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, YggdrasilApi } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'

export function useAccountSystemHistory() {
  const authority = useLocalStorageCacheStringValue('loginLastAuthAuthority', AUTHORITY_MICROSOFT as string, 'last-auth-service')
  const history = computed(() => useLocalStorageCache<string[]>(`loginAuthorityHistory:${authority.value}`, () => [], JSON.stringify, JSON.parse).value)

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

export function useAuthorityItems(allowThirdparty: Ref<boolean>, services: Ref<YggdrasilApi[]>) {
  const { t } = useI18n()
  const items: Ref<AuthorityItem[]> = computed(() => {
    const items = [
      {
        value: AUTHORITY_MICROSOFT,
        text: t('userServices.microsoft.name'),
        icon: 'mdi-microsoft',
      },
      {
        value: AUTHORITY_MOJANG,
        text: t('userServices.mojang.name'),
        icon: 'mdi-minecraft',
      },
    ] as AuthorityItem[]

    if (allowThirdparty.value) {
      items.push({
        value: AUTHORITY_DEV,
        text: t('userServices.offline.name'),
        icon: 'mdi-account-off',
      })
      for (const api of services.value) {
        try {
          const host = new URL(api.url).host
          items.push({
            value: host,
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
