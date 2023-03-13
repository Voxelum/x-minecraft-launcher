import { LauncherAppPlugin } from '../app/LauncherApp'
import { setPassword, getPassword, deletePassword } from 'keytar'
import { kUserTokenStorage, UserTokenStorage } from '../entities/userTokenStore'

export const pluginUserTokenStorage: LauncherAppPlugin = (app) => {
  const cache: Record<string, string> = {}
  const storage: UserTokenStorage = {
    put: async (user, token) => {
      cache[`xmcl/${user.authService}/${user.id}`] = token
      if (token) {
        await setPassword(`xmcl/${user.authService}`, user.id, token)
      } else {
        await deletePassword(`xmcl/${user.authService}`, user.id)
      }
    },
    get: async (user) => {
      const cached = cache[`xmcl/${user.authService}/${user.id}`]
      if (cached) return cached
      const token = await getPassword(`xmcl/${user.authService}`, user.id)
      cache[`xmcl/${user.authService}/${user.id}`] = token || ''
      return token || undefined
    },
  }
  app.registry.register(kUserTokenStorage, storage)
}
