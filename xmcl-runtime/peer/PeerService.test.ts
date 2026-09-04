import { describe, expect, it, vi } from 'vitest'

vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherApp: class {},
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
}))
vi.mock('~/service', () => ({
  ExposeServiceKey: () => () => {},
  ServiceStateManager: class {},
  StatefulService: class {},
}))
vi.mock('~/infra', () => ({
  kClientToken: Symbol('kClientToken'),
  kFlights: Symbol('kFlights'),
  launcherSessionId: 'launcher-session',
}))
vi.mock('~/settings', () => ({ kSettings: Symbol('kSettings') }))
vi.mock('~/xmclAccount', () => ({ XmclAccountService: class {} }))
vi.mock('./PeerServiceFacade', () => ({ kPeerFacade: Symbol('kPeerFacade') }))
vi.mock('./MultiplayerHost', () => ({ kMultiplayerHostFactory: Symbol('kMultiplayerHostFactory') }))

const { PeerService } = await import('./PeerService')

function createRefreshContext(session?: object) {
  const refreshIceServers = vi.fn()
  const getMultiplayerHost = vi.fn(async () => ({ refreshIceServers }))
  const context = {
    app: {
      registry: {
        get: vi.fn(async () => ({
          getXmclAccountState: vi.fn(async () => ({ session })),
        })),
      },
    },
    getMultiplayerHost,
  }
  return { context, getMultiplayerHost, refreshIceServers }
}

describe('PeerService multiplayer ICE refresh', () => {
  it('skips protected official credentials for guests', async () => {
    const { context, getMultiplayerHost, refreshIceServers } = createRefreshContext()

    await PeerService.prototype.multiplayerRefreshIceServers.call(context as any)

    expect(getMultiplayerHost).not.toHaveBeenCalled()
    expect(refreshIceServers).not.toHaveBeenCalled()
  })

  it('refreshes official credentials for an authenticated session', async () => {
    const { context, getMultiplayerHost, refreshIceServers } = createRefreshContext({
      sessionId: 'session-1',
    })

    await PeerService.prototype.multiplayerRefreshIceServers.call(context as any)

    expect(getMultiplayerHost).toHaveBeenCalledOnce()
    expect(refreshIceServers).toHaveBeenCalledOnce()
  })
})
