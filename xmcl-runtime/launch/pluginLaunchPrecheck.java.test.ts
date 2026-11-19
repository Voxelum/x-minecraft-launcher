import { expect, it, vi } from 'vitest'

vi.mock('~/app', () => ({ kGameDataPath: Symbol('gameDataPath') }))
vi.mock('~/instance', () => ({ InstanceService: class {} }))
vi.mock('~/install/InstallService', () => ({ VersionInstallService: class {} }))
vi.mock('~/java', () => ({
  JavaService: class {},
  JavaValidation: { Okay: 0, NotExisted: 1, NoPermission: 2 },
  getManagedJavaComponent: () => ({ component: 'runtime' }),
}))
vi.mock('~/launch', () => ({ LaunchService: class {} }))
vi.mock('~/peer', () => ({ PeerService: class {} }))
vi.mock('~/settings', () => ({ kSettings: Symbol('settings') }))

import { kGameDataPath } from '~/app'
import type { JavaRecord } from '@xmcl/runtime-api'
import { JavaService } from '~/java'
import { LaunchService } from '~/launch'
import { pluginLaunchPrecheck } from './pluginLaunchPrecheck'

async function setupPrecheck(java: { resolveJava: ReturnType<typeof vi.fn>; removeJava: ReturnType<typeof vi.fn>; validateJavaPath?: ReturnType<typeof vi.fn>; state: { all: JavaRecord[] } }) {
  const install = vi.fn()
  const middleware = new Map<string, { onBeforeLaunch: (input: unknown, payload: unknown) => Promise<void> }>()
  const launch = { registerMiddleware: (value: { name: string; onBeforeLaunch: (input: unknown, payload: unknown) => Promise<void> }) => middleware.set(value.name, value) }
  const app = {
    registry: {
      get: async (key: unknown) => key === LaunchService ? launch : key === kGameDataPath ? () => '/data/jre' : { state: { subscribe: vi.fn() } },
      getOrCreate: async (key: unknown) => key === JavaService ? java : { install },
    },
    getLogger: () => ({ error: vi.fn() }),
  }
  await pluginLaunchPrecheck(app as never, {} as never)
  const precheck = middleware.get('java-validation')
  expect(precheck).toBeDefined()
  return { precheck: precheck!, install }
}

it('does not uninstall or reinstall a runtime when its version probe times out', async () => {
  const timeout = new Error('Java version probe timed out')
  const java = { resolveJava: vi.fn().mockRejectedValue(timeout), removeJava: vi.fn(), state: { all: [] } }
  const { precheck, install } = await setupPrecheck(java)

  await expect(precheck.onBeforeLaunch(
    { java: '/data/jre/runtime/bin/java' },
    { version: { javaVersion: { component: 'runtime', majorVersion: 17 } }, options: {} },
  )).rejects.toMatchObject({ cause: timeout })
  expect(java.removeJava).not.toHaveBeenCalled()
  expect(install).not.toHaveBeenCalled()
})

it.each([0, 2])('preserves an existing managed runtime when validation returns %s', async (validation) => {
  const java = {
    resolveJava: vi.fn().mockResolvedValue(undefined),
    validateJavaPath: vi.fn().mockResolvedValue(validation),
    removeJava: vi.fn(),
    state: { all: [] },
  }
  const { precheck, install } = await setupPrecheck(java)

  await expect(precheck.onBeforeLaunch(
    { java: '/data/jre/runtime/bin/java' },
    { version: { javaVersion: { component: 'runtime', majorVersion: 17 } }, options: {} },
  )).rejects.toThrow()
  expect(java.removeJava).not.toHaveBeenCalled()
  expect(install).not.toHaveBeenCalled()
})

it('preserves the old runtime when a missing executable cannot be reinstalled', async () => {
  const java = {
    resolveJava: vi.fn().mockResolvedValue(undefined),
    validateJavaPath: vi.fn().mockResolvedValue(1),
    removeJava: vi.fn(),
    state: { all: [] },
  }
  const { precheck, install } = await setupPrecheck(java)
  const offline = new Error('Offline')
  install.mockRejectedValue(offline)

  await expect(precheck.onBeforeLaunch(
    { java: '/data/jre/runtime/bin/java' },
    { version: { javaVersion: { component: 'runtime', majorVersion: 17 } }, options: {} },
  )).rejects.toMatchObject({ cause: offline })
  expect(install).toHaveBeenCalledOnce()
  expect(java.removeJava).not.toHaveBeenCalled()
})

it('uses a successfully installed runtime without deleting the old directory', async () => {
  const java = {
    resolveJava: vi.fn().mockResolvedValue(undefined),
    validateJavaPath: vi.fn().mockResolvedValue(1),
    removeJava: vi.fn(),
    state: { all: [] },
  }
  const { precheck, install } = await setupPrecheck(java)
  const input = { java: '/data/jre/runtime/bin/java' }
  const payload = { version: { javaVersion: { component: 'runtime', majorVersion: 17 } }, options: { javaPath: input.java } }
  install.mockResolvedValue({ path: '/data/jre/new-runtime/bin/java' })

  await precheck.onBeforeLaunch(input, payload)

  expect(input.java).toBe('/data/jre/new-runtime/bin/java')
  expect(payload.options.javaPath).toBe(input.java)
  expect(java.removeJava).not.toHaveBeenCalled()
})

it('reuses a verified internal runtime on later launches instead of installing again', async () => {
  const replacement = { path: '/data/jre/new-runtime/bin/java', version: '17.0.2', majorVersion: 17, valid: true, isInternal: true }
  const java = {
    resolveJava: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(replacement),
    validateJavaPath: vi.fn().mockResolvedValue(1),
    removeJava: vi.fn(),
    state: { all: [replacement] },
  }
  const { precheck, install } = await setupPrecheck(java)
  const input = { java: '/data/jre/runtime/bin/java' }
  const payload = { version: { javaVersion: { component: 'runtime', majorVersion: 17 } }, options: { javaPath: input.java } }

  await precheck.onBeforeLaunch(input, payload)

  expect(input.java).toBe(replacement.path)
  expect(payload.options.javaPath).toBe(replacement.path)
  expect(install).not.toHaveBeenCalled()
  expect(java.removeJava).not.toHaveBeenCalled()
})

it('skips invalid or pending replacement candidates when repairing missing Java', async () => {
  const pending = { path: '/data/jre/pending/bin/java', version: '17', majorVersion: 17, valid: true, isInternal: true, replacesJava: '/old/bin/java' }
  const invalid = { path: '/data/jre/invalid/bin/java', version: '17', majorVersion: 17, valid: true, isInternal: true }
  const java = {
    resolveJava: vi.fn().mockResolvedValue(undefined),
    validateJavaPath: vi.fn().mockResolvedValue(1),
    removeJava: vi.fn(),
    state: { all: [pending, invalid] },
  }
  const { precheck, install } = await setupPrecheck(java)
  install.mockResolvedValue({ path: '/data/jre/new-runtime/bin/java' })

  await precheck.onBeforeLaunch(
    { java: '/data/jre/runtime/bin/java' },
    { version: { javaVersion: { component: 'runtime', majorVersion: 17 } }, options: {} },
  )

  expect(java.resolveJava).not.toHaveBeenCalledWith(pending.path)
  expect(java.resolveJava).toHaveBeenCalledWith(invalid.path)
  expect(install).toHaveBeenCalledOnce()
})

it('shares an in-flight repair across concurrent launches for the same Java major', async () => {
  const java = {
    resolveJava: vi.fn().mockResolvedValue(undefined),
    validateJavaPath: vi.fn().mockResolvedValue(1),
    removeJava: vi.fn(),
    state: { all: [] },
  }
  const { precheck, install } = await setupPrecheck(java)
  let finish!: (value: { path: string }) => void
  install.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const inputs = [{ java: '/data/jre/one/bin/java' }, { java: '/data/jre/two/bin/java' }]
  const payloads = inputs.map(input => ({
    version: { javaVersion: { component: 'runtime', majorVersion: 17 } },
    options: { javaPath: input.java },
  }))
  const launches = inputs.map((input, index) => precheck.onBeforeLaunch(input, payloads[index]))

  await vi.waitFor(() => expect(java.validateJavaPath).toHaveBeenCalledTimes(2))
  await vi.waitFor(() => expect(install).toHaveBeenCalledOnce())
  finish({ path: '/data/jre/new-runtime/bin/java' })
  await Promise.all(launches)

  expect(install).toHaveBeenCalledOnce()
  expect(inputs.map(input => input.java)).toEqual(['/data/jre/new-runtime/bin/java', '/data/jre/new-runtime/bin/java'])
  expect(payloads.map(payload => payload.options.javaPath)).toEqual(inputs.map(input => input.java))
  expect(java.removeJava).not.toHaveBeenCalled()
})

it('shares a failed repair and allows a later retry', async () => {
  const java = {
    resolveJava: vi.fn().mockResolvedValue(undefined),
    validateJavaPath: vi.fn().mockResolvedValue(1),
    removeJava: vi.fn(),
    state: { all: [] },
  }
  const { precheck, install } = await setupPrecheck(java)
  let fail!: (error: Error) => void
  install.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
  const launch = () => precheck.onBeforeLaunch(
    { java: '/data/jre/runtime/bin/java' },
    { version: { javaVersion: { component: 'runtime', majorVersion: 17 } }, options: {} },
  )
  const results = Promise.allSettled([launch(), launch()])
  await vi.waitFor(() => expect(java.validateJavaPath).toHaveBeenCalledTimes(2))
  await vi.waitFor(() => expect(install).toHaveBeenCalledOnce())
  const offline = new Error('Offline')
  fail(offline)

  const failed = await results
  expect(failed).toHaveLength(2)
  for (const result of failed) {
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') expect(result.reason).toMatchObject({ cause: offline })
  }
  expect(install).toHaveBeenCalledOnce()
  install.mockResolvedValue({ path: '/data/jre/new-runtime/bin/java' })
  await launch()
  expect(install).toHaveBeenCalledTimes(2)
})

it('does not coalesce repairs for different Java major versions', async () => {
  const java = {
    resolveJava: vi.fn().mockResolvedValue(undefined),
    validateJavaPath: vi.fn().mockResolvedValue(1),
    removeJava: vi.fn(),
    state: { all: [] },
  }
  const { precheck, install } = await setupPrecheck(java)
  const finish: Array<(value: { path: string }) => void> = []
  install.mockImplementation(() => new Promise(resolve => { finish.push(resolve) }))
  const launches = [17, 21].map(majorVersion => precheck.onBeforeLaunch(
    { java: `/data/jre/java${majorVersion}/bin/java` },
    { version: { javaVersion: { component: 'runtime', majorVersion } }, options: {} },
  ))
  await vi.waitFor(() => expect(install).toHaveBeenCalledTimes(2))
  finish[0]({ path: '/data/jre/java17-new/bin/java' })
  finish[1]({ path: '/data/jre/java21-new/bin/java' })
  await Promise.all(launches)
})
