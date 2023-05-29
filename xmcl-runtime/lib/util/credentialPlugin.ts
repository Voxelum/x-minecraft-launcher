/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ICachePlugin, TokenCacheContext } from '@azure/msal-common'
import { platform } from 'os'
import { SecretStorage } from '../app/SecretStorage'
import { Logger } from './log'
import { AnyError } from './error'

const CredentialSerializeError = AnyError.make('CredentialSerializeError')

export function createPlugin(serviceName: string, accountName: string, logger: Logger, storage: SecretStorage): ICachePlugin {
  accountName = accountName || 'XMCL_MICROSOFT_ACCOUNT'
  if (platform() === 'win32') {
    return {
      async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
        try {
          const part1 = await storage.get(`${serviceName}:1`, accountName)
          if (part1) {
            const part2 = await storage.get(`${serviceName}:2`, accountName)
            const part3 = await storage.get(`${serviceName}:3`, accountName)
            const part4 = await storage.get(`${serviceName}:4`, accountName)
            if (part2 && part3 && part4) {
              const content = part1 + part2 + part3 + part4
              if (cacheContext.cacheHasChanged) {
                return
              }
              cacheContext.tokenCache.deserialize(content)
            }
          }
        } catch (e) {
          // Should not prevent the login
          logger.error(new CredentialSerializeError('Fail to deserialize the credential cache', { cause: e }))
        }
      },
      async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
        if (cacheContext.cacheHasChanged) {
          try {
            const currentCache = cacheContext.tokenCache.serialize()
            const quad = Math.floor(currentCache.length / 4)
            const part1 = currentCache.substring(0, quad)
            const part2 = currentCache.substring(quad, quad + quad)
            const part3 = currentCache.substring(quad + quad, quad + quad + quad)
            const part4 = currentCache.substring(quad + quad + quad, currentCache.length)
            await storage.put(`${serviceName}:1`, accountName, part1)
            await storage.put(`${serviceName}:2`, accountName, part2)
            await storage.put(`${serviceName}:3`, accountName, part3)
            await storage.put(`${serviceName}:4`, accountName, part4)
          } catch (e) {
            logger.error(new CredentialSerializeError('Fail to serialzie the credential cache', { cause: e }))
          }
        }
      },
    }
  }
  const plugin: ICachePlugin = {
    async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      const secret = await storage.get(serviceName, accountName).catch((e) => {
        logger.error(new CredentialSerializeError('Fail to deserialize the credential cache', { cause: e }))
      })
      if (cacheContext.cacheHasChanged) {
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
        const currentCache = cacheContext.tokenCache.serialize()
        await storage.put(serviceName, accountName, currentCache)
      } catch (e) {
        logger.error(new CredentialSerializeError('Fail to serialzie the credential cache', { cause: e }))
      }
    },
  }
  return plugin
}
