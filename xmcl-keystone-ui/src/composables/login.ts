import { DialogKey } from './dialog'
import { useLocalStorageCacheStringValue, useLocalStorageCache } from '@/composables/cache'

export function useSelectedServices () {
  const authService = useLocalStorageCacheStringValue('last-auth-service', 'mojang' as string)
  const profileService = useLocalStorageCacheStringValue('last-profile-service', 'mojang' as string)
  const history = computed(() => useLocalStorageCache<string[]>(`auth-service-${authService.value}-history`, () => [], JSON.stringify, JSON.parse).value)

  return {
    authService,
    profileService,
    history,
  }
}

export const LoginDialog: DialogKey<{ username?: string; service?: string; error?: string }> = 'login'
