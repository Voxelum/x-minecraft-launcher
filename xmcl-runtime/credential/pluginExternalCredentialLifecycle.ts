import { AUTHORITY_MICROSOFT, type UserProfile } from '@xmcl/runtime-api'
import type { LauncherAppPlugin } from '~/app'
import { UserService } from '~/user/UserService'
import { ExternalCredentialService } from './ExternalCredentialService'

function isValidMicrosoftUser(user: UserProfile) {
  return user.authority === AUTHORITY_MICROSOFT && !user.invalidated && user.expiredAt > Date.now()
}

/**
 * Keeps Microsoft in the credential lifecycle without reading or copying the
 * opaque MSAL cache. Modrinth storage migration is initialized here as well.
 */
export const pluginExternalCredentialLifecycle: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('ExternalCredentialLifecycle')
  const credentials = app.registry.getOrCreate(ExternalCredentialService).then(async (service) => {
    await service.initialize()
    return service
  })

  void credentials.catch(() => {
    logger.warn('Unable to initialize external credential lifecycle.')
  })

  void app.registry
    .get(UserService)
    .then(async (userService) => {
      const service = await credentials
      const notify = (user: UserProfile) => {
        if (isValidMicrosoftUser(user)) {
          service.notifyMicrosoftCredentialChanged(user.id)
        }
      }
      userService.on('user-login-success', notify)
      userService.on('user-refresh-success', notify)
    })
    .catch(() => {
      logger.warn('Unable to subscribe to Microsoft credential lifecycle events.')
    })
}
