import { describe, expect, test, vi } from 'vitest'

const installJavaRuntime = vi.hoisted(() => vi.fn())
vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherApp: class {},
  LauncherAppKey: Symbol(),
  kGameDataPath: Symbol(),
}))
vi.mock('~/infra', () => ({ GFW: class {}, Tasks: class {}, kGFW: Symbol(), kTasks: Symbol() }))
vi.mock('~/infra/recoverRestore', () => ({ recoverRestore: vi.fn() }))
vi.mock('~/instance', () => ({ InstanceService: class {} }))
vi.mock('~/java', () => ({ JavaService: class {} }))
vi.mock('~/launch', () => ({ VersionService: class {} }))
vi.mock('~/settings', () => ({ kSettings: Symbol() }))
vi.mock('~/resource', () => ({ ResourceWorker: class {}, kResourceWorker: Symbol() }))
vi.mock('~/java/JavaInstall', () => ({ installJavaRuntime }))
vi.mock('~/util/taskHelper', () => ({}))
vi.mock('./InstallManifestService', () => ({ InstallManifestService: class {} }))
vi.mock('./VersionMetadataService', () => ({ VersionMetadataService: class {} }))
vi.mock('./utils/MultiJarLauncher.class', () => ({ default: '' }))
vi.mock('./optifine', () => ({ kOptifineInstaller: Symbol() }))

import { InstallCoordinator } from './InstallCoordinator'

describe('InstallCoordinator installed-version Java selection', () => {
  test.each([
    [{ minecraft: '1.21', forge: '' }, { minecraft: '1.20.1', forge: '47.4.0' }, false],
    [{ minecraft: '1.21', forge: '' }, { minecraft: '1.20.1', forge: '47.4.0' }, true],
    [{ minecraft: '1.20.1', forge: '47.4.0' }, { minecraft: '1.21', forge: '' }, false],
  ])(
    'uses the requested runtime rather than the old instance runtime: %j → %j',
    async (oldRuntime, runtime, pinned) => {
      // Do not invoke the constructor: exercise the coordinator fast path with
      // services only, without starting the launcher or touching instance data.
      const coordinator = Object.create(InstallCoordinator.prototype)
      const resolved = { id: 'target', minecraftVersion: runtime.minecraft }
      coordinator.versionService = {
        state: { local: [{ id: 'target', ...runtime }] },
        resolveLocalVersion: vi.fn().mockResolvedValue(resolved),
      }
      coordinator.instanceService = {
        state: { all: { '/instance': { runtime: oldRuntime, java: '/pinned-java' } } },
      }
      coordinator.diagnoseClientVersion = vi.fn().mockResolvedValue(undefined)
      coordinator.javaService = {
        state: { all: [{ path: '/java21', majorVersion: 21, version: '21', valid: true }] },
        resolveJava: vi.fn().mockResolvedValue(pinned ? { path: '/pinned-java' } : undefined),
      }
      coordinator.installPreferredJava = vi.fn().mockResolvedValue({ path: '/java17' })
      const selectJava = vi.spyOn(coordinator, 'ensureSelectedInstanceJava')

      await coordinator.installInstanceRequest({
        type: 'instance',
        instancePath: '/instance',
        runtime,
        selectedVersion: 'target',
      })

      expect(coordinator.javaService.resolveJava).toHaveBeenCalledWith('/pinned-java')
      expect(selectJava).toHaveBeenCalledExactlyOnceWith(
        resolved,
        runtime.minecraft,
        runtime.forge,
        '/pinned-java',
      )
      if (runtime.forge && !pinned) {
        expect(coordinator.installPreferredJava).toHaveBeenCalledExactlyOnceWith({
          component: 'java-runtime-gamma',
          majorVersion: 17,
        })
      } else {
        expect(coordinator.installPreferredJava).not.toHaveBeenCalled()
      }
    },
  )

  test('serializes vendor Java installs through the shared vendor/version lock', async () => {
    const coordinator = Object.create(InstallCoordinator.prototype)
    const runJavaInstall = vi.fn().mockResolvedValue({ path: '/java/bin/java' })
    const runExclusive = vi.fn((action: () => Promise<unknown>) => action())
    const mutexOf = vi.fn(() => ({ runExclusive }))
    Object.assign(coordinator, {
      app: { mutex: { of: mutexOf } },
      runJavaInstall,
    })

    await coordinator.install({
      type: 'java',
      vendor: 'net.adoptium.java',
      version: 'java21',
      majorVersion: 21,
    })

    expect(mutexOf).toHaveBeenCalledExactlyOnceWith('java/net.adoptium.java/java21')
    expect(runExclusive).toHaveBeenCalledExactlyOnceWith(expect.any(Function))
    expect(runJavaInstall).toHaveBeenCalledExactlyOnceWith(
      'net.adoptium.java',
      'java21',
      21,
      undefined,
      undefined,
      undefined,
      undefined,
    )
  })

  test('persists a replacement marker before reporting the installation complete', async () => {
    const coordinator = Object.create(InstallCoordinator.prototype)
    const java = { path: '/jre/new/bin/java', version: '17.0.2', majorVersion: 17 }
    const task = { complete: vi.fn(), fail: vi.fn() }
    const javaUpdate = vi.fn()
    const flushJavaUpdate = vi.fn().mockResolvedValue(undefined)
    installJavaRuntime.mockResolvedValueOnce(java)
    Object.assign(coordinator, {
      app: {},
      tasks: { create: () => task },
      javaService: { state: { javaUpdate }, flushJavaUpdate, resolveJava: vi.fn() },
      logger: { error: vi.fn() },
    })

    await coordinator.runJavaInstall('net.adoptium.java', 'java17', 17, undefined, undefined, '/jre/old/bin/java', '/jre/old')

    expect(installJavaRuntime.mock.calls.at(-1)?.at(-1)).toEqual({
      javaPath: '/jre/old/bin/java', runtimePath: '/jre/old',
    })
    expect(javaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      path: java.path, replacesJava: '/jre/old/bin/java', replacementRuntime: '/jre/old',
    }))
    expect(flushJavaUpdate.mock.invocationCallOrder[0]).toBeLessThan(task.complete.mock.invocationCallOrder[0])
  })
})
