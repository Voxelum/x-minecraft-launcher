import { AUTHORITY_MICROSOFT, type UserProfile } from '@xmcl/runtime-api'
import type { LauncherAppPlugin } from '~/app'
import { UserService } from '~/user/UserService'
import { ExternalCredentialService } from './ExternalCredentialService'

function isValidMicrosoftUser(user: UserProfile) {
  return user.authority === AUTHORITY_MICROSOFT && !user.invalidated && user.expiredAt > Date.now()
}

/**
 * Keeps Microsoft in the credential lifecycle without reading or copying the
 * opaque MSAL cache.
 */
export const pluginExternalCredentialLifecycle: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('ExternalCredentialLifecycle')
  void app.registry
    .get(UserService)
    .then((userService) => {
      const notify = (user: UserProfile) => {
        if (isValidMicrosoftUser(user)) {
          void app.registry.getOrCreate(ExternalCredentialService)
            .then(service => service.notifyMicrosoftCredentialChanged(user.id))
            .catch(() => {
              logger.warn('Unable to notify Microsoft credential lifecycle event.')
            })
        }
      }
      userService.on('user-login-success', notify)
      userService.on('user-refresh-success', notify)
    })
    .catch(() => {
      logger.warn('Unable to subscribe to Microsoft credential lifecycle events.')
    })
}
