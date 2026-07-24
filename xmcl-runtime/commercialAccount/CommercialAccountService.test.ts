import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import { ProviderCredentialExchangeCache } from './ProviderCredentialExchangeCache'

const oauth = vi.hoisted(() => ({
  authenticate: vi.fn(),
  constructorArgs: [] as unknown[][],
}))

vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherApp: class {},
  LauncherAppKey: Symbol('LauncherAppKey'),
}))

vi.mock('~/service', () => ({
  ExposeServiceKey: () => () => {},
  ServiceStateManager: class {},
  Singleton: () => () => {},
  StatefulService: class {
    app: any
    state: any
    private initializer?: () => Promise<void>

    constructor(app: any, createState: () => any, initializer?: () => Promise<void>) {
      this.app = app
      this.state = createState()
      this.initializer = initializer
    }

    async initialize() {
      await this.initializer?.()
    }

    warn(message: string) {
      this.app.getLogger().warn(message)
    }
  },
}))

vi.mock('~/user', () => ({
  UserService: class {},
}))

vi.mock('~/user/accountSystems/MicrosoftOAuthClient', () => ({
  MICROSOFT_GRAPH_USER_READ_SCOPE: 'User.Read',
  MicrosoftOAuthClient: class {
    constructor(...args: unknown[]) {
      oauth.constructorArgs.push(args)
    }

    authenticate = oauth.authenticate
  },
}))

const { CommercialAccountService } = await import('./CommercialAccountService')

function createCommercialService(stubBootstrapCredential = true) {
  const nativeWindowHandle = Buffer.from('native-window')
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const user = {
    id: 'microsoft-user',
    username: 'player@example.com',
    authority: AUTHORITY_MICROSOFT,
    invalidated: false,
  }
  const app = {
    controller: { getNativeWindowHandle: vi.fn(() => nativeWindowHandle) },
    fetch: vi.fn(),
    getLogger: vi.fn(() => logger),
    protocol: { registerHandler: vi.fn() },
    registry: {
      get: vi.fn().mockResolvedValue({
        getUserState: vi.fn().mockResolvedValue({ users: { [user.id]: user } }),
      }),
    },
    secretStorage: { get: vi.fn().mockResolvedValue(''), put: vi.fn() },
  }
  const store = { registerStatic: vi.fn((state) => state) }
  const service = new CommercialAccountService(app as any, {} as any, store as any)
  if (stubBootstrapCredential) {
    vi.spyOn(service as any, 'bootstrapCredential').mockResolvedValue(undefined)
  }
  return { app, logger, nativeWindowHandle, service, user }
}

function createAuthResult(provider: 'microsoft' | 'modrinth', accountId: string) {
  return {
    account: { accountId, status: 'active' as const, createdAt: '2026-07-23T00:00:00.000Z' },
    identities: [{
      provider,
      linkedBy: 'launcher_bootstrap' as const,
      linkedAt: '2026-07-23T00:00:00.000Z',
    }],
    session: {
      sessionId: `${provider}-session`,
      accountId,
      accessToken: `${provider}-access-token`,
      scopes: [],
      issuedAt: '2026-07-23T00:00:00.000Z',
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
    },
  }
}

afterEach(() => {
  oauth.authenticate.mockReset()
  oauth.constructorArgs.length = 0
  vi.restoreAllMocks()
})

describe('ProviderCredentialExchangeCache', () => {
  it('permits re-exchange of the same Microsoft or Modrinth credential after sign-out', () => {
    const cache = new ProviderCredentialExchangeCache()

    cache.remember('microsoft', 'microsoft-credential')
    cache.remember('modrinth', 'modrinth-credential')
    expect(cache.has('microsoft', 'microsoft-credential')).toBe(true)
    expect(cache.has('modrinth', 'modrinth-credential')).toBe(true)

    cache.clear()

    expect(cache.has('microsoft', 'microsoft-credential')).toBe(false)
    expect(cache.has('modrinth', 'modrinth-credential')).toBe(false)
  })
})

describe('CommercialAccountService Microsoft bootstrap', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
  })

  it('uses the Windows native broker and native window handle for silent authentication', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    oauth.authenticate.mockResolvedValue({ result: { accessToken: 'microsoft-token' } })
    const { app, nativeWindowHandle, service, user } = createCommercialService()

    await service.bootstrapMicrosoft(user.id)

    expect(oauth.authenticate).toHaveBeenCalledWith(user.username, ['User.Read'], {
      slientOnly: true,
      useNativeBroker: true,
    })
    expect(oauth.constructorArgs[0]?.[7]).toEqual(expect.any(Function))
    expect((oauth.constructorArgs[0]?.[7] as () => Buffer)()).toBe(nativeWindowHandle)
    expect(app.controller.getNativeWindowHandle).toHaveBeenCalled()
  })

  it('uses the normal silent cache path without the native broker off Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    oauth.authenticate.mockResolvedValue({ result: { accessToken: 'microsoft-token' } })
    const { service, user } = createCommercialService()

    await service.bootstrapMicrosoft(user.id)

    expect(oauth.authenticate).toHaveBeenCalledWith(user.username, ['User.Read'], {
      slientOnly: true,
      useNativeBroker: false,
    })
  })

  it('returns pending consent instead of throwing when Graph scope is unavailable silently', async () => {
    const silentFailure = new Error('Fail to acquire Microsoft token silently.')
    silentFailure.name = 'MicrosoftOAuthSlientFailed'
    oauth.authenticate.mockRejectedValue(silentFailure)
    const { app, logger, service, user } = createCommercialService()

    await expect(service.bootstrapMicrosoft(user.id)).resolves.toBe('pending-consent')
    expect(app.getLogger).toHaveBeenCalled()
  })

  it('persists the rotated credential when the subsequent account snapshot fails', async () => {
    const { app, logger, service } = createCommercialService()
    const previous = {
      sessionId: 'session-1',
      accountId: 'account-1',
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      scopes: ['account:read'],
      issuedAt: '2026-07-23T00:00:00.000Z',
      expiresAt: '2026-07-23T00:15:00.000Z',
    }
    const rotated = {
      ...previous,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      issuedAt: '2026-07-23T00:15:00.000Z',
      expiresAt: '2026-07-23T00:30:00.000Z',
    }
    ;(service as any).credential = previous
    ;(service as any).state.snapshot({
      account: {
        accountId: previous.accountId,
        status: 'active',
        createdAt: '2026-07-23T00:00:00.000Z',
      },
      identities: [],
      session: previous,
    })
    const api = (service as any).api
    api.refreshSession = vi.fn().mockResolvedValue(rotated)
    api.getSnapshot = vi.fn().mockRejectedValue(new Error('snapshot unavailable'))

    await expect(service.refreshSession()).resolves.toBeUndefined()

    const persisted = JSON.parse(app.secretStorage.put.mock.calls.at(-1)?.[2] ?? '{}')
    expect(persisted.credential.refreshToken).toBe('new-refresh-token')
    expect((service as any).credential.refreshToken).toBe('new-refresh-token')
    expect(logger.warn).toHaveBeenCalledWith(
      'XMCL session refreshed; account snapshot refresh will retry later.',
    )
  })
})

describe('CommercialAccountService provider bootstrap queue', () => {
  it('serializes concurrent exchanges and links the second provider with the first session', async () => {
    const { app, service } = createCommercialService(false)
    const firstResult = createAuthResult('microsoft', 'account-1')
    const secondResult = createAuthResult('modrinth', 'account-1')
    const events: string[] = []
    let resolveFirstExchange!: (result: typeof firstResult) => void
    const firstExchange = new Promise<typeof firstResult>((resolve) => {
      resolveFirstExchange = resolve
    })
    let activeExchanges = 0
    let maxActiveExchanges = 0
    const launcherExchange = vi.fn(async (
      provider: 'microsoft' | 'modrinth',
      _providerCredential: string,
      credential: unknown,
    ) => {
      activeExchanges += 1
      maxActiveExchanges = Math.max(maxActiveExchanges, activeExchanges)
      events.push(`exchange:${provider}`)
      try {
        if (provider === 'microsoft') return await firstExchange
        expect(credential).toBe(firstResult.session)
        return secondResult
      } finally {
        activeExchanges -= 1
      }
    })
    const api = (service as any).api
    api.launcherExchange = launcherExchange
    app.secretStorage.put.mockImplementation(async () => { events.push('stored') })

    const bootstrapCredential = (service as any).bootstrapCredential.bind(service)
    const microsoft = bootstrapCredential('microsoft', 'microsoft-credential')
    const modrinth = bootstrapCredential('modrinth', 'modrinth-credential')

    await vi.waitFor(() => expect(launcherExchange).toHaveBeenCalledTimes(1))
    expect(launcherExchange.mock.calls[0]?.[2]).toBeUndefined()
    resolveFirstExchange(firstResult)

    await Promise.all([microsoft, modrinth])

    expect(maxActiveExchanges).toBe(1)
    expect(launcherExchange.mock.calls.map((call) => call[0])).toEqual(['microsoft', 'modrinth'])
    expect(launcherExchange.mock.calls[1]?.[2]).toBe(firstResult.session)
    expect(events).toEqual([
      'exchange:microsoft',
      'stored',
      'exchange:modrinth',
      'stored',
    ])
  })

  it('continues queued provider exchanges after a failed exchange', async () => {
    const { service } = createCommercialService(false)
    const launcherExchange = vi.fn()
      .mockRejectedValueOnce(new Error('first exchange failed'))
      .mockResolvedValueOnce(createAuthResult('modrinth', 'account-1'))
    const api = (service as any).api
    api.launcherExchange = launcherExchange
    const bootstrapCredential = (service as any).bootstrapCredential.bind(service)

    const failed = bootstrapCredential('microsoft', 'microsoft-credential')
    const recovered = bootstrapCredential('modrinth', 'modrinth-credential')

    await expect(failed).rejects.toThrow('first exchange failed')
    await expect(recovered).resolves.toBeUndefined()
    expect(launcherExchange.mock.calls.map((call) => call[0])).toEqual(['microsoft', 'modrinth'])
    expect(launcherExchange.mock.calls[1]?.[2]).toBeUndefined()
  })

  it('does not send an expired XMCL credential during provider re-bootstrap', async () => {
    const { service } = createCommercialService(false)
    const expired = {
      sessionId: 'expired-session',
      accountId: 'account-1',
      accessToken: 'expired-access-token',
      refreshToken: 'expired-refresh-token',
      scopes: ['account:read'],
      issuedAt: '2026-07-23T00:00:00.000Z',
      expiresAt: '2026-07-23T00:01:00.000Z',
    }
    ;(service as any).credential = expired
    const launcherExchange = vi.fn().mockResolvedValue(createAuthResult('microsoft', 'account-1'))
    ;(service as any).api.launcherExchange = launcherExchange

    await (service as any).bootstrapCredential('microsoft', 'fresh-provider-credential')

    expect(launcherExchange).toHaveBeenCalledWith(
      'microsoft',
      'fresh-provider-credential',
      undefined,
    )
  })
})
