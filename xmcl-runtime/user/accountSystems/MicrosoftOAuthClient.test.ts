import type { AccountInfo, INativeBrokerPlugin, TokenCacheContext } from '@azure/msal-common'
import { copyFileSync } from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SecretStorage } from '~/app/SecretStorage'
import { createPlugin } from '../credentialPlugin'
import { MicrosoftOAuthClient } from './MicrosoftOAuthClient'

vi.mock('fs', () => ({
  copyFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const nativeBrokerPluginConstructed = vi.hoisted(() => ({ count: 0 }))

vi.mock('@azure/msal-node-extensions', () => ({
  NativeBrokerPlugin: class {
    constructor() {
      nativeBrokerPluginConstructed.count += 1
    }

    isBrokerAvailable = true
  },
}))

function createAccount(username: string, homeAccountId: string): AccountInfo {
  return {
    environment: 'login.microsoftonline.com',
    homeAccountId,
    localAccountId: homeAccountId,
    tenantId: 'consumers',
    username,
  }
}

describe('MicrosoftOAuthClient', () => {
  beforeEach(() => {
    vi.mocked(copyFileSync).mockClear()
    nativeBrokerPluginConstructed.count = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serializes native broker initialization across concurrent clients', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const createClient = () => new MicrosoftOAuthClient(
      vi.fn(),
      { log: vi.fn(), warn: vi.fn() } as any,
      'client-id',
      vi.fn(),
      vi.fn(),
      vi.fn(),
      {} as any,
    )

    const first = createClient()
    const second = createClient()

    await Promise.all([
      (first as any).getNativeBrokerPlugin(),
      (second as any).getNativeBrokerPlugin(),
    ])

    expect(copyFileSync).toHaveBeenCalledTimes(2)
    expect(nativeBrokerPluginConstructed.count).toBe(1)
  })

  it('passes the cached account to WAM and rejects a different broker account', async () => {
    const requestedAccount = createAccount('account-a@example.com', 'account-a')
    const brokerAccount = createAccount('account-b@example.com', 'account-b')
    const getCode = vi.fn().mockResolvedValue('web-code')
    const cacheApp = {
      acquireTokenSilent: vi.fn().mockRejectedValue(new Error('refresh failed')),
      getTokenCache: vi.fn().mockReturnValue({ getAllAccounts: vi.fn().mockResolvedValue([requestedAccount]) }),
    }
    const brokerApp = {
      acquireTokenByCode: vi.fn().mockResolvedValue({ accessToken: 'web-token', account: requestedAccount }),
      acquireTokenInteractive: vi.fn().mockResolvedValue({ accessToken: 'broker-token', account: brokerAccount }),
      getAuthCodeUrl: vi.fn().mockResolvedValue('https://login.example/authorize'),
    }
    const client = new MicrosoftOAuthClient(
      fetch,
      { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
      'client-id',
      getCode,
      vi.fn().mockResolvedValue('http://localhost/auth'),
      vi.fn(),
      { get: vi.fn(), put: vi.fn() },
    )
    vi.spyOn(client as any, 'getNativeBrokerPlugin').mockResolvedValue({} as INativeBrokerPlugin)
    vi.spyOn(client as any, 'getOAuthApp')
      .mockResolvedValueOnce(cacheApp)
      .mockResolvedValueOnce(brokerApp)

    const authentication = await client.authenticate('account-a@example.com', ['XboxLive.signin'], {
      useNativeBroker: true,
    })

    expect(cacheApp.acquireTokenSilent).toHaveBeenCalledWith(expect.objectContaining({ account: requestedAccount }))
    expect(brokerApp.acquireTokenInteractive).toHaveBeenCalledWith(expect.objectContaining({
      account: requestedAccount,
      loginHint: 'account-a@example.com',
      prompt: 'select_account',
    }))
    expect(brokerApp.getAuthCodeUrl).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'select_account' }))
    expect(brokerApp.acquireTokenByCode).toHaveBeenCalledWith(expect.objectContaining({ code: 'web-code' }))
    expect(authentication.result.accessToken).toBe('web-token')
  })

  it('rejects a different account returned by the WebView fallback', async () => {
    const requestedAccount = createAccount('account-a@example.com', 'account-a')
    const brokerAccount = createAccount('account-b@example.com', 'account-b')
    const cacheApp = {
      acquireTokenSilent: vi.fn().mockRejectedValue(new Error('refresh failed')),
      getTokenCache: vi.fn().mockReturnValue({ getAllAccounts: vi.fn().mockResolvedValue([requestedAccount]) }),
    }
    const brokerApp = {
      acquireTokenByCode: vi.fn().mockResolvedValue({ accessToken: 'web-token-b', account: brokerAccount }),
      acquireTokenInteractive: vi.fn().mockRejectedValue(new Error('broker unavailable')),
      getAuthCodeUrl: vi.fn().mockResolvedValue('https://login.example/authorize'),
    }
    const client = new MicrosoftOAuthClient(
      fetch,
      { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
      'client-id',
      vi.fn().mockResolvedValue('web-code'),
      vi.fn().mockResolvedValue('http://localhost/auth'),
      vi.fn(),
      { get: vi.fn(), put: vi.fn() },
    )
    vi.spyOn(client as any, 'getNativeBrokerPlugin').mockResolvedValue({} as INativeBrokerPlugin)
    vi.spyOn(client as any, 'getOAuthApp')
      .mockResolvedValueOnce(cacheApp)
      .mockResolvedValueOnce(brokerApp)

    await expect(client.authenticate('account-a@example.com', ['XboxLive.signin'], {
      useNativeBroker: true,
    })).rejects.toMatchObject({ name: 'MicrosoftOAuthAccountMismatch' })
  })
})

function createCacheContext(cacheHasChanged: boolean, serialized = '') {
  return {
    cacheHasChanged,
    tokenCache: {
      deserialize: vi.fn(),
      serialize: vi.fn().mockReturnValue(serialized),
    },
  } as unknown as TokenCacheContext
}

describe('Microsoft credential cache', () => {
  const logger = { error: vi.fn() } as any

  it('reads back the exact cache value written to the shared storage key', async () => {
    const values = new Map<string, string>()
    const get: SecretStorage['get'] = async (service, account) => values.get(`${service}@${account}`)
    const put: SecretStorage['put'] = async (service, account, value) => {
      values.set(`${service}@${account}`, value)
    }
    const storage: SecretStorage = { get: vi.fn(get), put: vi.fn(put) }
    const serialized = '{"Account":{"account-a":{}}}'
    const writer = createPlugin('xmcl-oauth', 'XMCL_MICROSOFT_ACCOUNT', logger, storage)
    const writeContext = createCacheContext(true, serialized)

    await writer.afterCacheAccess(writeContext)

    const reader = createPlugin('xmcl-oauth', 'XMCL_MICROSOFT_ACCOUNT', logger, storage)
    const readContext = createCacheContext(false)
    await reader.beforeCacheAccess(readContext)

    expect(readContext.tokenCache.deserialize).toHaveBeenCalledWith(serialized)
    expect(storage.put).toHaveBeenCalledWith('xmcl-oauth', 'XMCL_MICROSOFT_ACCOUNT', serialized)
  })

  it('migrates a legacy per-email cache to the shared storage key unchanged', async () => {
    const serialized = '{"Account":{"account-a":{}}}'
    const get: SecretStorage['get'] = async (_service, account) => account === 'account-a@example.com' ? serialized : undefined
    const storage: SecretStorage = { get: vi.fn(get), put: vi.fn() }
    const plugin = createPlugin(
      'xmcl-oauth',
      'XMCL_MICROSOFT_ACCOUNT',
      logger,
      storage,
      ['account-a@example.com'],
    )
    const context = createCacheContext(false)

    await plugin.beforeCacheAccess(context)

    expect(storage.get).toHaveBeenNthCalledWith(1, 'xmcl-oauth', 'XMCL_MICROSOFT_ACCOUNT')
    expect(storage.get).toHaveBeenNthCalledWith(2, 'xmcl-oauth', 'account-a@example.com')
    expect(context.tokenCache.deserialize).toHaveBeenCalledWith(serialized)
    expect(storage.put).toHaveBeenCalledWith('xmcl-oauth', 'XMCL_MICROSOFT_ACCOUNT', serialized)
  })
})
