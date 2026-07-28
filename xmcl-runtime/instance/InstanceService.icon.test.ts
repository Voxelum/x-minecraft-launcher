import { Instance } from '@xmcl/instance'
import { InstanceState } from '@xmcl/runtime-api'
import { ensureDir, mkdtemp, pathExists, rm, writeFile } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('~/app', () => ({
  Inject: () => () => { },
  LauncherAppKey: Symbol('LauncherAppKey'),
  PathResolver: class { },
  kGameDataPath: Symbol('kGameDataPath'),
}))

vi.mock('~/infra', () => ({
  ImageStorage: class { },
  Tasks: class { },
  kTasks: Symbol('kTasks'),
}))

vi.mock('~/install', () => ({
  VersionMetadataService: class { },
}))

const { InstanceService } = await import('./InstanceService')

function createInstance(path: string): Instance {
  return {
    name: 'Test',
    author: '',
    description: '',
    version: '',
    edition: 'java',
    runtime: {
      minecraft: '1.20.1',
      forge: '',
      fabricLoader: '',
      optifine: '',
      quiltLoader: '',
      neoForged: '',
      labyMod: '',
    },
    icon: '',
    url: '',
    fileApi: '',
    playtime: 0,
    lastPlayedDate: 0,
    creationDate: Date.now(),
    lastAccessDate: Date.now(),
    path,
  }
}

describe('InstanceService icon storage', () => {
  let appDataPath: string
  let instancePath: string

  beforeEach(async () => {
    appDataPath = await mkdtemp(join(tmpdir(), 'xmcl-instance-icon-'))
    instancePath = join(appDataPath, 'instances', 'test')
    await ensureDir(instancePath)
  })

  afterEach(async () => {
    await rm(appDataPath, { recursive: true, force: true })
  })

  function createService(state: InstanceState, fetch = vi.fn()) {
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const app = {
      appDataPath,
      minecraftDataPath: appDataPath,
      getLogger: () => logger,
      controller: { broadcast: vi.fn() },
      mutex: { of: vi.fn() },
      fetch,
    }
    const store = { registerStatic: () => state }
    return new InstanceService(
      app as any,
      store as any,
      {} as any,
      (...paths: string[]) => join(appDataPath, ...paths),
      {} as any,
      {} as any,
    )
  }

  test('copies a shared launcher image into the instance folder when setting the icon', async () => {
    const imageHash = '0123456789abcdef0123456789abcdef01234567'
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    await ensureDir(join(appDataPath, 'resource-images'))
    await writeFile(join(appDataPath, 'resource-images', imageHash), png)

    const state = new InstanceState() as InstanceState & { subscribe: ReturnType<typeof vi.fn> }
    state.subscribe = vi.fn()
    state.instanceAdd(createInstance(instancePath))
    const service = createService(state)

    await service.editInstance({
      instancePath,
      icon: `http://launcher/image/${imageHash}`,
    })

    expect(state.all[instancePath].icon).toBe(`http://launcher/media?path=${join(instancePath, 'icon.png')}`)
    expect(await pathExists(join(instancePath, 'icon.png'))).toBe(true)
  })

  test('downloads a remote image into the instance folder when setting the icon URL', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const state = new InstanceState() as InstanceState & { subscribe: ReturnType<typeof vi.fn> }
    state.subscribe = vi.fn()
    state.instanceAdd(createInstance(instancePath))
    const fetch = vi.fn().mockResolvedValue(new Response(png, {
      headers: { 'content-type': 'image/png' },
    }))
    const service = createService(state, fetch)

    await service.editInstance({
      instancePath,
      icon: 'https://example.com/icon.png',
    })

    expect(fetch).toHaveBeenCalledWith('https://example.com/icon.png')
    expect(state.all[instancePath].icon).toBe(`http://launcher/media?path=${join(instancePath, 'icon.png')}`)
    expect(await pathExists(join(instancePath, 'icon.png'))).toBe(true)
  })
})