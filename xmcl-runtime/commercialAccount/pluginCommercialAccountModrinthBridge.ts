import type { LauncherAppPlugin } from '~/app'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { CommercialAccountService } from './CommercialAccountService'

const RETRY_DELAY = 60_000

export const pluginCommercialAccountModrinthBridge: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('CommercialModrinthBridge')
  let pendingAttempt: Promise<void> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = undefined
    }
  }

  const scheduleRetry = () => {
    if (retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      void bridge()
    }, RETRY_DELAY)
    retryTimer.unref?.()
  }

  const bridge = () => {
    if (pendingAttempt) return pendingAttempt

    pendingAttempt = app.registry
      .getOrCreate(CommercialAccountService)
      .then((service) => service.bootstrapModrinth())
      .then(() => {
        clearRetry()
      })
      .catch(() => {
        logger.warn(
          'Failed to bootstrap XMCL commercial account from Modrinth authentication; retrying later.',
        )
        scheduleRetry()
      })
      .finally(() => {
        pendingAttempt = undefined
      })

    return pendingAttempt
  }

  void app.registry
    .getOrCreate(ExternalCredentialService)
    .then(async (credentials) => {
      credentials.onCredentialChange((change) => {
        if (change.provider === 'modrinth' && change.type === 'stored') {
          void bridge()
        }
      })

      const token = await credentials.getValidAccessToken('modrinth')
      if (token.status === 'valid') {
        void bridge()
      }
    })
    .catch(() => {
      logger.warn(
        'Unable to initialize Modrinth credentials for XMCL commercial account bootstrap.',
      )
    })
}
