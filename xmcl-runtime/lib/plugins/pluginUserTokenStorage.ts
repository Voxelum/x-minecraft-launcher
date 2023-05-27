import { LauncherAppPlugin } from '../app/LauncherApp'
import { UserTokenStorage, kUserTokenStorage } from '../entities/userTokenStore'

export const pluginUserTokenStorage: LauncherAppPlugin = (app) => {
  const cache: Record<string, string> = {}
  const storage: UserTokenStorage = {
    put: async (user, token) => {
      cache[`xmcl/${user.authService}/${user.id}`] = token
      await app.secretStorage.put(`xmcl/${user.authService}`, user.id, token)
    },
    get: async (user) => {
      const cached = cache[`xmcl/${user.authService}/${user.id}`]
      if (cached) return cached
      const token = await app.secretStorage.get(`xmcl/${user.authService}`, user.id)
      cache[`xmcl/${user.authService}/${user.id}`] = token || ''
      return token || undefined
    },
  }
  app.registry.register(kUserTokenStorage, storage)
}
