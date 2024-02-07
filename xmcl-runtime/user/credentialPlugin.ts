/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ICachePlugin, TokenCacheContext } from '@azure/msal-common'
import { SecretStorage } from '~/app/SecretStorage'
import { Logger } from '~/logger'
import { AnyError } from '~/util/error'

const CredentialSerializeError = AnyError.make('CredentialSerializeError')

export function createPlugin(serviceName: string, accountName: string, logger: Logger, storage: SecretStorage): ICachePlugin {
  accountName = accountName || 'XMCL_MICROSOFT_ACCOUNT'
  let cachedInMemory: boolean
  const plugin: ICachePlugin = {
    async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      const secret = await storage.get(serviceName, accountName).catch((e) => {
        logger.error(new CredentialSerializeError('Fail to deserialize the credential cache', { cause: e }))
      })
      if (cachedInMemory && cacheContext.cacheHasChanged) {
        return
      }
      if (secret) {
        try {
          cacheContext.tokenCache.deserialize(secret)
        } catch (e) {
          logger.error(new CredentialSerializeError('Fail to deserialize the credential cache', { cause: e }))
        }
      }
    },
    async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      try {
        if (cacheContext.cacheHasChanged) {
          const currentCache = cacheContext.tokenCache.serialize()
          cachedInMemory = true
          await storage.put(serviceName, accountName, currentCache)
        }
      } catch (e) {
        logger.error(new CredentialSerializeError('Fail to serialzie the credential cache', { cause: e }))
      }
    },
  }
  return plugin
}
