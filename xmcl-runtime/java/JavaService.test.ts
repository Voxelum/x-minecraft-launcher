import { JavaState } from '@xmcl/runtime-api'
import { resolveJava, resolveJavaWithDiagnostic, scanLocalJava } from '@xmcl/installer'
import { readJson, remove } from 'fs-extra'
import { writeFile as writeFileAtomically } from 'atomically'
import {
  access as accessFile,
  mkdir,
  mkdtemp,
  readFile as readFileFromDisk,
  rm as removeFromDisk,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JavaValidation, validateJavaPath } from '~/java'
import { getRestoreGate } from '~/infra/restoreGate'
import { ensureClass } from './detectJVMArch'
import { getJavaArch } from './detectJVMArch'
import { getJavaReferenceGate } from './javaReferenceGate'
import { getOrCreateJavaRuntimeIdentity, readJavaReplacementJournal, writeJavaReplacementJournal } from './javaReplacementJournal'
import { readdirIfPresent } from '../util/fs'

vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
}))
vi.mock('~/service', () => ({
  ExposeServiceKey: () => () => {},
  Singleton: () => () => {},
  StatefulService: class {
    app: { appDataPath: string }
    state: unknown
    initialize: () => Promise<void>
    constructor(app: { appDataPath: string }, createState: () => unknown, initialize: () => Promise<void>) {
      this.app = app
      this.state = createState()
      let initialized: Promise<void> | undefined
      this.initialize = () => initialized ??= initialize()
    }
    getAppDataPath(path: string) { return join(this.app.appDataPath, path) }
    log() {}
    warn() {}
    error() {}
  },
  ServiceStateManager: class {},
}))
vi.mock('atomically', async (importOriginal) => {
  const original = await importOriginal<typeof import('atomically')>()
  return { ...original, writeFile: vi.fn(original.writeFile) }
})
vi.mock('../launch/LaunchService', () => ({ LaunchService: class {} }))
vi.mock('../instance/InstanceService', () => ({ InstanceService: class {} }))
vi.mock('~/java', () => ({
  JavaValidation: { Okay: 0, NotExisted: 1, NoPermission: 2 },
  detectLibc: vi.fn(),
  detectExecutableLibc: vi.fn(),
  getJavaExeFilePath: vi.fn(),
  getManagedJavaComponent: vi.fn((javaPath: string, root: string) => {
    const normalizedPath = javaPath.replace(/\\/g, '/')
    const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '')
    if (!normalizedPath.toLowerCase().startsWith(`${normalizedRoot}/`.toLowerCase())) {
      return undefined
    }
    return { component: normalizedPath.slice(normalizedRoot.length + 1).split('/')[0] }
  }),
  validateJavaPath: vi.fn(),
}))
vi.mock('@xmcl/installer', () => {
  const resolveJava = vi.fn()
  return {
    resolveJava,
    resolveJavaWithDiagnostic: vi.fn(async (...args) => ({ java: await resolveJava(...args), stdout: '', stderr: '' })),
    scanLocalJava: vi.fn(),
    parseJavaVersion: vi.fn(),
  }
})
vi.mock('fs-extra', () => ({
  stat: vi.fn(async () => ({ ino: 1 })),
  readFile: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../util/fs', () => ({ readdirIfPresent: vi.fn(async () => []) }))
vi.mock('./detectJVMArch', () => ({
  ensureClass: vi.fn(),
  getJavaArch: vi.fn(async () => 'x64'),
}))
vi.mock('./javaPaths', () => ({
  getAdoptiumJavaPaths: vi.fn(async () => [
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot\\bin\\java.exe',
  ]),
  getMojangJavaPaths: vi.fn(async () => []),
  getOrcaleJavaPaths: vi.fn(async () => []),
  getOpenJdkPaths: vi.fn(async () => []),
  getZuluJdkPath: vi.fn(async () => []),
  getJavaPathsLinux: vi.fn(async () => []),
  getJavaPathsLinuxSDK: vi.fn(async () => []),
  getJavaPathsOSX: vi.fn(async () => []),
}))

const { JavaService } = await import('./JavaService')
const { LaunchService } = await import('../launch/LaunchService')
const getGameProcesses = vi.fn()

describe('JavaService journal persistence', () => {
  it('rejects malformed caches rather than discarding their contents', async () => {
    vi.mocked(readJson).mockResolvedValueOnce({ unexpected: [] })
    vi.mocked(ensureClass).mockResolvedValue(undefined)
    const state = Object.assign(new JavaState(), { subscribeAll: vi.fn() })
    const app = { appDataPath: '/corrupt', registryDisposer: vi.fn() }
    const service = new JavaService(app as never, { registerStatic: () => state } as never, (() => '/jre') as never)

    await expect(service.initialize()).rejects.toThrow('Invalid Java cache')
    expect(state.subscribeAll).not.toHaveBeenCalled()
  })

  it('rejects cache read errors instead of replacing recovery data', async () => {
    vi.mocked(readJson).mockRejectedValueOnce(new Error('permission denied'))
    vi.mocked(ensureClass).mockResolvedValue(undefined)
    const state = Object.assign(new JavaState(), { subscribeAll: vi.fn() })
    const app = { appDataPath: '/unreadable', registryDisposer: vi.fn() }
    const service = new JavaService(app as never, { registerStatic: () => state } as never, (() => '/jre') as never)

    await expect(service.initialize()).rejects.toThrow('permission denied')
    expect(state.subscribeAll).not.toHaveBeenCalled()
  })

  it('restores a replacement journal after activation before cache persistence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xmcl-java-recovery-'))
    const root = join(directory, 'jre')
    const staged = join(root, 'staged')
    const destination = join(root, 'new')
    const path = join(destination, 'bin', 'java')
    const record = {
      path, version: '17.0.2', majorVersion: 17, valid: true, isInternal: true,
      installVendor: 'net.adoptium.java', replacesJava: join(root, 'old', 'bin', 'java'),
      replacementRuntime: join(root, 'old'),
    }
    try {
      await mkdir(staged, { recursive: true })
      await writeJavaReplacementJournal(staged, record)
      const { rename } = await import('node:fs/promises')
      await rename(staged, destination)
      vi.mocked(readJson).mockResolvedValue({ all: [] })
      vi.mocked(ensureClass).mockResolvedValue(undefined)
      vi.mocked(readdirIfPresent).mockResolvedValueOnce(['new'])
      vi.mocked(validateJavaPath).mockResolvedValue(JavaValidation.Okay)
      vi.mocked(resolveJava).mockResolvedValue({ path, version: '17.0.2', majorVersion: 17 })
      vi.mocked(resolveJava).mockClear()
      let notify = () => {}
      const state = Object.assign(new JavaState(), { subscribeAll: vi.fn((listener: () => void) => { notify = listener }) })
      const update = state.javaUpdate.bind(state)
      state.javaUpdate = (java) => { update(java); notify() }
      const app = { appDataPath: directory, registryDisposer: vi.fn(), platform: { os: 'linux' } }
      const service = new JavaService(app as never, { registerStatic: () => state } as never, (() => root) as never)
      vi.spyOn(service, 'refreshLocalJava').mockResolvedValue(undefined)

      await service.initialize()

      expect(resolveJava).not.toHaveBeenCalled()
      expect(state.all).toContainEqual(expect.objectContaining(record))
      const persisted = JSON.parse(await readFileFromDisk(join(directory, 'java.json'), 'utf8'))
      expect(persisted.all[0]).toMatchObject({ replacesJava: record.replacesJava, isInternal: true })
      expect(await readJavaReplacementJournal(destination, root, false)).toMatchObject(record)
      await service.completeJavaReplacement(path)
      expect(await readJavaReplacementJournal(destination, root, false)).toBeUndefined()
      const completed = JSON.parse(await readFileFromDisk(join(directory, 'java.json'), 'utf8'))
      expect(completed.all[0].replacesJava).toBe('')
    } finally {
      await removeFromDisk(directory, { recursive: true, force: true })
    }
  })

  it('writes pending replacements atomically and retries a failed write', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xmcl-java-journal-'))
    try {
      await writeFile(join(directory, 'java.json'), '{"all":[]}')
      vi.mocked(readJson).mockResolvedValue({ all: [] })
      vi.mocked(ensureClass).mockResolvedValue(undefined)
      const state = Object.assign(new JavaState(), { subscribeAll: vi.fn((_notify: () => void) => {}) })
      const app = { appDataPath: directory, registryDisposer: vi.fn() }
      const store = { registerStatic: () => state }
      const service = new JavaService(app as never, store as never, (() => join(directory, 'jre')) as never)
      vi.spyOn(service, 'refreshLocalJava').mockResolvedValue(undefined)
      await service.initialize()
      const notify = state.subscribeAll.mock.calls[0][0] as () => void
      state.javaUpdate({
        path: join(directory, 'jre/new/bin/java'), version: '17.0.2', majorVersion: 17,
        valid: true, isInternal: true, replacesJava: join(directory, 'jre/old/bin/java'),
        replacementRuntime: join(directory, 'jre/old'),
      })
      notify()
      vi.mocked(writeFileAtomically).mockRejectedValueOnce(new Error('disk failed'))
      await expect(service.flushJavaUpdate()).rejects.toThrow('disk failed')
      expect(await readFileFromDisk(join(directory, 'java.json'), 'utf8')).toBe('{"all":[]}')
      await service.flushJavaUpdate()
      expect(writeFileAtomically).toHaveBeenCalledWith(
        join(directory, 'java.json'),
        expect.stringContaining('"replacementRuntime"'),
      )
      const persisted = JSON.parse(await readFileFromDisk(join(directory, 'java.json'), 'utf8'))
      expect(persisted.all[0].replacesJava).toBe(join(directory, 'jre/old/bin/java'))
    } finally {
      await removeFromDisk(directory, { recursive: true, force: true })
    }
  })
})

describe('JavaService discovery', () => {
  const java17 = {
    path: 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot\\bin\\java.exe',
    version: '17.0.20',
    majorVersion: 17,
  }
  const cached = {
    path: 'C:\\custom-java\\bin\\java.exe',
    version: '25',
    majorVersion: 25,
    valid: true,
  }
  let service: InstanceType<typeof JavaService>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(remove).mockResolvedValue(undefined)
    vi.mocked(scanLocalJava).mockResolvedValue([java17])
    vi.mocked(resolveJava).mockImplementation(async (path) =>
      path === '/tmp/xmcl/jre/new/bin/java'
        ? { path, version: '17', majorVersion: 17 }
        : cached,
    )
    vi.mocked(validateJavaPath).mockResolvedValue(JavaValidation.Okay)
    getGameProcesses.mockResolvedValue([])
    service = Object.assign(Object.create(JavaService.prototype), {
      state: new JavaState(),
      removalGenerations: new Map(),
      app: {
        platform: { os: 'windows' },
        mutex: { of: () => ({ runExclusive: (action: () => Promise<unknown>) => action() }) },
        registry: { getOrCreate: async () => ({ getGameProcesses }) },
      },
      getPath: () => 'C:\\xmcl\\jre',
      log: vi.fn(),
      warn: vi.fn(),
    })
  })

  it.each([false, true])(
    'discovers Adoptium while preserving cached custom Java (force=%s)',
    async (force) => {
      service.state.javaUpdate(cached)
      await service.refreshLocalJava(force)
      expect(scanLocalJava).toHaveBeenCalledWith([java17.path], { timeout: 5000 })
      expect(service.state.all).toEqual([
        expect.objectContaining(cached),
        { ...java17, valid: true, arch: 'x64' },
      ])
      expect(resolveJava).toHaveBeenCalledTimes(force ? 0 : 1)
    },
  )

  it('discovers Adoptium without an existing Java cache', async () => {
    await service.refreshLocalJava()
    expect(service.state.all).toEqual([{ ...java17, valid: true, arch: 'x64' }])
  })

  it('surfaces a version probe timeout without invalidating the cached runtime', async () => {
    const javaPath = 'C:\\xmcl\\jre\\managed-runtime\\bin\\java.exe'
    const record = { path: javaPath, version: '17', majorVersion: 17, valid: true, isInternal: true }
    service.state.javaUpdate(record)
    vi.mocked(resolveJavaWithDiagnostic).mockResolvedValueOnce({ stdout: '', stderr: '', timedOut: true })

    await expect(service.resolveJava(javaPath)).rejects.toThrow('Java version probe timed out')
    expect(service.state.all).toEqual([record])
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejects an unexpected major version before caching it', async () => {
    const javaPath = 'C:\\xmcl\\jre\\managed-runtime\\bin\\java.exe'
    vi.mocked(resolveJava).mockResolvedValueOnce({ path: javaPath, version: '21', majorVersion: 21 })

    await expect(service.resolveJava(javaPath, 17)).rejects.toThrow('Expected Java 17')
    expect(service.state.all).toEqual([])
  })

  it('flushes Java update writers without flushing unrelated writers', async () => {
    const gate = getRestoreGate(service.app)
    const javaWrite = vi.fn(async () => {})
    const unrelatedWrite = vi.fn(async () => {})
    const javaWriter = gate.writer(javaWrite, 1000, 'java-update')
    const unrelatedWriter = gate.writer(unrelatedWrite, 1000)
    javaWriter.schedule()
    unrelatedWriter.schedule()
    Object.assign(service, { initialize: vi.fn().mockResolvedValue(undefined) })

    await service.flushJavaUpdate()

    expect(javaWrite).toHaveBeenCalledOnce()
    expect(unrelatedWrite).not.toHaveBeenCalled()
    await unrelatedWriter.flush()
  })

  it('keeps replacement recovery pending if completion cannot be persisted', async () => {
    const root = '/tmp/xmcl-java-missing'
    const path = join(root, 'new', 'bin', 'java')
    Object.assign(service, { getPath: () => root, initialize: async () => {} })
    service.state.javaUpdate({
      path, version: '17', majorVersion: 17, valid: true, isInternal: true,
      replacesJava: join(root, 'old', 'bin', 'java'), replacementRuntime: join(root, 'old'),
    })
    vi.spyOn(service, 'flushJavaUpdate').mockRejectedValueOnce(new Error('disk failed'))

    await expect(service.completeJavaReplacement(path)).rejects.toThrow('disk failed')
    expect(service.state.all[0]).toMatchObject({
      replacesJava: join(root, 'old', 'bin', 'java'), replacementRuntime: join(root, 'old'),
    })
  })

  it('does not mark an unregistered Java as internal solely because of its path', async () => {
    const javaPath = 'C:\\xmcl\\jre\\managed-runtime\\bin\\java.exe'
    vi.mocked(validateJavaPath).mockResolvedValue(JavaValidation.Okay)
    vi.mocked(resolveJava).mockResolvedValue({
      path: javaPath,
      version: '21.0.5',
      majorVersion: 21,
    })

    await service.resolveJava(javaPath)

    expect(service.state.all).toContainEqual(
      expect.objectContaining({ path: javaPath, isInternal: false }),
    )
  })

  it('uses the installed runtime build for the displayed managed Java version', async () => {
    const javaPath = 'C:\\xmcl\\jre\\eclipse_temurin_jre17.0.21+2\\jdk-17.0.21+2-jre\\bin\\java.exe'
    vi.mocked(validateJavaPath).mockResolvedValue(JavaValidation.Okay)
    vi.mocked(resolveJava).mockResolvedValue({
      path: javaPath,
      version: '17.0.21.1',
      majorVersion: 17,
    })

    service.state.javaUpdate({
      path: javaPath,
      version: '17.0.21.2',
      majorVersion: 17,
      valid: true,
      isInternal: true,
      installVendor: 'net.adoptium.java',
    })

    const resolved = await service.resolveJava(javaPath)

    expect(resolved).toMatchObject({ version: '17.0.21.2', majorVersion: 17 })
    expect(service.state.all).toContainEqual(
      expect.objectContaining({ path: javaPath, version: '17.0.21.2', isInternal: true }),
    )
  })

  it('preserves installer provenance when a scan finishes after installation', async () => {
    const javaPath = 'C:\\xmcl\\jre\\managed-runtime\\bin\\java.exe'
    vi.mocked(validateJavaPath).mockResolvedValue(JavaValidation.Okay)
    vi.mocked(resolveJava).mockResolvedValue({ path: javaPath, version: '17', majorVersion: 17 })
    let finish!: (arch: 'x64') => void
    vi.mocked(getJavaArch).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const resolving = service.resolveJava(javaPath)
    await vi.waitFor(() => expect(getJavaArch).toHaveBeenCalled())
    service.state.javaUpdate({
      path: javaPath, version: '17', majorVersion: 17, valid: true,
      isInternal: true, installVendor: 'net.adoptium.java', replacesJava: 'old', replacementRuntime: 'old-root',
    })
    finish('x64')
    await resolving
    expect(service.state.all[0]).toMatchObject({
      isInternal: true, installVendor: 'net.adoptium.java', replacesJava: 'old',
    })
  })

  it('uninstalls only Java runtimes contained within the managed directory', async () => {
    const root = '/tmp/xmcl/jre'
    service = Object.assign(service, { getPath: () => root })

    await service.removeJava(join(root, 'managed-runtime', 'bin', 'java'), true)
    expect(remove).toHaveBeenCalledWith(join(root, 'managed-runtime'))

    vi.mocked(remove).mockClear()
    await service.removeJava(join(root + '-backup', 'bin', 'java'), true)
    expect(remove).not.toHaveBeenCalled()
  })

  it('refuses to uninstall a runtime used by a running game', async () => {
    const root = '/tmp/xmcl/jre'
    const java = join(root, 'managed-runtime', 'bin', 'java')
    service = Object.assign(service, { getPath: () => root })
    getGameProcesses.mockResolvedValue([{ options: { java: join(root, 'managed-runtime', 'bin', 'javaw') } }])
    await expect(service.removeJava(java, true)).rejects.toThrow('game is using it')
    expect(remove).not.toHaveBeenCalled()
  })

  it('removes every cached executable belonging to an uninstalled runtime component', async () => {
    const root = '/tmp/xmcl/jre'
    service = Object.assign(service, { getPath: () => root })
    service.state.javaUpdate([
      {
        path: join(root, 'managed-runtime', 'jdk', 'bin', 'java'),
        version: '17.0.21.2',
        majorVersion: 17,
        valid: true,
      },
      {
        path: join(root, 'managed-runtime', 'jre', 'bin', 'java'),
        version: '17.0.21.2',
        majorVersion: 17,
        valid: true,
      },
      {
        path: join(root, 'other-runtime', 'bin', 'java'),
        version: '21',
        majorVersion: 21,
        valid: true,
      },
    ])

    await service.removeJava(join(root, 'managed-runtime', 'jdk', 'bin', 'java'), true)

    expect(service.state.all.map(({ path }) => path)).toEqual([
      join(root, 'other-runtime', 'bin', 'java'),
    ])
    expect(remove).toHaveBeenCalledWith(join(root, 'managed-runtime'))
  })

  it('does not re-add a runtime when an earlier resolution completes after removal', async () => {
    const root = '/tmp/xmcl/jre'
    const path = join(root, 'old', 'bin', 'java')
    service = Object.assign(service, { getPath: () => root })
    let finish!: (value: { path: string; version: string; majorVersion: number }) => void
    vi.mocked(validateJavaPath).mockResolvedValue(JavaValidation.Okay)
    vi.mocked(resolveJava).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const resolving = service.resolveJava(path)
    await vi.waitFor(() => expect(resolveJava).toHaveBeenCalled())
    await service.removeJava(path, true)
    finish({ path, version: '17', majorVersion: 17 })
    await resolving
    expect(service.state.all).toEqual([])
  })

  it('physically removes the old runtime directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-java-removal-'))
    const javaDir = join(root, 'eclipse_temurin_jre17.0.21+2')
    const javaPath = join(javaDir, 'jdk-17.0.21.1+2-jre', 'bin', 'java')
    await mkdir(dirname(javaPath), { recursive: true })
    await writeFile(javaPath, '')
    vi.mocked(remove).mockImplementation((path) =>
      removeFromDisk(path, { recursive: true, force: true }).then(() => undefined),
    )
    service = Object.assign(service, { getPath: () => root })
    service.state.javaUpdate({
      path: javaPath,
      version: '17.0.21.2',
      majorVersion: 17,
      valid: true,
    })

    try {
      await service.removeJava(javaPath, true)
      await expect(accessFile(javaDir)).rejects.toThrow()
      expect(service.state.all).toEqual([])
    } finally {
      await removeFromDisk(root, { recursive: true, force: true })
    }
  })

  it('keeps the Java entry when uninstalling its runtime fails', async () => {
    const root = '/tmp/xmcl/jre'
    const javaPath = join(root, 'managed-runtime', 'bin', 'java')
    service = Object.assign(service, { getPath: () => root })
    service.state.javaUpdate({ path: javaPath, version: '21', majorVersion: 21, valid: true })
    vi.mocked(remove).mockRejectedValueOnce(new Error('permission denied'))

    await expect(service.removeJava(javaPath, true)).rejects.toThrow('permission denied')
    expect(service.state.all).toContainEqual(
      expect.objectContaining({ path: javaPath, valid: true }),
    )
  })

  it('waits for concurrent instance edits and refuses to delete newly referenced Java', async () => {
    const root = '/tmp/xmcl/jre'
    const old = join(root, 'old', 'bin', 'java')
    const replacement = join(root, 'new', 'bin', 'java')
    const instance = { path: '/profile', java: replacement }
    const state = {
      instances: [instance],
      instanceEdit(changes: { java: string }) { instance.java = changes.java },
    }
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    const instances = {
      getSharedInstancesState: async () => state,
      async editInstance() { await wait; state.instanceEdit({ java: old }) },
    }
    const app = service.app
    Object.assign(app.registry, {
      getOrCreate: async (key: unknown) => key === LaunchService ? { getGameProcesses } : instances,
      get: async () => ({ globalJava: replacement }),
    })
    Object.assign(service, { getPath: () => root, initialize: async () => {} })
    const gate = getJavaReferenceGate(app)
    gate.guardReferenceMutation<{ java: string }>(state, 'instanceEdit', changes => [changes.java])
    gate.guardMethods(instances, ['editInstance'])
    service.state.javaUpdate({
      path: replacement, version: '17', majorVersion: 17, valid: true, isInternal: true,
      replacesJava: old, replacementRuntime: join(root, 'old'),
    })

    const edit = instances.editInstance()
    const removal = service.removeJava(old, true, replacement)
    await vi.waitFor(() => expect(() => state.instanceEdit({ java: replacement })).toThrow('maintenance'))
    release()
    await edit
    await expect(removal).rejects.toThrow('launcher settings reference it')
    expect(remove).not.toHaveBeenCalled()
    expect(instance.java).toBe(old)
  })

  it('migrates only references that still use the old runtime', async () => {
    const root = '/tmp/xmcl/jre'
    const old = join(root, 'old', 'bin', 'java')
    const alternate = join(root, 'old', 'bin', 'javaw')
    const replacement = join(root, 'new', 'bin', 'java')
    const other = join(root, 'other', 'bin', 'java')
    const state = {
      instances: [{ path: '/first', java: old }, { path: '/second', java: alternate }, { path: '/third', java: other }],
      instanceEdit(changes: { path: string; java: string }) {
        const instance = this.instances.find(value => value.path === changes.path)
        if (instance) instance.java = changes.java
      },
    }
    const settings = { globalJava: alternate, globalMaxMemory: 4096, globalJavaSet(java: string) { this.globalJava = java } }
    const app = service.app
    Object.assign(app.registry, {
      getOrCreate: async () => ({ getSharedInstancesState: async () => state }),
      get: async () => settings,
    })
    Object.assign(service, { getPath: () => root, initialize: async () => {} })
    const gate = getJavaReferenceGate(app)
    gate.guardReferenceMutation<{ java: string }>(state, 'instanceEdit', changes => [changes.java])
    gate.guardReferenceMutation<string>(settings, 'globalJavaSet', java => [java])
    service.state.javaUpdate({
      path: old, version: '17', majorVersion: 17, valid: true,
      prependCommand: 'wrapper', vmOptions: ['-Xmx2G'],
    })
    service.state.javaUpdate({
      path: replacement, version: '17', majorVersion: 17, valid: true, isInternal: true,
      replacesJava: old, replacementRuntime: join(root, 'old'),
    })

    await service.migrateJavaReferences(replacement)
    expect(state.instances.map(instance => instance.java)).toEqual([replacement, replacement, other])
    expect(settings).toMatchObject({ globalJava: replacement, globalMaxMemory: 4096 })
    expect(service.state.all.find(java => java.path === replacement)).toMatchObject({
      prependCommand: 'wrapper', vmOptions: ['-Xmx2G'],
    })
  })

  it('preserves a reinstalled runtime and its references when recovery retries', async () => {
      const root = await mkdtemp(join(tmpdir(), 'xmcl-java-reinstalled-'))
      const oldDirectory = join(root, 'old')
      const old = join(oldDirectory, 'bin', 'java')
      const replacement = join(root, 'new', 'bin', 'java')
      const state = { instances: [{ path: '/profile', java: old }], instanceEdit: vi.fn() }
      const settings = { globalJava: old, globalJavaSet: vi.fn() }
      try {
        await mkdir(oldDirectory)
        const identity = await getOrCreateJavaRuntimeIdentity(oldDirectory)
        await removeFromDisk(oldDirectory, { recursive: true })
        await mkdir(join(oldDirectory, 'bin'), { recursive: true })
        await writeFile(old, 'reinstalled')
        Object.assign(service.app.registry, {
          getOrCreate: async (key: unknown) => key === LaunchService
            ? { getGameProcesses }
            : { getSharedInstancesState: async () => state },
          get: async () => settings,
        })
        Object.assign(service, { getPath: () => root, initialize: async () => {} })
        vi.mocked(resolveJava).mockResolvedValue({ path: replacement, version: '17', majorVersion: 17 })
        service.state.javaUpdate({
          path: replacement, version: '17', majorVersion: 17, valid: true, isInternal: true,
          replacesJava: old, replacementRuntime: oldDirectory, replacementIdentity: identity,
        })
        await expect(service.migrateJavaReferences(replacement)).resolves.toBe(false)
        expect(state.instanceEdit).not.toHaveBeenCalled()
        expect(settings.globalJavaSet).not.toHaveBeenCalled()
        state.instances[0].java = replacement
        settings.globalJava = replacement
        await expect(service.removeJava(old, true, replacement)).resolves.toBe(false)
        expect(remove).not.toHaveBeenCalled()
        expect(await readFileFromDisk(old, 'utf8')).toBe('reinstalled')
      } finally {
        await removeFromDisk(root, { recursive: true, force: true })
      }
  })

  it('refuses migration and removal when the replacement is missing', async () => {
    const root = '/tmp/xmcl/jre'
    const old = join(root, 'old', 'bin', 'java')
    const replacement = join(root, 'new', 'bin', 'java')
    const state = { instances: [{ path: '/profile', java: old }], instanceEdit: vi.fn() }
    const settings = { globalJava: old, globalJavaSet: vi.fn() }
    Object.assign(service.app.registry, {
      getOrCreate: async (key: unknown) => key === LaunchService
        ? { getGameProcesses }
        : { getSharedInstancesState: async () => state },
      get: async () => settings,
    })
    Object.assign(service, { getPath: () => root, initialize: async () => {} })
    service.state.javaUpdate({
      path: replacement, version: '17', majorVersion: 17, valid: true, isInternal: true,
      replacesJava: old, replacementRuntime: join(root, 'old'),
    })
    vi.mocked(validateJavaPath).mockResolvedValue(JavaValidation.NotExisted)

    await expect(service.migrateJavaReferences(replacement)).rejects.toThrow('missing or inaccessible')
    expect(state.instanceEdit).not.toHaveBeenCalled()
    expect(settings.globalJavaSet).not.toHaveBeenCalled()
    state.instances[0].java = replacement
    settings.globalJava = replacement
    await expect(service.removeJava(old, true, replacement)).rejects.toThrow('missing or inaccessible')
    expect(remove).not.toHaveBeenCalled()
  })

  it('refuses to recover an older pending replacement with the wrong major version', async () => {
    const root = '/tmp/xmcl/jre'
    const old = join(root, 'old', 'bin', 'java')
    const replacement = join(root, 'new', 'bin', 'java')
    const state = { instances: [{ path: '/profile', java: old }], instanceEdit: vi.fn() }
    const settings = { globalJava: old, globalJavaSet: vi.fn() }
    Object.assign(service.app.registry, {
      getOrCreate: async (key: unknown) => key === LaunchService
        ? { getGameProcesses }
        : { getSharedInstancesState: async () => state },
      get: async () => settings,
    })
    Object.assign(service, { getPath: () => root, initialize: async () => {} })
    service.state.javaUpdate([
      { path: old, version: '17', majorVersion: 17, valid: true },
      { path: replacement, version: '21', majorVersion: 21, valid: true, isInternal: true,
        replacesJava: old, replacementRuntime: join(root, 'old') },
    ])
    vi.mocked(resolveJava).mockResolvedValue({ path: replacement, version: '21', majorVersion: 21 })

    await expect(service.migrateJavaReferences(replacement)).rejects.toThrow('different major version')
    expect(state.instanceEdit).not.toHaveBeenCalled()
    expect(settings.globalJavaSet).not.toHaveBeenCalled()
    state.instances[0].java = replacement
    settings.globalJava = replacement
    await expect(service.removeJava(old, true, replacement)).rejects.toThrow('different major version')
    expect(remove).not.toHaveBeenCalled()
  })

  it('flushes reference writes while changes are blocked before deleting Java', async () => {
    const root = '/tmp/xmcl/jre'
    const old = join(root, 'old', 'bin', 'java')
    const replacement = join(root, 'new', 'bin', 'java')
    const state = { instances: [], instanceEdit: vi.fn() }
    const app = service.app
    Object.assign(app.registry, {
      getOrCreate: async (key: unknown) => key === LaunchService
        ? { getGameProcesses }
        : { getSharedInstancesState: async () => state },
      get: async () => ({ globalJava: replacement }),
    })
    Object.assign(service, { getPath: () => root, initialize: async () => {} })
    const gate = getJavaReferenceGate(app)
    gate.guardReferenceMutation<{ java: string }>(state, 'instanceEdit', changes => [changes.java])
    service.state.javaUpdate({
      path: replacement, version: '17', majorVersion: 17, valid: true, isInternal: true,
      replacesJava: old, replacementRuntime: join(root, 'old'),
    })
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    const write = vi.fn(() => wait)
    getRestoreGate(app).writer(write, 1000, 'java-update').schedule()
    const removal = service.removeJava(old, true, replacement)
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce())
    expect(remove).not.toHaveBeenCalled()
    expect(() => state.instanceEdit({ java: old })).toThrow('maintenance')
    release()
    await removal
    expect(remove).toHaveBeenCalledWith(join(root, 'old'))
  })

  it('rejects stale Java references after deletion until the old runtime is reinstalled', async () => {
    const root = '/tmp/xmcl/jre'
    const old = join(root, 'old', 'bin', 'java')
    const replacement = join(root, 'new', 'bin', 'java')
    const state = { instances: [], instanceEdit: vi.fn() }
    const app = service.app
    Object.assign(app.registry, {
      getOrCreate: async (key: unknown) => key === LaunchService
        ? { getGameProcesses }
        : { getSharedInstancesState: async () => state },
      get: async () => ({ globalJava: replacement }),
    })
    Object.assign(service, { getPath: () => root, initialize: async () => {} })
    const gate = getJavaReferenceGate(app)
    gate.guardReferenceMutation<{ java: string }>(state, 'instanceEdit', changes => [changes.java])
    service.state.javaUpdate({
      path: replacement, version: '17', majorVersion: 17, valid: true, isInternal: true,
      replacesJava: old, replacementRuntime: join(root, 'old'),
    })

    await service.removeJava(old, true, replacement)
    expect(remove).toHaveBeenCalledWith(join(root, 'old'))
    expect(() => state.instanceEdit({ java: old })).toThrow('Java runtime has been replaced')
    expect(() => state.instanceEdit({ java: replacement })).not.toThrow()
    gate.installed(old)
    expect(() => state.instanceEdit({ java: old })).not.toThrow()
  })
})
