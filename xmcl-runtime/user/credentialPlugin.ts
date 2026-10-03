/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ICachePlugin, TokenCacheContext } from '@azure/msal-common'
import { SecretStorage } from '~/app/SecretStorage'
import { Logger } from '~/infra'
import { AnyError } from '@xmcl/utils'

const CredentialSerializeError = AnyError.make('CredentialSerializeError')
const MICROSOFT_ACCOUNT_CACHE = 'XMCL_MICROSOFT_ACCOUNT'

export function createPlugin(serviceName: string, logger: Logger, storage: SecretStorage): ICachePlugin {
  let cachedInMemory: boolean
  let cacheReadFailed = false
  let cacheReadFailureLogged = false
  const plugin: ICachePlugin = {
    async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      if (cacheReadFailed) return
      const secret = await storage.get(serviceName, MICROSOFT_ACCOUNT_CACHE).catch((e) => {
        cacheReadFailed = true
        if (!cacheReadFailureLogged) {
          cacheReadFailureLogged = true
          logger.error(new CredentialSerializeError('Fail to read the credential cache', { cause: e }))
        }
      })
      if (cachedInMemory && cacheContext.cacheHasChanged) {
        return
      }
      if (secret) {
        try {
          cacheContext.tokenCache.deserialize(secret)
        } catch (e) {
          cacheReadFailed = true
          if (!cacheReadFailureLogged) {
            cacheReadFailureLogged = true
            logger.error(new CredentialSerializeError('Fail to deserialize the credential cache', { cause: e }))
          }
        }
      }
    },
    async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      try {
        if (cacheContext.cacheHasChanged) {
          const currentCache = cacheContext.tokenCache.serialize()
          cachedInMemory = true
          await storage.put(serviceName, MICROSOFT_ACCOUNT_CACHE, currentCache)
          cacheReadFailed = false
          cacheReadFailureLogged = false
        }
      } catch (e) {
        logger.error(new CredentialSerializeError('Fail to serialzie the credential cache', { cause: e }))
      }
    },
  }
  return plugin
}
