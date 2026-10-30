import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'

const h = vi.hoisted(() => ({
  refreshUser: vi.fn(), launch: vi.fn(), kill: vi.fn(), getGameProcess: vi.fn(),
  auth: vi.fn(), permission: vi.fn(), generate: vi.fn(),
}))
vi.mock('@/composables', () => ({ useService: (key: string) => ({
  user: { refreshUser: h.refreshUser },
  launch: { launch: h.launch, kill: h.kill, on: vi.fn(), removeListener: vi.fn(), getGameProcess: h.getGameProcess, getGameProcesses: vi.fn().mockResolvedValue([]) },
  bedrock: { launch: vi.fn() }, auth: { getOrInstallAuthlibInjector: h.auth },
})[key] }))
vi.mock('@xmcl/runtime-api', () => ({
  UserServiceKey: 'user', LaunchServiceKey: 'launch', BedrockServiceKey: 'bedrock', AuthlibInjectorServiceKey: 'auth',
  generateLaunchOptionsWithGlobal: h.generate,
}))
vi.mock('./setting', () => ({ useGlobalSettings: () => new Proxy({}, { get: () => vue.ref(undefined) }) }))
vi.mock('swrv', () => ({ default: () => ({ data: vue.ref([]), mutate: vi.fn() }) }))
import { useInstanceLaunch } from './instanceLaunch'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve() }
function setup(mods: any[] = []) {
  return useInstanceLaunch(vue.ref({ path: '/isolated', runtime: {} }) as any, vue.ref('1'), vue.ref('1'), vue.ref({ path: 'java' }) as any,
    vue.ref({ id: 'user' }) as any, {} as any, vue.ref(mods))
}

describe('real instance launch lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('rendererTelemetry', { startAction: vi.fn().mockResolvedValue(undefined) })
    for (const name of ['ref', 'computed', 'shallowRef', 'markRaw', 'watch'] as const) vi.stubGlobal(name, vue[name])
    vi.stubGlobal('windowController', { queryAudioPermission: h.permission })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    h.generate.mockImplementation(async () => ({ skipAssetsCheck: true }))
    h.refreshUser.mockResolvedValue({ id: 'user' })
    h.launch.mockResolvedValue(42)
    h.getGameProcess.mockResolvedValue({ launchId: 'launch-42' })
    h.kill.mockResolvedValue(undefined)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('abort and skips without state are safe', () => {
    const api = setup()
    expect(() => { api.abort(); api.skipAuthLib(); api.skipRefresh(); api.skipPermission() }).not.toThrow()
  })
  it('cancels refresh, never spawns, and allows a fresh launch', async () => {
    const refresh = deferred<any>()
    h.refreshUser.mockReturnValueOnce(refresh.promise)
    const api = setup()
    const first = api.launch()
    await flush()
    expect(api.launchingStatus.value).toBe('refreshing-user')
    api.abort()
    await expect(first).resolves.toBeUndefined()
    expect(api.launching.value).toBe(false)
    expect(api.error.value).toBeUndefined()
    expect(console.error).not.toHaveBeenCalled()
    await api.launch()
    refresh.resolve({ id: 'user' })
    await flush()
    expect(h.launch).toHaveBeenCalledTimes(1)
    expect(api.error.value).toBeUndefined()
  })
  it('skip refresh continues independently without cancelling launch', async () => {
    h.refreshUser.mockReturnValueOnce(deferred().promise)
    const api = setup()
    const result = api.launch()
    await flush(); api.skipRefresh()
    await expect(result).resolves.toMatchObject({ pid: 42 })
    expect(h.kill).not.toHaveBeenCalled()
  })
  it('kills a late pid before querying its launch ID and cannot clear newer state', async () => {
    const pid = deferred<number>()
    const refresh = deferred<any>()
    h.launch.mockReturnValueOnce(pid.promise)
    const api = setup()
    const first = api.launch()
    await flush(); api.abort(); await first
    h.refreshUser.mockReturnValueOnce(refresh.promise)
    const second = api.launch()
    await flush()
    pid.resolve(77); await flush()
    expect(h.kill).toHaveBeenCalledWith(77)
    expect(h.getGameProcess).not.toHaveBeenCalled()
    expect(api.launchingStatus.value).toBe('refreshing-user')
    refresh.resolve({ id: 'user' }); await second
    expect(api.launching.value).toBe(false)
  })
  it('registers outer cancellation before synchronously entered authlib stage', async () => {
    h.generate.mockImplementationOnce(async (_i, _u, _v, options) => {
      await options.track(options.token, () => deferred().promise, 'preparing-authlib')
      return {}
    })
    const api = setup()
    const result = api.launch()
    await flush()
    expect(api.launchingStatus.value).toBe('preparing-authlib')
    api.abort()
    await expect(result).resolves.toBeUndefined()
    expect(h.launch).not.toHaveBeenCalled()
  })
  it('does not lose cancellation synchronously triggered inside a nested operation', async () => {
    const api = setup()
    h.generate.mockImplementationOnce(async (_i, _u, _v, options) => {
      try {
        await options.track(options.token, () => { api.abort(); return deferred().promise }, 'preparing-authlib')
      } catch { /* optional authlib */ }
      return {}
    })
    const result = api.launch()
    await flush()
    await expect(result).resolves.toBeUndefined()
    expect(api.launching.value).toBe(false)
    expect(h.launch).not.toHaveBeenCalled()
  })
  it('skip authlib continues without cancelling the overall attempt', async () => {
    h.generate.mockImplementationOnce(async (_i, _u, _v, options) => {
      try { await options.track(options.token, () => deferred().promise, 'preparing-authlib') } catch { /* same optional-authlib fallback as generator */ }
      return {}
    })
    const api = setup()
    const result = api.launch()
    await flush(); api.skipAuthLib()
    await expect(result).resolves.toMatchObject({ pid: 42 })
  })
  it('skip permission continues independently', async () => {
    h.permission.mockReturnValueOnce(deferred().promise)
    const api = setup([{ modId: 'voicechat' }])
    const result = api.launch()
    await flush()
    expect(api.launchingStatus.value).toBe('checking-permission')
    api.skipPermission()
    await expect(result).resolves.toMatchObject({ pid: 42 })
    expect(h.kill).not.toHaveBeenCalled()
  })
  it('cancellation during launch-ID lookup still kills a pid with no record', async () => {
    const lookup = deferred<any>()
    h.getGameProcess.mockReturnValueOnce(lookup.promise)
    const api = setup()
    const result = api.launch()
    await flush(); api.abort(); await result
    lookup.resolve(undefined); await flush()
    expect(h.kill).toHaveBeenCalledWith(42)
    expect(api.error.value).toBeUndefined()
  })
  it('consumes launchAs cancellation before renderer telemetry and fire-and-forget callers', async () => {
    const telemetry = {
      startAction: vi.fn().mockResolvedValue({ id: 'action', traceparent: '00-123-456-01' }),
      endAction: vi.fn().mockResolvedValue(undefined),
    }
    vi.stubGlobal('rendererTelemetry', telemetry)
    const refresh = deferred<any>()
    h.refreshUser.mockReturnValueOnce(refresh.promise)
    const api = setup()
    const result = api.launchAs({ id: 'user' } as any)
    await flush(); api.abort()
    await expect(result).resolves.toBeUndefined()
    refresh.reject(new Error('late refresh failure')); await flush()
    expect(api.error.value).toBeUndefined()
    expect(console.error).not.toHaveBeenCalled()
    expect(telemetry.endAction).toHaveBeenCalledWith({ id: 'action', outcome: 'success' })
  })
  it('still rejects genuine launch failures and records the error', async () => {
    const failure = new Error('launch failed')
    h.launch.mockRejectedValueOnce(failure)
    const api = setup()
    await expect(api.launch()).rejects.toBe(failure)
    expect(api.error.value).toBe(failure)
    expect(console.error).toHaveBeenCalledWith(failure)
  })
  it('stale failed launch cannot replace the new error or status', async () => {
    const pid = deferred<number>()
    const refresh = deferred<any>()
    h.launch.mockReturnValueOnce(pid.promise)
    const api = setup()
    const first = api.launch()
    await flush(); api.abort(); await first
    h.refreshUser.mockReturnValueOnce(refresh.promise)
    const second = api.launch()
    await flush(); pid.reject(new Error('old failure')); await flush()
    expect(api.error.value).toBeUndefined()
    expect(api.launchingStatus.value).toBe('refreshing-user')
    refresh.resolve({ id: 'user' }); await second
  })
})
