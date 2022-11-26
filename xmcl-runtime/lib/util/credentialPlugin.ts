/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ICachePlugin, TokenCacheContext } from '@azure/msal-common'
import keytar from 'keytar'
import { platform } from 'os'
import { Logger } from './log'

export function createPlugin(serviceName: string, accountName: string, logger: Logger): ICachePlugin {
  accountName = accountName || 'XMCL_MICROSOFT_ACCOUNT'
  if (platform() === 'win32') {
    return {
      async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
        try {
          const part1 = await keytar.getPassword(`${serviceName}:1`, accountName)
          if (part1) {
            const part2 = await keytar.getPassword(`${serviceName}:2`, accountName)
            const part3 = await keytar.getPassword(`${serviceName}:3`, accountName)
            const part4 = await keytar.getPassword(`${serviceName}:4`, accountName)
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
          logger.error('Fail to deserialize the credential cache %o', e)
        }
      },
      async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
        if (cacheContext.cacheHasChanged) {
          const currentCache = cacheContext.tokenCache.serialize()
          const quad = Math.floor(currentCache.length / 4)
          const part1 = currentCache.substring(0, quad)
          const part2 = currentCache.substring(quad, quad + quad)
          const part3 = currentCache.substring(quad + quad, quad + quad + quad)
          const part4 = currentCache.substring(quad + quad + quad, currentCache.length)
          try {
            await keytar.setPassword(`${serviceName}:1`, accountName, part1)
            await keytar.setPassword(`${serviceName}:2`, accountName, part2)
            await keytar.setPassword(`${serviceName}:3`, accountName, part3)
            await keytar.setPassword(`${serviceName}:4`, accountName, part4)
          } catch (e) {
            logger.error('Fail to serialzie the credential cache %o', e)
          }
        }
      },
    }
  }
  const plugin: ICachePlugin = {
    async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      const secret = await keytar.getPassword(serviceName, accountName).catch((e) => {
        logger.error('Fail to deserialize the credential cache %o', e)
      })
      if (cacheContext.cacheHasChanged) {
        return
      }
      if (secret) {
        cacheContext.tokenCache.deserialize(secret)
      }
    },
    async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      const currentCache = cacheContext.tokenCache.serialize()
      await keytar.setPassword(serviceName, accountName, currentCache).catch((e) => {
        logger.error('Fail to serialzie the credential cache %o', e)
      })
    },
  }
  return plugin
}
