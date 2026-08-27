import type { InstanceFile } from '@xmcl/instance'
import { TaskState } from '@xmcl/runtime-api'
import { ensureDir, mkdtemp, pathExists, readFile, rm, writeFile } from 'fs-extra'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MutexManager from '~/app/MutexManager'
import { kDownloadOptions } from '~/network'
import { downloadInstanceFiles } from './utils/downloadInstanceFiles'

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

describe('InstanceInstallService concurrent diff installs', () => {
  const roots: string[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  })

  it('prepares downloads concurrently and serializes the final commits', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-concurrent-mod-install-'))
    roots.push(root)
    const instancePath = join(root, 'instance')
    await ensureDir(instancePath)

    let releaseDownloads!: () => void
    const downloadsReleased = new Promise<void>((resolve) => {
      releaseDownloads = resolve
    })
    const mockedDownload = vi.mocked(downloadInstanceFiles)
    mockedDownload.mockImplementation(async (options, finished) => {
      await downloadsReleased
      await Promise.all(options.map(async ({ options: download, file }) => {
        await ensureDir(dirname(download.destination))
        await writeFile(download.destination, file.hashes.sha1)
        finished.add(file.path)
      }))
    })

    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const instanceService = { registerRemoveHandler: vi.fn(() => vi.fn()) }
    const app = {
      appDataPath: root,
      minecraftDataPath: root,
      controller: { broadcast: vi.fn() },
      getLogger: () => logger,
      platform: { os: 'windows' },
      registry: {
        getOrCreate: vi.fn(async () => ({})),
        get: vi.fn(async (key) => key === kDownloadOptions ? {} : key === InstanceService ? instanceService : undefined),
        getIfPresent: vi.fn(async () => undefined),
      },
    } as any
    app.mutex = new MutexManager(app)

    const tasks = {
      create: vi.fn((task) => ({
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
      getSnapshot: vi.fn(async (file: { path: string }) => ({
        sha1: await readFile(file.path, 'utf8'),
      })),
      validateSnapshotFile: vi.fn(async () => undefined),
      updateMetadata: vi.fn(async () => []),
    }
    const worker = {
      checksum: vi.fn(async (path: string) => readFile(path, 'utf8')),
    }
    const service = new InstanceInstallService(
      app,
      resourceManager as any,
      tasks as any,
      worker as any,
      {} as any,
      {} as any,
    )

    const install = (file: InstanceFile) => service.installInstanceFiles({
      path: instancePath,
      oldFiles: [],
      files: [file],
    })
    const first = install({
      path: 'mods/first.jar',
      hashes: { sha1: 'first' },
      downloads: ['https://example.com/first.jar'],
    })
    const second = install({
      path: 'mods/second.jar',
      hashes: { sha1: 'second' },
      downloads: ['https://example.com/second.jar'],
    })

    try {
      await vi.waitFor(() => expect(mockedDownload).toHaveBeenCalledTimes(2))
    } finally {
      releaseDownloads()
    }
    await Promise.all([first, second])

    expect(await pathExists(join(instancePath, 'mods', 'first.jar'))).toBe(true)
    expect(await pathExists(join(instancePath, 'mods', 'second.jar'))).toBe(true)

    await Promise.all([
      install({
        path: 'mods/shared.jar',
        hashes: { sha1: 'first-version' },
        downloads: ['https://example.com/shared-first.jar'],
      }),
      install({
        path: 'mods/shared.jar',
        hashes: { sha1: 'second-version' },
        downloads: ['https://example.com/shared-second.jar'],
      }),
    ])

    expect(['first-version', 'second-version']).toContain(
      await readFile(join(instancePath, 'mods', 'shared.jar'), 'utf8'),
    )
  })
})