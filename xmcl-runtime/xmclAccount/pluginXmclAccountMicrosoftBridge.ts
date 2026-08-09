import type { LauncherAppPlugin } from '~/app'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { XmclAccountService } from './XmclAccountService'

export const pluginXmclAccountMicrosoftBridge: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('XmclMicrosoftBridge')
  const pendingAttempts = new Map<string, Promise<void>>()

  const bridge = (userId: string) => {
    const pendingAttempt = pendingAttempts.get(userId)
    if (pendingAttempt) return pendingAttempt

    const attempt = app.registry
      .getOrCreate(XmclAccountService)
      .then((service) => service.bootstrapMicrosoft(userId))
      .then((result) => {
        if (result === 'pending-consent') {
          logger.log('XMCL xmcl bridge is waiting for Microsoft Graph consent.')
        }
      })
      .catch((e) => {
        logger.warn('Failed to bootstrap XMCL account from Microsoft authentication.', e)
      })
      .finally(() => {
        pendingAttempts.delete(userId)
      })

    pendingAttempts.set(userId, attempt)
    return attempt
  }

  void app.registry
    .getOrCreate(ExternalCredentialService)
    .then((credentials) => {
      credentials.onCredentialChange((change) => {
        if (
          change.provider === 'microsoft' &&
          change.type === 'microsoft-authenticated' &&
          change.subject
        ) {
          void bridge(change.subject)
        }
      })
    })
    .catch(() => {
      logger.warn('Unable to load Microsoft users for XMCL XMCL account bootstrap.')
    })
}
