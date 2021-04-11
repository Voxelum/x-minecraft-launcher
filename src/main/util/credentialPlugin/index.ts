/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ICachePlugin, TokenCacheContext } from '@azure/msal-common'
import { getPassword, setPassword } from 'keytar'
import { platform } from 'os'

export function createPlugin(serviceName: string, accountName: string): ICachePlugin {
  if (platform() === 'win32') {
    return {
      async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
        const part1 = await getPassword(`${serviceName}:1`, accountName)
        if (part1) {
          const part2 = await getPassword(`${serviceName}:2`, accountName)
          const part3 = await getPassword(`${serviceName}:3`, accountName)
          const part4 = await getPassword(`${serviceName}:4`, accountName)
          if (part2 && part3 && part4) {
            cacheContext.tokenCache.deserialize(part1 + part2 + part3 + part4)
          }
        }
      },
      async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
        const currentCache = cacheContext.tokenCache.serialize()
        const quad = Math.floor(currentCache.length / 4)
        const part1 = currentCache.substring(0, quad)
        const part2 = currentCache.substring(quad, quad + quad)
        const part3 = currentCache.substring(quad + quad, quad + quad + quad)
        const part4 = currentCache.substring(quad + quad + quad, currentCache.length)
        await setPassword(`${serviceName}:1`, accountName, part1)
        await setPassword(`${serviceName}:2`, accountName, part2)
        await setPassword(`${serviceName}:3`, accountName, part3)
        await setPassword(`${serviceName}:4`, accountName, part4)
      },
    }
  }
  const plugin: ICachePlugin = {
    async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      const secret = await getPassword(serviceName, accountName)
      if (secret) {
        cacheContext.tokenCache.deserialize(secret)
      }
    },
    async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      const currentCache = cacheContext.tokenCache.serialize()
      await setPassword(serviceName, accountName, currentCache)
    },
  }
  return plugin
}
