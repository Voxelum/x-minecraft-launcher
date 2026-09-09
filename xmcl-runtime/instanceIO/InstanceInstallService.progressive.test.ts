import type { InstanceFile, InstanceInstallLock } from '@xmcl/instance'
import { LockKey, TaskState, type InstanceInstallStatus } from '@xmcl/runtime-api'
import { FSWatcher } from 'chokidar'
import { createHash } from 'crypto'
import { ensureDir, mkdtemp, pathExists, readFile, readJson, readdir, rename, rm, utimes, writeFile, writeJson } from 'fs-extra'
import { basename, dirname, join, relative, sep } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MutexManager from '~/app/MutexManager'
import { kDownloadOptions } from '~/network'
import { ServiceStateManager } from '~/service'
import { downloadInstanceFiles } from './utils/downloadInstanceFiles'
import { readPendingInstalls } from './utils/pendingInstall'

vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherApp: class LauncherApp {},
  LauncherAppKey: Symbol('LauncherAppKey'),
}))

vi.mock('~/infra', () => ({
  ZipManager: class ZipManager {},
  kTasks: Symbol('kTasks'),
}))

vi.mock('~/instance/InstanceService', () => ({
  InstanceService: class InstanceService {},
}))

vi.mock('~/instance/InstanceModsGroupService', () => ({
  InstanceModsGroupService: class InstanceModsGroupService {},
}))

vi.mock('~/peer', () => ({
  kPeerFacade: Symbol('kPeerFacade'),
}))

vi.mock('./utils/downloadInstanceFiles', () => ({
  downloadInstanceFiles: vi.fn(),
}))

vi.mock('./utils/resolveInstanceFiles', () => ({
  resolveInstanceFiles: vi.fn().mockResolvedValue(false),
}))

const { InstanceInstallService } = await import('./InstanceInstallService')
const { InstanceService } = await import('~/instance/InstanceService')

const sha1 = (content: string | Buffer) => createHash('sha1').update(content).digest('hex')
const mockedDownload = vi.mocked(downloadInstanceFiles)
type Download = Parameters<typeof downloadInstanceFiles>[0][number]

describe('InstanceInstallService progressive installation', () => {
  const roots: string[] = []
  const disposers: Array<() => void> = []

  beforeEach(() => {
    mockedDownload.mockReset()
  })

  afterEach(async () => {
    for (const dispose of disposers.splice(0)) dispose()
    vi.restoreAllMocks()
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  })

  async function fixture() {
    const root = await mkdtemp(join(process.cwd(), '.progressive-install-test-'))
    roots.push(root)
    const instancePath = join(root, 'instance')
    await ensureDir(instancePath)
    const contents = new Map<string, string>()
    const file = (path: string, content = path): InstanceFile => {
      const hash = sha1(content)
      contents.set(hash, content)
      return { path, hashes: { sha1: hash }, downloads: [`https://example.invalid/${path}`] }
    }
    const write = async (path: string, content: string) => {
      await ensureDir(dirname(path))
      await writeFile(path, content)
    }
    const materialize = async ({ file, options }: Download, finished: Set<string>) => {
      const content = contents.get(file.hashes.sha1)
      if (content === undefined) throw new Error(`Unknown fixture content: ${file.path}`)
      await write(options.destination, content)
      finished.add(file.path)
    }
    const downloadAll: typeof downloadInstanceFiles = async (downloads, finished) => {
      await Promise.all(downloads.map(download => materialize(download, finished)))
    }
    const removeHandlers = new Set<() => void | Promise<void>>()
    const instanceService = {
      state: { all: { [instancePath]: {} } },
      registerRemoveHandler: vi.fn((path: string, handler: () => void | Promise<void>) => {
        expect(path).toBe(instancePath)
        removeHandlers.add(handler)
        return () => removeHandlers.delete(handler)
      }),
    }
    const sharedStates = new Map<string, InstanceInstallStatus>()
    const stateManager = {
      registerOrGet: vi.fn(async (
        key: string,
        factory: () => Promise<[InstanceInstallStatus, () => void]>,
      ) => {
        if (sharedStates.has(key)) return sharedStates.get(key)!
        const [state, dispose] = await factory()
        sharedStates.set(key, state)
        disposers.push(dispose)
        return state
      }),
    }
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const app = {
      appDataPath: root,
      minecraftDataPath: root,
      controller: { broadcast: vi.fn() },
      getLogger: () => logger,
      platform: { os: 'windows' },
      registry: {
        getOrCreate: vi.fn(async () => ({})),
        get: vi.fn(async key => {
          if (key === kDownloadOptions) return {}
          if (key === InstanceService) return instanceService
          if (key === ServiceStateManager) return stateManager
          return undefined
        }),
        getIfPresent: vi.fn(async () => undefined),
      },
    } as any
    app.mutex = new MutexManager(app)
    const tasks = {
      create: vi.fn(task => ({
        ...task,
        id: crypto.randomUUID(),
        progress: 0,
        substate: {},
        state: TaskState.Running,
        controller: new AbortController(),
        complete: vi.fn(),
        fail: vi.fn(),
        wrap: <T>(promise: Promise<T>) => promise,
      })),
    }
    const resourceManager = {
      getSnapshotByHash: vi.fn(async () => undefined),
      getSnapshotByDomainedPath: vi.fn(async () => undefined),
      getSnapshot: vi.fn(async (file: { path: string }) => ({ sha1: sha1(await readFile(file.path)) })),
      validateSnapshotFile: vi.fn(async () => undefined),
      updateMetadata: vi.fn(async () => []),
    }
    const worker = {
      checksum: vi.fn(async (path: string, algorithm = 'sha1') => createHash(algorithm).update(await readFile(path)).digest('hex')),
    }
    const createService = () => new InstanceInstallService(
      app,
      resourceManager as any,
      tasks as any,
      worker as any,
      {} as any,
      { getProjectVersionsByHash: vi.fn(async () => ({})) } as any,
    )
    return {
      root,
      instancePath,
      file,
      write,
      materialize,
      downloadAll,
      createService,
      service: createService(),
      tasks,
      mutex: app.mutex as MutexManager,
      removeHandlers,
      instanceService,
      resourceManager,
      worker,
    }
  }

  function expectLocalProfile(instancePath: string, profile: { path: string; state: InstanceInstallLock }) {
    expect(dirname(profile.path)).toBe(join(instancePath, '.install'))
    expect(basename(profile.path)).toMatch(/^[\da-f-]+\.json$/i)
    expect(relative(instancePath, profile.state.workspace).split(sep)[0]).toBe('.install')
    expect(profile.state.oldFiles).toBeDefined()
  }

  it('publishes a ready mod and its lock while another download is still running, and serializes resume', async () => {
    const f = await fixture()
    const ready = f.file('mods/ready.jar')
    const slow = f.file('mods/slow.jar')
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const status = await f.service.watchInstanceInstall(f.instancePath)
    mockedDownload.mockImplementationOnce(async (downloads, finished) => {
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      started.resolve()
      await release.promise
      throw new Error('slow download failed')
    }).mockImplementation(f.downloadAll)
    const installing = f.service.installInstanceFiles({
      path: f.instancePath, upstream: { type: 'peer', id: 'streaming-pack' }, files: [ready, slow],
    })
    const rejected = expect(installing).rejects.toThrow('slow download failed')
    let resuming: Promise<unknown> | undefined
    try {
      await started.promise
      await vi.waitFor(async () => {
        expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
        expect((await readJson(join(f.instancePath, 'instance-lock.json'))).files).toEqual([ready])
        expect(status.pendingFileCount).toBe(1)
      }, { timeout: 3000 })
      expect(f.tasks.create).toHaveBeenCalledTimes(1)
      resuming = f.service.resumeInstanceInstall(f.instancePath)
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(f.tasks.create).toHaveBeenCalledTimes(1)
    } finally {
      release.resolve()
      await rejected
      await resuming
    }
    expect(mockedDownload.mock.calls[1][0].map(download => download.file.path)).toEqual([slow.path])
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
    expect(status.pendingFileCount).toBe(0)
    expect((await readJson(join(f.instancePath, 'instance-lock.json'))).files).toEqual([ready, slow])
  })

  it('persists legacy baseline removals across failure and a fresh-service resume', async () => {
    const f = await fixture()
    const obsolete = f.file('mods/obsolete.jar')
    const ready = f.file('mods/ready.jar')
    const missing = f.file('mods/missing.jar')
    const upstream = { type: 'modrinth-modpack' as const, projectId: 'pack', versionId: 'old' }
    await f.write(join(f.instancePath, obsolete.path), obsolete.path)
    vi.spyOn(f.service, 'getLegacyLock').mockResolvedValue({ version: 1, upstream, files: [obsolete] })
    mockedDownload.mockImplementationOnce(async (downloads, finished) => {
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      throw new Error('legacy partial failure')
    }).mockImplementation(f.downloadAll)
    await expect(f.service.installInstanceFiles({
      path: f.instancePath, upstream: { ...upstream, versionId: 'new' }, files: [ready, missing],
    })).rejects.toThrow('legacy partial failure')
    const [profile] = await readPendingInstalls(f.instancePath)
    expect(profile.state.baseline?.files).toEqual([obsolete])
    expect((await readJson(join(f.instancePath, 'instance-lock.json'))).files).toEqual([obsolete, ready])

    const restarted = f.createService()
    const legacyLookup = vi.spyOn(restarted, 'getLegacyLock')
    await restarted.resumeInstanceInstall(f.instancePath)
    expect(legacyLookup).not.toHaveBeenCalled()
    expect(await pathExists(join(f.instancePath, obsolete.path))).toBe(false)
    expect((await readJson(join(f.instancePath, 'instance-lock.json'))).files).toEqual([ready, missing])
  })

  it('does not let a batch of unchanged staged files starve newly downloaded files', async () => {
    const f = await fixture()
    const kept = Array.from({ length: 256 }, (_, i) => f.file(`config/kept-${i}.txt`))
    for (const file of kept) await f.write(join(f.instancePath, file.path), file.path)
    const ready = f.file('mods/ready.jar')
    const slow = f.file('mods/slow.jar')
    const release = Promise.withResolvers<void>()
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      await release.promise
      await f.materialize(downloads.find(download => download.file.path === slow.path)!, finished)
    })
    const installing = f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [...kept, ready, slow],
    })
    try {
      await vi.waitFor(async () => {
        expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
        const [profile] = await readPendingInstalls(f.instancePath)
        expect(profile.state.committedPath).toHaveLength(257)
      }, { timeout: 10_000 })
    } finally {
      release.resolve()
      await installing
    }
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
  }, 10_000)

  it('does not resurrect an older project version when unrelated pending files resume', async () => {
    const f = await fixture()
    const old = { ...f.file('mods/old.jar'), modrinth: { projectId: 'project', versionId: 'old' } }
    const next = { ...f.file('mods/new.jar'), modrinth: { projectId: 'project', versionId: 'new' } }
    const unrelated = f.file('config/unrelated.txt')
    mockedDownload.mockImplementationOnce(async (downloads, finished) => {
      await f.materialize(downloads.find(download => download.file.path === old.path)!, finished)
      throw new Error('unrelated unavailable')
    }).mockImplementation(f.downloadAll)
    await expect(f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [old, unrelated],
    })).rejects.toThrow('unrelated unavailable')
    await f.service.installInstanceFiles({ path: f.instancePath, oldFiles: [], files: [next] })
    expect(await pathExists(join(f.instancePath, old.path))).toBe(false)
    expect(await readFile(join(f.instancePath, next.path), 'utf8')).toBe(next.path)
    const [pending] = await readPendingInstalls(f.instancePath)
    expect(pending.state.supersededPaths).toContain(old.path)
    await f.createService().resumeInstanceInstall(f.instancePath)
    expect(mockedDownload.mock.calls[2][0].map(download => download.file.path)).toEqual([unrelated.path])
    expect(await pathExists(join(f.instancePath, old.path))).toBe(false)
    expect(await readFile(join(f.instancePath, next.path), 'utf8')).toBe(next.path)
    expect(await pathExists(join(f.instancePath, '.install'))).toBe(false)
  })

  it('does not let an older deferred removal delete a newer selection', async () => {
    const f = await fixture()
    const old = f.file('mods/shared.jar', 'old')
    const next = f.file(old.path, 'new')
    const missing = f.file('config/missing.txt')
    await f.write(join(f.instancePath, old.path), 'old')
    mockedDownload.mockRejectedValueOnce(new Error('failed')).mockImplementation(f.downloadAll)
    await expect(f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [old], files: [missing],
    })).rejects.toThrow('failed')
    await f.service.installInstanceFiles({ path: f.instancePath, oldFiles: [], files: [next] })
    await f.createService().resumeInstanceInstall(f.instancePath)
    expect(await readFile(join(f.instancePath, next.path), 'utf8')).toBe('new')
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
  })

  it('aborts superseded active work and waits for its late writer without publishing it', async () => {
    const f = await fixture()
    const old = { ...f.file('mods/old.jar'), curseforge: { projectId: 1, fileId: 1 } }
    const next = { ...f.file('mods/new.jar'), curseforge: { projectId: 1, fileId: 2 } }
    const started = Promise.withResolvers<void>()
    mockedDownload.mockImplementationOnce(async (downloads, finished, signal) => {
      const aborted = new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
      started.resolve()
      await aborted
      await f.materialize(downloads[0], finished)
      signal.throwIfAborted()
    }).mockImplementation(f.downloadAll)
    const installing = f.service.installInstanceFiles({ path: f.instancePath, oldFiles: [], files: [old] })
    const rejected = expect(installing).rejects.toMatchObject({ name: 'AbortError' })
    await started.promise
    await f.service.installInstanceFiles({ path: f.instancePath, oldFiles: [], files: [next] })
    await rejected
    expect(await pathExists(join(f.instancePath, old.path))).toBe(false)
    expect(await readFile(join(f.instancePath, next.path), 'utf8')).toBe(next.path)
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
    expect(await pathExists(join(f.instancePath, '.install'))).toBe(false)
  })

  it('replays interrupted ownership registration before completing the newer upstream plan', async () => {
    const f = await fixture()
    const old = f.file('mods/old.jar')
    const next = f.file('mods/new.jar')
    const upstream = { type: 'peer' as const, id: 'pack' }
    mockedDownload.mockRejectedValue(new Error('offline'))
    await expect(f.service.installInstanceFiles({
      path: f.instancePath, upstream, files: [old],
    })).rejects.toThrow('offline')
    const [older] = await readPendingInstalls(f.instancePath)
    await expect(f.service.installInstanceFiles({
      path: f.instancePath, upstream, files: [next],
    })).rejects.toThrow('offline')
    // Simulate a durable newer plan whose older-profile rewrite was interrupted.
    await ensureDir(older.state.workspace)
    await writeJson(older.path, older.state)
    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)
    await f.createService().resumeInstanceInstall(f.instancePath)
    expect(mockedDownload.mock.calls.flatMap(([downloads]) => downloads.map(download => download.file.path))).toEqual([next.path])
    expect(await pathExists(join(f.instancePath, old.path))).toBe(false)
    expect((await readJson(join(f.instancePath, 'instance-lock.json'))).files).toEqual([next])
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
  })

  it.each(['sha256', 'sha512'])('replaces same-size incorrect content using a declared %s hash', async (algorithm) => {
    const f = await fixture()
    const next: InstanceFile = {
      path: 'mods/same-size.jar',
      size: 3,
      hashes: { [algorithm]: createHash(algorithm).update('BBB').digest('hex') },
      downloads: ['https://example.invalid/strong.jar'],
    }
    await f.write(join(f.instancePath, next.path), 'AAA')
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await f.write(downloads[0].options.destination, 'BBB')
      finished.add(next.path)
    })
    await f.service.installInstanceFiles({ path: f.instancePath, oldFiles: [], files: [next] })
    expect(await readFile(join(f.instancePath, next.path), 'utf8')).toBe('BBB')
    expect(f.worker.checksum).toHaveBeenCalledWith(join(f.instancePath, next.path), algorithm)
  })

  it('publishes ready files on failure and a fresh service downloads only the missing file on resume', async () => {
    const f = await fixture()
    const ready = f.file('mods/ready.jar')
    const missing = f.file('mods/missing.jar')
    const failure = new Error('missing download failed')
    mockedDownload.mockImplementation(async (downloads, finished) => {
      expect(downloads.map(download => download.file.path).sort()).toEqual([missing.path, ready.path])
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      throw failure
    })

    await expect(f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [ready, missing],
    })).rejects.toBe(failure)

    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
    expect(await pathExists(join(f.instancePath, missing.path))).toBe(false)
    const profiles = await readPendingInstalls(f.instancePath)
    expect(profiles).toHaveLength(1)
    expectLocalProfile(f.instancePath, profiles[0])
    expect(profiles[0].state.files).toEqual([ready, missing])
    expect(profiles[0].state.committedPath).toEqual([ready.path])
    expect(profiles[0].state.finishedPath).not.toContain(ready.path)
    expect(await pathExists(join(profiles[0].state.workspace, ready.path))).toBe(false)
    expect(await pathExists(join(f.instancePath, '.install-profile'))).toBe(false)
    expect(await pathExists(join(f.instancePath, 'instance-lock.json'))).toBe(false)
    expect(await readdir(f.root)).toEqual(['instance'])
    expect(f.tasks.create.mock.results[0].value.complete).not.toHaveBeenCalled()
    expect(f.tasks.create.mock.results[0].value.fail).toHaveBeenCalledWith(failure)
    expect(failure).toMatchObject({ installInstance: { instancePath: f.instancePath } })

    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)
    const restarted = f.createService()
    expect(restarted).not.toBe(f.service)
    await restarted.resumeInstanceInstall(f.instancePath)

    expect(mockedDownload).toHaveBeenCalledTimes(1)
    expect(mockedDownload.mock.calls[0][0].map(download => download.file.path)).toEqual([missing.path])
    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
    expect(await readFile(join(f.instancePath, missing.path), 'utf8')).toBe(missing.path)
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
    expect(await pathExists(profiles[0].path)).toBe(false)
    expect(await pathExists(profiles[0].state.workspace)).toBe(false)
    expect(await pathExists(join(f.instancePath, 'instance-lock.json'))).toBe(false)
  })

  it('attaches retained-instance metadata to every nested aggregate error leaf', async () => {
    const f = await fixture()
    const ready = f.file('mods/ready.jar')
    const firstMissing = f.file('config/first.txt')
    const secondMissing = f.file('config/second.txt')
    const firstError = Object.assign(new Error('first unavailable'), { name: 'DownloadError' })
    const secondError = Object.assign(new Error('second unavailable'), { name: 'RequestError' })
    const nested = new AggregateError([secondError], 'nested downloads')
    const failure = new AggregateError([firstError, nested], 'downloads failed')
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      throw failure
    })

    await expect(f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [ready, firstMissing, secondMissing],
    })).rejects.toBe(failure)

    for (const error of [failure, nested, firstError, secondError]) {
      expect(error).toMatchObject({ installInstance: { instancePath: f.instancePath } })
    }
    expect(firstError.name).toBe('DownloadError')
    expect(secondError.name).toBe('RequestError')
    expect(f.tasks.create.mock.results[0].value.fail).toHaveBeenCalledWith(failure)
    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
    expect((await readPendingInstalls(f.instancePath))[0].state.committedPath).toEqual([ready.path])
  })

  it('updates watched pending counts from preparing to partial failure to completed retry', async () => {
    const f = await fixture()
    const ready = f.file('mods/ready.jar')
    const missing = f.file('config/missing.txt')
    const status = await f.service.watchInstanceInstall(f.instancePath)
    expect(status.pendingFileCount).toBe(0)
    const started = Promise.withResolvers<void>()
    const releaseDownloads = Promise.withResolvers<void>()
    mockedDownload.mockImplementation(async (downloads, finished) => {
      started.resolve()
      await releaseDownloads.promise
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      throw new Error('watched download failed')
    })
    const installing = f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [ready, missing],
    })
    const rejected = expect(installing).rejects.toThrow('watched download failed')
    try {
      await started.promise
      await vi.waitFor(() => expect(status.pendingFileCount).toBe(2))
    } finally {
      releaseDownloads.resolve()
      await rejected
    }
    await vi.waitFor(() => expect(status.pendingFileCount).toBe(1))
    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)

    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)
    await f.service.resumeInstanceInstall(f.instancePath)

    expect(mockedDownload.mock.calls.flatMap(([downloads]) => downloads.map(download => download.file.path))).toEqual([missing.path])
    expect(await pathExists(join(f.instancePath, '.install'))).toBe(false)
    await vi.waitFor(() => expect(status.pendingFileCount).toBe(0))
  })

  it('refreshes watched pending counts when the whole staging root is removed and recreated', async () => {
    const f = await fixture()
    const missing = f.file('config/missing.txt')
    mockedDownload.mockRejectedValue(new Error('download failed'))
    await expect(f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [missing],
    })).rejects.toThrow('download failed')
    const [profile] = await readPendingInstalls(f.instancePath)
    const emitted = vi.spyOn(FSWatcher.prototype, 'emit')
    const status = await f.service.watchInstanceInstall(f.instancePath)
    expect(status.pendingFileCount).toBe(1)
    await vi.waitFor(() => expect(emitted).toHaveBeenCalledWith('ready'))

    await rm(join(f.instancePath, '.install'), { recursive: true })
    await vi.waitFor(() => expect(status.pendingFileCount).toBe(0))

    await ensureDir(dirname(profile.path))
    await writeJson(profile.path, profile.state)
    await vi.waitFor(() => expect(status.pendingFileCount).toBe(1))

    await rm(join(f.instancePath, '.install'), { recursive: true })
    await vi.waitFor(() => expect(status.pendingFileCount).toBe(0))
  })

  it('records only published upstream files and defers removals without advancing the old mtime on failure', async () => {
    const f = await fixture()
    const obsolete = f.file('mods/obsolete.jar')
    const edited = f.file('config/edited.txt', 'original settings')
    const ready = f.file('mods/ready.jar')
    const missing = f.file('mods/missing.jar')
    const upstream = { type: 'peer' as const, id: 'upstream-pack' }
    const oldMtime = Date.now() - 60_000
    await f.write(join(f.instancePath, obsolete.path), obsolete.path)
    await f.write(join(f.instancePath, edited.path), 'user settings')
    await utimes(join(f.instancePath, obsolete.path), (oldMtime - 10_000) / 1000, (oldMtime - 10_000) / 1000)
    await utimes(join(f.instancePath, edited.path), (oldMtime + 10_000) / 1000, (oldMtime + 10_000) / 1000)
    const lockPath = join(f.instancePath, 'instance-lock.json')
    await writeJson(lockPath, { version: 1, upstream, files: [obsolete, edited], mtime: oldMtime })
    const failure = new Error('one upstream download failed')
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      throw failure
    })

    await expect(f.service.installInstanceFiles({
      path: f.instancePath, upstream, files: [ready, missing],
    })).rejects.toBe(failure)

    const partialLock = await readJson(lockPath)
    expect(partialLock.files).toEqual([obsolete, edited, ready])
    expect(partialLock.mtime).toBe(oldMtime)
    expect(partialLock.upstream).toEqual(upstream)
    expect(await readFile(join(f.instancePath, obsolete.path), 'utf8')).toBe(obsolete.path)
    expect(await readFile(join(f.instancePath, edited.path), 'utf8')).toBe('user settings')
    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
    expect(await pathExists(join(f.instancePath, missing.path))).toBe(false)
    const [profile] = await readPendingInstalls(f.instancePath)
    expect(dirname(profile.path)).toBe(join(f.instancePath, '.install'))
    expect(profile.state.oldFiles).toBeUndefined()
    expect(profile.state.committedPath).toEqual([ready.path])
    expect(relative(f.instancePath, profile.state.workspace).split(sep)[0]).toBe('.install')
    expect(await pathExists(join(profile.state.backup, edited.path))).toBe(false)

    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)
    const beforeResume = Date.now()
    await f.createService().resumeInstanceInstall(f.instancePath)

    expect(mockedDownload).toHaveBeenCalledTimes(1)
    expect(mockedDownload.mock.calls[0][0].map(download => download.file.path)).toEqual([missing.path])
    expect(await pathExists(join(f.instancePath, obsolete.path))).toBe(false)
    expect(await pathExists(join(f.instancePath, edited.path))).toBe(false)
    expect(await readFile(join(profile.state.backup, edited.path), 'utf8')).toBe('user settings')
    expect(await pathExists(join(profile.state.backup, obsolete.path))).toBe(false)
    const completedLock = await readJson(lockPath)
    expect(completedLock.files).toEqual([ready, missing])
    expect(completedLock.mtime).toBeGreaterThanOrEqual(beforeResume)
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
  })

  it('does not mark a staged file committed when publishing fails and reuses it on resume', async () => {
    const f = await fixture()
    const ready = f.file('mods/ready.jar')
    const blocked = f.file('mods/blocked.jar')
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await Promise.all(downloads.map(download => f.materialize(download, finished)))
      // A directory created after preparation prevents renaming this file.
      await ensureDir(join(f.instancePath, blocked.path))
    })

    await expect(f.service.installInstanceFiles({
      path: f.instancePath, upstream: { type: 'peer', id: 'upstream-pack' }, files: [ready, blocked],
    })).rejects.toBeInstanceOf(Error)

    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
    const profiles = await readPendingInstalls(f.instancePath)
    expect(profiles).toHaveLength(1)
    expect(profiles[0].state.committedPath).toEqual([ready.path])
    expect(profiles[0].state.finishedPath).toEqual([blocked.path])
    expect(await readFile(join(profiles[0].state.workspace, blocked.path), 'utf8')).toBe(blocked.path)
    expect((await readJson(join(f.instancePath, 'instance-lock.json'))).files).toEqual([ready])

    await rm(join(f.instancePath, blocked.path), { recursive: true })
    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)
    await f.createService().resumeInstanceInstall(f.instancePath)

    expect(mockedDownload).not.toHaveBeenCalled()
    expect(await readFile(join(f.instancePath, blocked.path), 'utf8')).toBe(blocked.path)
    expect((await readJson(join(f.instancePath, 'instance-lock.json'))).files).toEqual([ready, blocked])
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
  })

  it('publishes completed downloads when cancelled and retains a recoverable pending profile', async () => {
    const f = await fixture()
    const ready = f.file('mods/ready.jar')
    const missing = f.file('mods/missing.jar')
    const prepared = Promise.withResolvers<void>()
    mockedDownload.mockImplementation(async (downloads, finished, signal) => {
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      const aborted = new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
      prepared.resolve()
      await aborted
      signal.throwIfAborted()
    })
    const installing = f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [ready, missing],
    })
    const rejected = expect(installing).rejects.toMatchObject({ name: 'AbortError' })
    await prepared.promise
    const task = f.tasks.create.mock.results[0].value
    task.controller.abort()
    await rejected

    expect(task.complete).not.toHaveBeenCalled()
    expect(task.fail).toHaveBeenCalled()
    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
    expect(await pathExists(join(f.instancePath, missing.path))).toBe(false)
    const profiles = await readPendingInstalls(f.instancePath)
    expect(profiles).toHaveLength(1)
    expectLocalProfile(f.instancePath, profiles[0])
    expect(profiles[0].state.committedPath).toEqual([ready.path])

    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)
    await f.createService().resumeInstanceInstall(f.instancePath)
    expect(mockedDownload.mock.calls.flatMap(([downloads]) => downloads.map(download => download.file.path))).toEqual([missing.path])
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
  })

  it('managed removal waits for outside-lock writers and no install writer resurrects the root', async () => {
    const f = await fixture()
    const file = f.file('mods/late.jar')
    const started = Promise.withResolvers<void>()
    const releaseWriter = Promise.withResolvers<void>()
    const removalEntered = Promise.withResolvers<void>()
    const events: string[] = []
    let downloadSignal: AbortSignal | undefined
    mockedDownload.mockImplementation(async (downloads, finished, signal) => {
      downloadSignal = signal
      started.resolve()
      // Model IO already in flight when abort arrives: it still has to settle.
      await releaseWriter.promise
      await f.materialize(downloads[0], finished)
      events.push('writer settled')
      signal.throwIfAborted()
    })
    const installing = f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [file],
    }).then(() => ({ error: undefined }), error => ({ error }))
    await started.promise
    const instanceLock = f.mutex.of(LockKey.instance(f.instancePath))
    expect(instanceLock.isLocked()).toBe(false)
    let handlerResults: Array<void | Promise<void>> = []
    // Match InstanceService.deleteInstance: cancel waiters, signal handlers,
    // then await their writers while holding the same instance mutex as commit.
    const removing = f.mutex.of(LockKey.instanceRemove(f.instancePath)).runExclusive(async () => {
      instanceLock.cancel()
      handlerResults = [...f.removeHandlers].map(handler => handler())
      await instanceLock.runExclusive(async () => {
        removalEntered.resolve()
        await Promise.allSettled(handlerResults)
        events.push('remove root')
        await rm(f.instancePath, { recursive: true, force: true })
      })
    })
    try {
      await removalEntered.promise
      expect(downloadSignal?.aborted).toBe(true)
      expect(handlerResults).toHaveLength(1)
      expect(handlerResults[0]).toBeInstanceOf(Promise)
      expect(events).toEqual([])
      expect(await pathExists(f.instancePath)).toBe(true)
    } finally {
      releaseWriter.resolve()
      await removing
      await installing
    }
    const outcome = await installing
    expect(outcome.error).toMatchObject({ name: 'AbortError' })
    expect(events).toEqual(['writer settled', 'remove root'])
    expect(await pathExists(f.instancePath)).toBe(false)
    expect(await readdir(f.root)).toEqual([])
    expect(f.removeHandlers.size).toBe(0)
  })

  it('does not deadlock deletion while initialization is still waiting for the instance mutex', async () => {
    const f = await fixture()
    let installing: Promise<unknown> | undefined
    try {
      await f.mutex.of(LockKey.instance(f.instancePath)).runExclusive(async () => {
        installing = f.service.installInstanceFiles({
          path: f.instancePath, oldFiles: [], files: [f.file('mods/queued.jar')],
        }).catch(error => error)
        await vi.waitFor(() => expect(f.removeHandlers.size).toBe(1))
        let settled = false
        const removing = Promise.all([...f.removeHandlers].map(handler => handler())).then(() => { settled = true })
        await vi.waitFor(() => expect(settled).toBe(true), { timeout: 500 })
        await removing
        await rm(f.instancePath, { recursive: true })
      })
    } finally {
      expect(await installing).toMatchObject({ name: 'AbortError' })
    }
    expect(mockedDownload).not.toHaveBeenCalled()
    expect(await pathExists(f.instancePath)).toBe(false)
  })

  it('keeps separate profiles for concurrent failed diffs and resumes both missing files', async () => {
    const f = await fixture()
    const first = [f.file('mods/first-ready.jar'), f.file('mods/first-missing.jar')]
    const second = [f.file('mods/second-ready.jar'), f.file('mods/second-missing.jar')]
    const releaseDownloads = Promise.withResolvers<void>()
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await releaseDownloads.promise
      await f.materialize(downloads.find(download => download.file.path.endsWith('-ready.jar'))!, finished)
      throw new Error('missing concurrent download')
    })
    const installs = [first, second].map(files => f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files,
    }))
    const settled = Promise.allSettled(installs)
    try {
      await vi.waitFor(() => expect(mockedDownload).toHaveBeenCalledTimes(2))
    } finally {
      releaseDownloads.resolve()
      await settled
    }
    expect((await settled).map(result => result.status)).toEqual(['rejected', 'rejected'])
    const profiles = await readPendingInstalls(f.instancePath)
    expect(profiles).toHaveLength(2)
    expect(new Set(profiles.map(profile => profile.path)).size).toBe(2)
    expect(new Set(profiles.map(profile => profile.state.workspace)).size).toBe(2)
    for (const profile of profiles) {
      expectLocalProfile(f.instancePath, profile)
      const files = profile.state.files
      expect([first, second]).toContainEqual(files)
      expect(profile.state.committedPath).toEqual([files[0].path])
      expect(await readFile(join(f.instancePath, files[0].path), 'utf8')).toBe(files[0].path)
      expect(await pathExists(join(f.instancePath, files[1].path))).toBe(false)
    }

    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)
    await f.createService().resumeInstanceInstall(f.instancePath)

    expect(mockedDownload).toHaveBeenCalledTimes(2)
    expect(mockedDownload.mock.calls.flatMap(([downloads]) => downloads.map(download => download.file.path)).sort())
      .toEqual([first[1].path, second[1].path])
    for (const file of [...first, ...second]) {
      expect(await readFile(join(f.instancePath, file.path), 'utf8')).toBe(file.path)
    }
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
    expect(await pathExists(join(f.instancePath, '.install-profile'))).toBe(false)
    expect(await pathExists(join(f.instancePath, 'instance-lock.json'))).toBe(false)
  })

  it.each(['local diff', 'legacy peer profile'])('never rewrites the upstream lock when recovering a %s', async (layout) => {
    const f = await fixture()
    const managed = f.file('mods/managed.jar')
    const ready = f.file('mods/local-ready.jar')
    const missing = f.file('mods/local-missing.jar')
    await f.write(join(f.instancePath, managed.path), managed.path)
    const lockPath = join(f.instancePath, 'instance-lock.json')
    await writeJson(lockPath, {
      version: 1, upstream: { type: 'peer', id: 'real-upstream' }, files: [managed], mtime: 123456789,
    })
    const originalLock = await readFile(lockPath, 'utf8')
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      throw new Error('local download failed')
    })
    await expect(f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [ready, missing],
    })).rejects.toThrow('local download failed')
    const [profile] = await readPendingInstalls(f.instancePath)
    expectLocalProfile(f.instancePath, profile)
    expect(await readFile(lockPath, 'utf8')).toBe(originalLock)
    if (layout === 'legacy peer profile') {
      delete profile.state.oldFiles
      await writeJson(profile.path, profile.state)
      await rename(profile.path, join(f.instancePath, '.install-profile'))
    }
    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)

    await f.createService().resumeInstanceInstall(f.instancePath)

    expect(mockedDownload.mock.calls.flatMap(([downloads]) => downloads.map(download => download.file.path))).toEqual([missing.path])
    expect(await readFile(lockPath, 'utf8')).toBe(originalLock)
    expect(await readFile(join(f.instancePath, managed.path), 'utf8')).toBe(managed.path)
    expect(await readFile(join(f.instancePath, missing.path), 'utf8')).toBe(missing.path)
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
  })

  it('finishes deferred removals on resume when every target file was already committed', async () => {
    const f = await fixture()
    const obsolete = f.file('mods/obsolete.jar')
    const ready = f.file('mods/ready.jar')
    await f.write(join(f.instancePath, obsolete.path), obsolete.path)
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await Promise.all(downloads.map(download => f.materialize(download, finished)))
      throw new Error('batch failed after its last completed file')
    })
    await expect(f.service.installInstanceFiles({
      path: f.instancePath, oldFiles: [obsolete], files: [ready],
    })).rejects.toThrow('batch failed after its last completed file')
    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
    expect(await pathExists(join(f.instancePath, obsolete.path))).toBe(true)
    const profiles = await readPendingInstalls(f.instancePath)
    expect(profiles).toHaveLength(1)
    expect(profiles[0].state.committedPath).toEqual([ready.path])
    const status = await f.service.watchInstanceInstall(f.instancePath)
    expect(status.pendingFileCount).toBe(1)

    mockedDownload.mockClear()
    mockedDownload.mockImplementation(f.downloadAll)
    await f.service.resumeInstanceInstall(f.instancePath)

    expect(mockedDownload).not.toHaveBeenCalled()
    expect(await pathExists(join(f.instancePath, obsolete.path))).toBe(false)
    expect(await readFile(join(f.instancePath, ready.path), 'utf8')).toBe(ready.path)
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
    await vi.waitFor(() => expect(status.pendingFileCount).toBe(0))
  })

  it.each([false, true])('reconciles a staged manifest after retry without removing a newer revision (%s)', async (newerRevision) => {
    const f = await fixture()
    const ready = f.file('mods/ready.jar')
    const missing = f.file('mods/missing.jar')
    const manifest = await f.service.stageInstanceFiles({
      path: f.instancePath, oldFiles: [], files: [ready, missing],
    })
    mockedDownload.mockImplementation(async (downloads, finished) => {
      await f.materialize(downloads.find(download => download.file.path === ready.path)!, finished)
      throw new Error('manifest download failed')
    })
    await expect(f.service.applyInstanceInstallManifest(f.instancePath)).rejects.toThrow('manifest download failed')
    expect(await f.service.getInstanceInstallManifest(f.instancePath)).toEqual(manifest)
    if (newerRevision) {
      await writeJson(join(f.instancePath, '.install-manifest'), {
        ...manifest,
        updatedAt: manifest.updatedAt + 1,
        files: [f.file('mods/future.jar')],
      })
    }
    mockedDownload.mockImplementation(f.downloadAll)
    await f.createService().resumeInstanceInstall(f.instancePath)
    expect(await readPendingInstalls(f.instancePath)).toEqual([])
    const remaining = await f.service.getInstanceInstallManifest(f.instancePath)
    if (newerRevision) expect(remaining?.files.map(file => file.path)).toEqual(['mods/future.jar'])
    else expect(remaining).toBeUndefined()
  })
})
