import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'

const h = vi.hoisted(() => ({
  refreshUser: vi.fn(), launch: vi.fn(), kill: vi.fn(), getGameProcess: vi.fn(), getGameProcesses: vi.fn(),
  auth: vi.fn(), permission: vi.fn(), generate: vi.fn(), getJavaState: vi.fn(),
  refreshLocalJava: vi.fn(), installJava: vi.fn(), getJavaRuntimes: vi.fn(),
  removeJava: vi.fn(), migrateJavaReferences: vi.fn(),
  setJavaSettings: vi.fn(), flushJavaUpdate: vi.fn(), completeJavaReplacement: vi.fn(),
  getGameDataDirectory: vi.fn(),
  findJavaRuntimeUpdate: vi.fn(), promptJavaUpdate: vi.fn(),
}))
vi.mock('@/composables', () => ({ useService: (key: string) => ({
  user: { refreshUser: h.refreshUser },
  launch: { launch: h.launch, kill: h.kill, on: vi.fn(), removeListener: vi.fn(), getGameProcess: h.getGameProcess, getGameProcesses: h.getGameProcesses },
  bedrock: { launch: vi.fn() }, auth: { getOrInstallAuthlibInjector: h.auth },
  java: { getJavaState: h.getJavaState, refreshLocalJava: h.refreshLocalJava, removeJava: h.removeJava, migrateJavaReferences: h.migrateJavaReferences, setJavaSettings: h.setJavaSettings, flushJavaUpdate: h.flushJavaUpdate, completeJavaReplacement: h.completeJavaReplacement },
  install: { getJavaRuntimes: h.getJavaRuntimes, install: h.installJava },
  base: { getGameDataDirectory: h.getGameDataDirectory },
})[key] }))
vi.mock('@xmcl/runtime-api', () => ({
  UserServiceKey: 'user', LaunchServiceKey: 'launch', BedrockServiceKey: 'bedrock', AuthlibInjectorServiceKey: 'auth',
  JavaServiceKey: 'java', InstanceServiceKey: 'instance', VersionInstallServiceKey: 'install',
  BaseServiceKey: 'base',
  generateLaunchOptionsWithGlobal: h.generate,
}))
vi.mock('./setting', () => ({
  useGlobalSettings: () => new Proxy({}, {
    get: () => vue.ref(undefined),
  }),
}))
vi.mock('./dialog', () => ({ useDialog: () => ({ show: vi.fn(), hide: vi.fn() }) }))
vi.mock('./java', () => ({ javaVendors: [{ uid: 'net.adoptium.java' }] }))
vi.mock('./javaUpdate', () => ({
  findJavaRuntimeUpdate: h.findJavaRuntimeUpdate,
  promptJavaUpdate: h.promptJavaUpdate,
}))
vi.mock('swrv', () => ({ default: () => ({ data: vue.ref([]), mutate: vi.fn() }) }))
import { useInstanceLaunch } from './instanceLaunch'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve() }
function setup(mods: any[] = [], selectedJava?: string) {
  return useInstanceLaunch(vue.ref({ path: '/isolated', runtime: {}, java: selectedJava }) as any, vue.ref('1'), vue.ref('1'), vue.ref({ path: 'java' }) as any,
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
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.generate.mockImplementation(async () => ({ java: 'java', skipAssetsCheck: true }))
    h.refreshUser.mockResolvedValue({ id: 'user' })
    h.getJavaState.mockResolvedValue({ all: [] })
    h.getGameDataDirectory.mockResolvedValue('/isolated')
    h.refreshLocalJava.mockResolvedValue(undefined)
    h.removeJava.mockResolvedValue(true)
    h.setJavaSettings.mockResolvedValue(undefined)
    h.flushJavaUpdate.mockResolvedValue(undefined)
    h.completeJavaReplacement.mockResolvedValue(undefined)
    h.migrateJavaReferences.mockResolvedValue(true)
    h.installJava.mockResolvedValue({ path: 'java' })
    h.getJavaRuntimes.mockResolvedValue([])
    h.findJavaRuntimeUpdate.mockResolvedValue(undefined)
    h.promptJavaUpdate.mockResolvedValue(false)
    h.launch.mockResolvedValue(42)
    h.getGameProcess.mockResolvedValue({ launchId: 'launch-42' })
    h.getGameProcesses.mockResolvedValue([])
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
      return { java: 'java' }
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
  it('does not remove the previous runtime when persistence fails', async () => {
    const old = '/flush-test/jre/old/bin/java'
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValue({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimePath: '/flush-test/jre/new', displayVersion: '17.0.2' })
    h.promptJavaUpdate.mockResolvedValue(true)
    h.installJava.mockResolvedValue({ path: '/flush-test/jre/new/bin/java' })
    h.flushJavaUpdate.mockRejectedValue(new Error('disk failed'))
    await expect(setup().launch()).rejects.toThrow('disk failed')
    expect(h.removeJava).not.toHaveBeenCalled()
    expect(h.launch).not.toHaveBeenCalled()
  })
  it('resumes a persisted replacement before launching and removes the old runtime after flushing', async () => {
    const old = '/recovery-test/jre/old/bin/java'
    const replacement = '/recovery-test/jre/new/bin/java'
    const records = [
      { path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true, vmOptions: ['-Xmx2G'] },
      { path: replacement, version: '17.0.2', majorVersion: 17, valid: true, isInternal: true, replacesJava: old, replacementRuntime: '/recovery-test/jre/old' },
    ]
    h.getJavaState.mockResolvedValue({ all: records })
    h.generate.mockResolvedValue({ java: replacement, skipAssetsCheck: true })
    await setup().launch()
    expect(h.migrateJavaReferences).toHaveBeenCalledWith(replacement)
    expect(h.flushJavaUpdate.mock.invocationCallOrder[0]).toBeLessThan(h.removeJava.mock.invocationCallOrder[0])
    expect(h.removeJava).toHaveBeenCalledWith(old, true, replacement)
    expect(h.completeJavaReplacement).toHaveBeenCalledWith(replacement)
  })

  it.each(['migration', 'removal'])('preserves the selected runtime when replacement %s is unsafe', async (step) => {
    const old = `/unsafe-${step}/jre/old/bin/java`
    const replacement = `/unsafe-${step}/jre/new/bin/java`
    h.getGameDataDirectory.mockResolvedValue(`/unsafe-${step}`)
    h.getJavaState.mockResolvedValue({ all: [
      { path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true },
      { path: replacement, version: '17.0.2', majorVersion: 17, valid: true, isInternal: true, replacesJava: old, replacementRuntime: `/unsafe-${step}/jre/old` },
    ] })
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })
    if (step === 'migration') h.migrateJavaReferences.mockResolvedValue(false)
    else h.removeJava.mockResolvedValue(false)

    await setup().launch()

    if (step === 'migration') expect(h.removeJava).not.toHaveBeenCalled()
    expect(h.completeJavaReplacement).toHaveBeenCalledWith(replacement)
    expect(h.launch).toHaveBeenCalledWith(expect.objectContaining({ java: old }))
  })

  it('continues an unrelated launch when pending replacement recovery fails', async () => {
    const old = '/unrelated-recovery/jre/old/bin/java'
    const replacement = '/unrelated-recovery/jre/new/bin/java'
    const failure = new Error('disk failed')
    h.getJavaState.mockResolvedValue({ all: [
      { path: replacement, version: '17.0.2', majorVersion: 17, valid: true, isInternal: true, replacesJava: old, replacementRuntime: '/unrelated-recovery/jre/old' },
    ] })
    h.flushJavaUpdate.mockRejectedValue(failure)
    h.generate.mockResolvedValue({ java: '/other/java', skipAssetsCheck: true })

    await expect(setup().launch()).resolves.toMatchObject({ pid: 42 })
    expect(h.launch).toHaveBeenCalledWith(expect.objectContaining({ java: '/other/java' }))
    expect(h.removeJava).not.toHaveBeenCalled()
    expect(h.completeJavaReplacement).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('Unable to complete an unrelated Java replacement', failure)
  })

  it('does not launch the selected old runtime when its replacement recovery fails', async () => {
    const old = '/selected-recovery/jre/old/bin/java'
    const replacement = '/selected-recovery/jre/new/bin/java'
    const failure = new Error('disk failed')
    h.getJavaState.mockResolvedValue({ all: [
      { path: replacement, version: '17.0.2', majorVersion: 17, valid: true, isInternal: true, replacesJava: old, replacementRuntime: '/selected-recovery/jre/old' },
    ] })
    h.flushJavaUpdate.mockRejectedValue(failure)
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })

    await expect(setup().launch()).rejects.toBe(failure)
    expect(h.launch).not.toHaveBeenCalled()
    expect(h.removeJava).not.toHaveBeenCalled()
    expect(h.installJava).not.toHaveBeenCalled()
  })
  it('keeps a pending replacement when the old runtime is in use', async () => {
    const old = '/pending-test/jre/old/bin/java'
    const replacement = '/pending-test/jre/new/bin/java'
    h.getJavaState.mockResolvedValue({ all: [{ path: replacement, version: '17.0.2', majorVersion: 17, valid: true, isInternal: true, replacesJava: old, replacementRuntime: '/pending-test/jre/old' }] })
    h.getGameProcesses.mockResolvedValue([{ options: { java: old } }])
    h.generate.mockResolvedValue({ java: replacement, skipAssetsCheck: true })
    await setup().launch()
    expect(h.removeJava).not.toHaveBeenCalled()
    expect(h.completeJavaReplacement).not.toHaveBeenCalled()
    expect(h.launch).toHaveBeenCalledOnce()
  })
  it('waits for an aborted in-flight update before launching another instance', async () => {
    const old = '/concurrent-test/jre/old/bin/java'
    const replacement = '/concurrent-test/jre/new/bin/java'
    const install = deferred<any>()
    h.generate.mockImplementation(async () => ({ java: old, skipAssetsCheck: true }))
    h.getJavaState.mockImplementation(async () => ({ all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] }))
    h.findJavaRuntimeUpdate.mockResolvedValueOnce({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimePath: '/concurrent-test/jre/new', displayVersion: '17.0.2' })
    h.promptJavaUpdate.mockResolvedValueOnce(true)
    h.installJava.mockReturnValueOnce(install.promise)
    const first = setup()
    const second = setup()
    const firstLaunch = first.launch()
    await flush()
    expect(h.installJava).toHaveBeenCalledOnce()
    first.abort()
    await firstLaunch
    const secondLaunch = second.launch()
    await flush()
    expect(h.launch).not.toHaveBeenCalled()
    install.resolve({ path: replacement })
    await secondLaunch
    expect(h.removeJava).toHaveBeenCalledWith(old, true, replacement)
    expect(h.launch).toHaveBeenCalledOnce()
    expect(h.launch.mock.calls[0][0].java).toBe(replacement)
  })
  it('does not delay a launch using another runtime while an update installs', async () => {
    const old = '/isolated/jre/old/bin/java'
    const other = '/isolated/jre/other/bin/java'
    const replacement = '/isolated/jre/new/bin/java'
    const install = deferred<any>()
    h.generate.mockResolvedValueOnce({ java: old, skipAssetsCheck: true })
      .mockResolvedValueOnce({ java: other, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [
      { path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true },
      { path: other, version: '21', majorVersion: 21, valid: true, isInternal: false },
    ] })
    h.findJavaRuntimeUpdate.mockResolvedValueOnce({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimePath: '/isolated/jre/new', displayVersion: '17.0.2' })
    h.promptJavaUpdate.mockResolvedValueOnce(true)
    h.installJava.mockReturnValueOnce(install.promise)

    const first = setup().launch()
    await flush()
    expect(h.installJava).toHaveBeenCalledOnce()
    await expect(setup().launch()).resolves.toMatchObject({ pid: 42 })
    expect(h.launch.mock.calls[0][0].java).toBe(other)
    install.resolve({ path: replacement })
    await first
  })

  it('does not wait for unrelated pending recovery before launching', async () => {
    const old = '/isolated/jre/old/bin/java'
    const replacement = '/isolated/jre/new/bin/java'
    const flushWrite = deferred<void>()
    h.generate.mockResolvedValue({ java: '/isolated/jre/other/bin/java', skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [
      { path: replacement, version: '17.0.2', majorVersion: 17, valid: true, isInternal: true, replacesJava: old, replacementRuntime: '/isolated/jre/old' },
    ] })
    h.flushJavaUpdate.mockReturnValue(flushWrite.promise)
    await expect(setup().launch()).resolves.toMatchObject({ pid: 42 })
    expect(h.removeJava).not.toHaveBeenCalled()
    flushWrite.resolve()
    await vi.waitFor(() => expect(h.completeJavaReplacement).toHaveBeenCalledWith(replacement))
  })
  it('does not remove a runtime while a previous launch is spawning with it', async () => {
    const old = '/spawn-test/jre/old/bin/java'
    const replacement = '/spawn-test/jre/new/bin/java'
    const spawn = deferred<number>()
    h.generate.mockImplementation(async () => ({ java: old, skipAssetsCheck: true }))
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate
      .mockResolvedValueOnce({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimeUrl: 'https://example.test/17.0.2', runtimePath: '/spawn-test/jre/new', displayVersion: '17.0.2' })
      .mockResolvedValueOnce({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimeUrl: 'https://example.test/17.0.3', runtimePath: '/spawn-test/jre/new', displayVersion: '17.0.3' })
    h.promptJavaUpdate.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    h.installJava.mockResolvedValue({ path: replacement })
    h.launch.mockReturnValueOnce(spawn.promise).mockResolvedValueOnce(42)
    const first = setup().launch()
    await flush()
    expect(h.launch).toHaveBeenCalledOnce()
    const second = setup().launch()
    await flush()
    expect(h.installJava).not.toHaveBeenCalled()
    expect(h.removeJava).not.toHaveBeenCalled()
    spawn.resolve(41)
    await Promise.all([first, second])
    expect(h.removeJava).toHaveBeenCalledWith(old, true, replacement)
    expect(h.launch.mock.calls[0][0].java).toBe(old)
    expect(h.launch.mock.calls[1][0].java).toBe(replacement)
  })
  it('does not update a runtime used by an already running game', async () => {
    const old = '/running-test/jre/old/bin/java'
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValue({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimePath: '/running-test/jre/new', displayVersion: '17.0.1' })
    h.getGameProcesses.mockResolvedValue([{ options: { java: old } }])
    await setup().launch()
    expect(h.promptJavaUpdate).not.toHaveBeenCalled()
    expect(h.installJava).not.toHaveBeenCalled()
    expect(h.removeJava).not.toHaveBeenCalled()
    expect(h.launch).toHaveBeenCalledWith(expect.objectContaining({ java: old }))
  })
  it('rechecks running games after confirmation before updating', async () => {
    const old = '/running-after-prompt/jre/old/bin/java'
    const prompt = deferred<boolean>()
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValue({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimePath: '/running-after-prompt/jre/new', displayVersion: '17.0.1' })
    h.promptJavaUpdate.mockReturnValue(prompt.promise)
    const launch = setup().launch()
    await flush()
    h.getGameProcesses.mockResolvedValue([{ options: { java: old } }])
    prompt.resolve(true)
    await launch
    expect(h.installJava).not.toHaveBeenCalled()
    expect(h.removeJava).not.toHaveBeenCalled()
  })
  it('allows an unrelated launch while a Java update prompt is open', async () => {
    const old = '/prompt-lock/jre/old/bin/java'
    const prompt = deferred<boolean>()
    h.generate.mockResolvedValueOnce({ java: old, skipAssetsCheck: true }).mockResolvedValueOnce({ java: '/external/java', skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValue({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimePath: '/prompt-lock/jre/new', displayVersion: '17.0.1' })
    h.promptJavaUpdate.mockReturnValue(prompt.promise)
    const first = setup().launch()
    await flush()
    await setup().launch()
    expect(h.launch).toHaveBeenCalledWith(expect.objectContaining({ java: '/external/java' }))
    prompt.resolve(false)
    await first
  })
  it('shares a Later decision with concurrent launches, including a delayed update check', async () => {
    const old = '/shared-later/jre/old/bin/java'
    const prompt = deferred<boolean>()
    const delayedCheck = deferred<any>()
    const update = { vendor: 'vendor', version: 'java17', majorVersion: 17, runtimeUrl: 'https://example.test/17', runtimePath: '/shared-later/jre/new', displayVersion: '17.0.2' }
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValueOnce(update).mockReturnValueOnce(delayedCheck.promise).mockResolvedValue(update)
    h.promptJavaUpdate.mockReturnValueOnce(prompt.promise).mockResolvedValue(false)
    const first = setup().launch()
    await flush()
    const second = setup().launch()
    await flush()
    expect(h.findJavaRuntimeUpdate).toHaveBeenCalledTimes(2)
    expect(h.promptJavaUpdate).toHaveBeenCalledOnce()

    prompt.resolve(false)
    await first
    delayedCheck.resolve(update)
    await second
    expect(h.promptJavaUpdate).toHaveBeenCalledOnce()
    expect(h.installJava).not.toHaveBeenCalled()
    expect(h.launch).toHaveBeenCalledTimes(2)

    await setup().launch()
    expect(h.promptJavaUpdate).toHaveBeenCalledTimes(2)
  })
  it('shares a decision with a launch still waiting for Java state', async () => {
    const old = '/shared-state/jre/old/bin/java'
    const state = { all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] }
    const prompt = deferred<boolean>()
    const delayedState = deferred<any>()
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValueOnce(state).mockReturnValueOnce(delayedState.promise)
    h.findJavaRuntimeUpdate.mockResolvedValue({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimeUrl: 'https://example.test/17', runtimePath: '/shared-state/jre/new', displayVersion: '17.0.2' })
    h.promptJavaUpdate.mockReturnValue(prompt.promise)
    const first = setup().launch()
    await flush()
    const second = setup().launch()
    await flush()
    expect(h.getJavaState).toHaveBeenCalledTimes(2)

    prompt.resolve(false)
    await first
    delayedState.resolve(state)
    await second
    expect(h.promptJavaUpdate).toHaveBeenCalledOnce()
    expect(h.launch).toHaveBeenCalledTimes(2)
  })
  it('shares one confirmation and one install across concurrent launches', async () => {
    const old = '/shared-update/jre/old/bin/java'
    const replacement = '/shared-update/jre/new/bin/java'
    const prompt = deferred<boolean>()
    const install = deferred<any>()
    h.generate.mockImplementation(async () => ({ java: old, skipAssetsCheck: true }))
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValue({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimeUrl: 'https://example.test/17', runtimePath: '/shared-update/jre/new', displayVersion: '17.0.2' })
    h.promptJavaUpdate.mockReturnValue(prompt.promise)
    h.installJava.mockReturnValue(install.promise)
    const first = setup().launch()
    const second = setup().launch()
    await flush()
    expect(h.promptJavaUpdate).toHaveBeenCalledOnce()
    prompt.resolve(true)
    await flush()
    expect(h.installJava).toHaveBeenCalledOnce()
    install.resolve({ path: replacement })
    await Promise.all([first, second])
    expect(h.installJava).toHaveBeenCalledOnce()
    expect(h.launch.mock.calls.map(call => call[0].java)).toEqual([replacement, replacement])
  })
  it('keeps a shared prompt open when only one launch is cancelled', async () => {
    const old = '/shared-abort/jre/old/bin/java'
    const prompt = deferred<boolean>()
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValue({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimeUrl: 'https://example.test/17', runtimePath: '/shared-abort/jre/new', displayVersion: '17.0.2' })
    h.promptJavaUpdate.mockReturnValue(prompt.promise)
    const first = setup()
    const second = setup()
    const firstLaunch = first.launch()
    const secondLaunch = second.launch()
    await flush()
    expect(h.promptJavaUpdate).toHaveBeenCalledOnce()
    const signal: AbortSignal = h.promptJavaUpdate.mock.calls[0][4]
    first.abort()
    await firstLaunch
    expect(signal.aborted).toBe(false)
    prompt.resolve(false)
    await secondLaunch
    expect(h.launch).toHaveBeenCalledOnce()
  })
  it('closes a shared prompt when all launches cancel and allows a later prompt', async () => {
    const old = '/shared-all-abort/jre/old/bin/java'
    h.generate.mockResolvedValue({ java: old, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValue({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimeUrl: 'https://example.test/17', runtimePath: '/shared-all-abort/jre/new', displayVersion: '17.0.2' })
    h.promptJavaUpdate.mockImplementationOnce((_show, _hide, _current, _next, signal: AbortSignal) =>
      new Promise(resolve => signal.addEventListener('abort', () => resolve(false), { once: true })))
      .mockResolvedValue(false)
    const first = setup()
    const second = setup()
    const firstLaunch = first.launch()
    const secondLaunch = second.launch()
    await flush()
    const signal: AbortSignal = h.promptJavaUpdate.mock.calls[0][4]
    first.abort()
    expect(signal.aborted).toBe(false)
    second.abort()
    await Promise.all([firstLaunch, secondLaunch])
    expect(signal.aborted).toBe(true)
    expect(h.launch).not.toHaveBeenCalled()

    await setup().launch()
    expect(h.promptJavaUpdate).toHaveBeenCalledTimes(2)
    expect(h.launch).toHaveBeenCalledOnce()
  })
  it('does not redirect a newly reinstalled runtime on a later launch', async () => {
    const old = '/reinstall-test/jre/old/bin/java'
    const replacement = '/reinstall-test/jre/new/bin/java'
    h.generate.mockImplementation(async () => ({ java: old, skipAssetsCheck: true }))
    h.getJavaState.mockResolvedValue({ all: [{ path: old, version: '17.0.1', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValueOnce({ vendor: 'vendor', version: 'java17', majorVersion: 17, runtimePath: '/reinstall-test/jre/new', displayVersion: '17.0.2' }).mockResolvedValueOnce(undefined)
    h.promptJavaUpdate.mockResolvedValueOnce(true)
    h.installJava.mockResolvedValueOnce({ path: replacement })
    await setup().launch()
    await setup().launch()
    expect(h.launch.mock.calls[0][0].java).toBe(replacement)
    expect(h.launch.mock.calls[1][0].java).toBe(old)
  })
  it('updates an internal Java only after confirmation and before spawning', async () => {
    const oldJavaPath =
      '/isolated/jre/eclipse_temurin_jre17.0.21+2/jdk-17.0.21.1+2-jre/bin/java'
    const newJavaPath =
      '/isolated/jre/eclipse_temurin_jre17.0.21+9/jdk-17.0.21+9-jre/bin/java'
    h.generate.mockImplementationOnce(async () => ({ java: oldJavaPath, skipAssetsCheck: true }))
    h.getJavaState.mockResolvedValueOnce({
      all: [
        {
          path: oldJavaPath,
          version: '17.0.21.2',
          majorVersion: 17,
          valid: true,
          isInternal: true,
          installVendor: 'net.adoptium.java',
          prependCommand: 'java-wrapper',
          vmOptions: ['-Xmx2G'],
        },
      ],
    })
    h.findJavaRuntimeUpdate.mockResolvedValueOnce({
      vendor: 'net.adoptium.java',
      version: 'java17',
      majorVersion: 17,
      runtimeUrl: 'https://example.test/java17',
      runtimePath: '/isolated/jre/eclipse_temurin_jre17.0.21+9',
      displayVersion: '17.0.21.9',
    })
    h.promptJavaUpdate.mockResolvedValueOnce(true)
    h.installJava.mockResolvedValueOnce({
      path: newJavaPath,
      version: '17.0.21.9',
      majorVersion: 17,
    })
    await setup([], oldJavaPath).launch()

    expect(h.promptJavaUpdate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      '17.0.21.2',
      '17.0.21.9',
      expect.any(AbortSignal),
    )
    expect(h.installJava).toHaveBeenCalledWith({
      type: 'java',
      vendor: 'net.adoptium.java',
      version: 'java17',
      majorVersion: 17,
      runtimeUrl: 'https://example.test/java17',
      replaceJava: oldJavaPath,
      replaceRuntime: '/isolated/jre/eclipse_temurin_jre17.0.21+2',
    })
    expect(h.migrateJavaReferences).toHaveBeenCalledWith(newJavaPath)
    expect(h.removeJava).toHaveBeenCalledWith(oldJavaPath, true, newJavaPath)
    expect(h.flushJavaUpdate.mock.invocationCallOrder[0]).toBeLessThan(h.removeJava.mock.invocationCallOrder[0])
    expect(h.refreshLocalJava).toHaveBeenCalledWith(true)
    expect(h.launch).toHaveBeenCalledWith(expect.objectContaining({ java: newJavaPath }))
    expect(h.launch).toHaveBeenCalledOnce()
  })

  it('waits for reference migration before removing the old runtime and propagates failures', async () => {
    const oldJavaPath = '/isolated/jre/old/bin/java'
    const newJavaPath = '/isolated/jre/new/bin/java'
    const commit = deferred<void>()
    const failure = new Error('settings commit failed')
    h.generate.mockResolvedValue({ java: oldJavaPath, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValue({ all: [{ path: oldJavaPath, version: '17', majorVersion: 17, valid: true, isInternal: true }] })
    h.findJavaRuntimeUpdate.mockResolvedValue({
      vendor: 'net.adoptium.java', version: 'java17', majorVersion: 17,
      runtimeUrl: 'https://example.test/java', runtimePath: '/isolated/jre/new', displayVersion: '17.0.1',
    })
    h.promptJavaUpdate.mockResolvedValue(true)
    h.installJava.mockResolvedValue({ path: newJavaPath })
    h.migrateJavaReferences.mockReturnValueOnce(commit.promise)

    const result = setup().launch()
    await flush()
    expect(h.migrateJavaReferences).toHaveBeenCalledOnce()
    expect(h.removeJava).not.toHaveBeenCalled()
    commit.reject(failure)
    await expect(result).rejects.toBe(failure)
    expect(h.removeJava).not.toHaveBeenCalled()
    expect(h.launch).not.toHaveBeenCalled()
  })

  it('continues launch without updating when the user chooses later', async () => {
    const oldJavaPath = '/later-test/jre/old/bin/java'
    h.generate.mockResolvedValueOnce({ java: oldJavaPath, skipAssetsCheck: true })
    h.getJavaState.mockResolvedValueOnce({
      all: [
        {
          path: oldJavaPath,
          version: '21.0.5',
          majorVersion: 21,
          valid: true,
          isInternal: true,
        },
      ],
    })
    h.findJavaRuntimeUpdate.mockResolvedValueOnce({
      vendor: 'net.adoptium.java',
      version: 'java21',
      majorVersion: 21,
      runtimeUrl: 'https://example.test/java21',
      runtimePath: '/later-test/jre/new',
      displayVersion: '21.0.6',
    })
    h.promptJavaUpdate.mockResolvedValueOnce(false)

    await setup().launch()

    expect(h.installJava).not.toHaveBeenCalled()
    expect(h.launch).toHaveBeenCalledOnce()
  })

  it('skips an unavailable Java update check and proceeds with launch', async () => {
    h.getJavaState.mockResolvedValueOnce({
      all: [
        {
          path: 'java',
          version: '21.0.5',
          majorVersion: 21,
          valid: true,
          isInternal: true,
        },
      ],
    })
    h.findJavaRuntimeUpdate.mockRejectedValueOnce(new Error('offline'))

    await setup().launch()

    expect(h.promptJavaUpdate).not.toHaveBeenCalled()
    expect(h.launch).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledWith(
      'Unable to check for Java runtime updates',
      expect.any(Error),
    )
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
