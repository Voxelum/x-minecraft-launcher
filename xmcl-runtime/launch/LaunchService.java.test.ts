import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'events'
import MutexManager from '../app/MutexManager'
import { withJavaRuntimeLock } from '../java/javaRuntimeLock'
import { LaunchService } from './LaunchService'

const h = vi.hoisted(() => ({ launchServer: vi.fn(), historyBegin: vi.fn() }))
vi.mock('@xmcl/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@xmcl/core')>(),
  launchServer: h.launchServer,
  createMinecraftProcessWatcher: () => new EventEmitter(),
}))
vi.mock('create-desktop-shortcuts/src/windows.vbs', () => ({ default: '' }))
vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
}))
vi.mock('~/service', () => ({
  ExposeServiceKey: () => () => {},
  AbstractService: class {
    constructor(public app: unknown) {}
    getAppDataPath(path: string) { return path }
    log() {}
    warn() {}
    error() {}
    emit() {}
  },
}))
vi.mock('../app/LauncherApp', () => ({ LauncherApp: class {} }))
vi.mock('./VersionService', () => ({ VersionService: class {} }))
vi.mock('~/user', () => ({ kUserTokenStorage: Symbol('kUserTokenStorage') }))
vi.mock('~/encoding', () => ({ kEncodingWorker: Symbol('kEncodingWorker') }))
vi.mock('~/user/YggdrasilSeriveRegistry', () => ({ kYggdrasilSeriveRegistry: Symbol('kYggdrasilSeriveRegistry') }))
vi.mock('~/infra/recoverRestore', () => ({ recoverRestore: vi.fn() }))
vi.mock('../infra/telemetry_context', () => ({ runWithInternalSpan: (_name: string, operation: () => unknown) => operation() }))
vi.mock('./LaunchHistoryStore', () => ({
  LaunchHistoryStore: class {
    begin = h.historyBegin
  },
}))

describe('Java process tracking during termination', () => {
  it.each(['client', 'server'] as const)('keeps a stopping %s tracked until exit', async (side) => {
    const kill = vi.fn().mockReturnValue(false)
    const write = vi.fn()
    const service: LaunchService = Object.create(LaunchService.prototype)
    Reflect.set(service, 'processes', {
      42: {
        pid: 42, side, ready: true, launchId: 'launch',
        options: { java: '/jre/old/bin/java' },
        process: { kill, stdin: { write } },
      },
    })

    await service.kill(42)

    if (side === 'server') expect(write).toHaveBeenCalledWith('/stop\n')
    else expect(kill).toHaveBeenCalledOnce()
    expect(await service.getGameProcesses()).toEqual([
      expect.objectContaining({ pid: 42, options: { java: '/jre/old/bin/java' } }),
    ])
  })

  it('keeps a process tracked if termination throws', async () => {
    const service: LaunchService = Object.create(LaunchService.prototype)
    Reflect.set(service, 'processes', {
      42: {
        pid: 42, side: 'client', ready: true, launchId: 'launch',
        options: { java: '/jre/old/bin/java' },
        process: { kill: () => { throw new Error('kill failed') } },
      },
    })

    await expect(service.kill(42)).rejects.toThrow('kill failed')
    expect(await service.getGameProcess(42)).toBeDefined()
  })
})

describe('Java lock during launch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.historyBegin.mockResolvedValue(undefined)
  })
  function setup() {
    const app = { mutex: undefined as unknown, platform: { os: 'linux' } }
    app.mutex = new MutexManager(app as never)
    const versionService = { resolveServerVersion: vi.fn() }
    const service = new LaunchService(app as never, (() => '/data') as never, {} as never, {} as never, versionService as never)
    vi.spyOn(service, 'generateServerOptions').mockResolvedValue({ javaPath: '/jre/actual/bin/java' } as never)
    return { app, service, versionService }
  }
  function child(pid: number) {
    return Object.assign(new EventEmitter(), { pid, unref: vi.fn() })
  }

  it('lets unrelated launches finish while version preparation is slow', async () => {
    const { service, versionService } = setup()
    let release!: (version: { id: string; minecraftVersion: string }) => void
    versionService.resolveServerVersion
      .mockReturnValueOnce(new Promise(resolve => { release = resolve }))
      .mockResolvedValueOnce({ id: 'ready', minecraftVersion: '1' })
    h.launchServer.mockResolvedValue(child(42))
    const options = { java: '/jre/old/bin/java', side: 'server', version: 'v', gameDirectory: '/game' } as never
    const slow = service.launch(options)
    await vi.waitFor(() => expect(versionService.resolveServerVersion).toHaveBeenCalledOnce())
    await expect(service.launch(options)).resolves.toBe(42)
    release({ id: 'slow', minecraftVersion: '1' })
    await expect(slow).resolves.toBe(42)
  })

  it('registers the actual middleware-selected Java before releasing the spawn lock', async () => {
    const { app, service, versionService } = setup()
    versionService.resolveServerVersion.mockResolvedValue({ id: 'v', minecraftVersion: '1' })
    let release!: (process: ReturnType<typeof child>) => void
    h.launchServer.mockReturnValue(new Promise(resolve => { release = resolve }))
    const launch = service.launch({ java: '/jre/old/bin/java', side: 'server', version: 'v', gameDirectory: '/game' } as never)
    await vi.waitFor(() => expect(h.launchServer).toHaveBeenCalled())
    let tracked = false
    const removal = withJavaRuntimeLock(app as never, '/jre/actual/bin/java', async () => {
      tracked = (await service.getGameProcesses()).some(game => game.options.java === '/jre/actual/bin/java')
    })
    await Promise.resolve()
    expect(tracked).toBe(false)
    release(child(43))
    await Promise.all([launch, removal])
    expect(tracked).toBe(true)
  })

  it('does not hold the spawn lock while launch history is being written', async () => {
    const { app, service, versionService } = setup()
    versionService.resolveServerVersion.mockResolvedValue({ id: 'v', minecraftVersion: '1' })
    h.launchServer.mockResolvedValue(child(44))
    let finish!: () => void
    h.historyBegin.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    const options = { java: '/jre/old/bin/java', side: 'server', version: 'v', gameDirectory: '/game' } as never
    await expect(service.launch(options)).resolves.toBe(44)
    await expect(withJavaRuntimeLock(app as never, '/jre/actual/bin/java', async () => 'available')).resolves.toBe('available')
    finish()
  })
})
