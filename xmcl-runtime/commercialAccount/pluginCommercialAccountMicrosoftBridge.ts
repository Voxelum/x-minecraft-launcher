import { AUTHORITY_MICROSOFT, type UserProfile } from '@xmcl/runtime-api'
import type { LauncherAppPlugin } from '~/app'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { UserService } from '~/user/UserService'
import { CommercialAccountService } from './CommercialAccountService'

const RETRY_DELAY = 60_000

function isValidMicrosoftUser(user: UserProfile) {
  return user.authority === AUTHORITY_MICROSOFT && !user.invalidated && user.expiredAt > Date.now()
}

export const pluginCommercialAccountMicrosoftBridge: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('CommercialMicrosoftBridge')
  const pendingAttempts = new Map<string, Promise<void>>()
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const clearRetry = (userId: string) => {
    const timer = retryTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      retryTimers.delete(userId)
    }
  }

  const scheduleRetry = (userId: string) => {
    if (retryTimers.has(userId)) return
    const timer = setTimeout(() => {
      retryTimers.delete(userId)
      void bridge(userId)
    }, RETRY_DELAY)
    timer.unref?.()
    retryTimers.set(userId, timer)
  }

  const bridge = (userId: string) => {
    const pendingAttempt = pendingAttempts.get(userId)
    if (pendingAttempt) return pendingAttempt

    const attempt = app.registry
      .getOrCreate(CommercialAccountService)
      .then((service) => service.bootstrapMicrosoft(userId))
      .then(() => {
        clearRetry(userId)
      })
      .catch(() => {
        logger.warn(
          'Failed to bootstrap XMCL commercial account from Microsoft authentication; retrying later.',
        )
        scheduleRetry(userId)
      })
      .finally(() => {
        pendingAttempts.delete(userId)
      })

    pendingAttempts.set(userId, attempt)
    return attempt
  }

  void app.registry
    .getOrCreate(ExternalCredentialService)
    .then(async (credentials) => {
      credentials.onCredentialChange((change) => {
        if (
          change.provider === 'microsoft' &&
          change.type === 'microsoft-authenticated' &&
          change.subject
        ) {
          void bridge(change.subject)
        }
      })

      const userService = await app.registry.get(UserService)
      const userState = await userService.getUserState()
      for (const user of Object.values(userState.users)) {
        if (isValidMicrosoftUser(user)) {
          void bridge(user.id)
        }
      }
    })
    .catch(() => {
      logger.warn('Unable to load Microsoft users for XMCL commercial account bootstrap.')
    })
}
