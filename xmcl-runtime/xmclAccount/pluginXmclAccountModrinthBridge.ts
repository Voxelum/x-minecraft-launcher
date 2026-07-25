import type { LauncherAppPlugin } from '~/app'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { XmclAccountApiError } from './XmclAccountApi'
import { XmclAccountService } from './XmclAccountService'

const RETRY_DELAY = 60_000

function diagnosticError(error: unknown) {
  if (error instanceof XmclAccountApiError) {
    return {
      name: error.name,
      status: error.status,
      code: error.code,
      requestId: error.requestId,
      mergeId: error.mergeId,
    }
  }
  return error instanceof Error ? error : new Error(String(error))
}

export const pluginXmclAccountModrinthBridge: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('XmclModrinthBridge')
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
      .getOrCreate(XmclAccountService)
      .then((service) => service.bootstrapModrinth())
      .then(() => {
        clearRetry()
      })
      .catch((error) => {
        logger.warn(
          'Failed to bootstrap XMCL XMCL account from Modrinth authentication; retrying later.',
          diagnosticError(error),
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
      logger.warn('Unable to initialize Modrinth credentials for XMCL XMCL account bootstrap.')
    })
}
