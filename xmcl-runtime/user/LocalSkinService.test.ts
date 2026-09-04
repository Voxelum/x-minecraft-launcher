import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import { ensureDir, mkdtemp, pathExists, readJson, rm, writeFile, writeJson } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('~/app', () => ({
  Inject: () => () => { },
  InjectionKey: Symbol,
  LauncherApp: class { },
  LauncherAppKey: Symbol('LauncherAppKey'),
}))

const { LocalSkinService } = await import('./LocalSkinService')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

describe('LocalSkinService', () => {
  let appDataPath: string
  let service: InstanceType<typeof LocalSkinService>
  let yggdrasilRegistry: { getYggdrasilServices: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    appDataPath = await mkdtemp(join(tmpdir(), 'xmcl-local-skin-'))
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const app = {
      appDataPath,
      getLogger: () => logger,
      controller: { broadcast: vi.fn() },
      mutex: {
        of: () => ({ runExclusive: async <T>(task: () => Promise<T>) => task() }),
      },
      fetch: vi.fn(async () => new Response(png, {
        headers: { 'content-type': 'image/png' },
      })),
    }
    yggdrasilRegistry = {
      getYggdrasilServices: vi.fn(() => [{ url: 'https://auth.example/api/yggdrasil' }]),
    }
    service = new LocalSkinService(app as any, yggdrasilRegistry as any)
  })

  afterEach(async () => {
    await rm(appDataPath, { recursive: true, force: true })
  })

  test('owns imported files and downloads remote skins', async () => {
    const source = join(appDataPath, 'source.png')
    await writeFile(source, png)

    const local = await service.addSkin({ name: 'Local', source, slim: false })
    const localPath = new URL(local.url).searchParams.get('path')!
    const remote = await service.addSkin({ name: 'Remote', source: 'https://example.com/skin.png', slim: true })
    const remotePath = new URL(remote.url).searchParams.get('path')!

    expect(localPath).toBe(join(appDataPath, 'closet', `${local.id}.png`))
    await expect(pathExists(localPath)).resolves.toBe(true)
    expect(remotePath).toBe(join(appDataPath, 'closet', `${remote.id}.png`))
    await expect(pathExists(remotePath)).resolves.toBe(true)
    expect(remote.source).toBe('https://example.com/skin.png')
    expect(service.app.fetch).toHaveBeenCalledWith('https://example.com/skin.png')
    expect(await readJson(join(appDataPath, 'closet', 'index.json'))).toMatchObject({
      skins: [{ id: remote.id, url: remote.url }, { id: local.id, url: local.url }],
    })

    await service.removeSkin(local.id)
    await expect(pathExists(localPath)).resolves.toBe(false)
    expect((await service.getState()).skins).toEqual([remote])
  })

  test('migrates legacy remote skins into the closet', async () => {
    const closetPath = join(appDataPath, 'closet')
    await ensureDir(closetPath)
    await writeJson(join(closetPath, 'index.json'), {
      skins: [{
        id: 'legacy',
        name: 'Legacy',
        url: 'https://example.com/legacy.png',
        slim: false,
        dateAdded: 1,
      }],
      equippedSkinIds: {},
    })

    const state = await service.getState()
    const [migrated] = state.skins
    const migratedPath = new URL(migrated.url).searchParams.get('path')!
    expect(migrated.source).toBe('https://example.com/legacy.png')
    expect(migratedPath).toBe(join(closetPath, 'legacy.png'))
    await expect(pathExists(migratedPath)).resolves.toBe(true)
    await expect(readJson(join(closetPath, 'index.json'))).resolves.toMatchObject({
      skins: [{ id: 'legacy', source: 'https://example.com/legacy.png', url: migrated.url }],
    })
  })

  test('persists equipped skins independently for each account profile', async () => {
    const first = await service.addSkin({ name: 'First', source: 'https://example.com/first.png', slim: false })
    const second = await service.addSkin({ name: 'Second', source: 'https://example.com/second.png', slim: true })

    await service.setEquippedSkin('user-a:profile-a', first.id)
    await service.setEquippedSkin('user-b:profile-b', second.id)

    const restored = new LocalSkinService(service.app, yggdrasilRegistry as any)
    expect(await restored.getState()).toEqual({
      skins: [second, first],
      equippedSkinIds: {
        'user-a:profile-a': first.id,
        'user-b:profile-b': second.id,
      },
    })

    await restored.removeSkin(first.id)
    expect((await restored.getState()).equippedSkinIds).toEqual({
      'user-b:profile-b': second.id,
    })
  })

  test('resolves a player skin from a third-party yggdrasil authority', async () => {
    const textures = Buffer.from(JSON.stringify({
      textures: {
        SKIN: { url: 'https://textures.example/skin.png', metadata: { model: 'slim' } },
      },
    })).toString('base64')
    service.app.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'player-id', name: 'Steve' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'player-id',
        name: 'Steve',
        properties: [{ name: 'textures', value: textures }],
      })))

    await expect(service.resolveSkin('https://auth.example/api/yggdrasil', 'Steve')).resolves.toEqual({
      url: 'https://textures.example/skin.png',
      slim: true,
    })
    expect(service.app.fetch).toHaveBeenNthCalledWith(1, new URL('https://auth.example/api/yggdrasil/api/profiles/minecraft'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(['Steve']),
    })
    expect(service.app.fetch).toHaveBeenNthCalledWith(2, new URL('https://auth.example/api/yggdrasil/sessionserver/session/minecraft/profile/player-id?unsigned=true'))
  })

  test('resolves a player skin from Mojang by default', async () => {
    const textures = Buffer.from(JSON.stringify({
      textures: { SKIN: { url: 'https://textures.minecraft.net/skin.png' } },
    })).toString('base64')
    service.app.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'player-id', name: 'Alex' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'player-id',
        name: 'Alex',
        properties: [{ name: 'textures', value: textures }],
      })))

    await expect(service.resolveSkin(AUTHORITY_MICROSOFT, 'Alex')).resolves.toEqual({
      url: 'https://textures.minecraft.net/skin.png',
      slim: false,
    })
    expect(service.app.fetch).toHaveBeenNthCalledWith(1, 'https://api.mojang.com/users/profiles/minecraft/Alex')
    expect(service.app.fetch).toHaveBeenNthCalledWith(2, new URL('https://sessionserver.mojang.com/session/minecraft/profile/player-id?unsigned=true'))
  })

  test('rejects an unregistered yggdrasil authority', async () => {
    await expect(service.resolveSkin('https://unknown.example/yggdrasil', 'Steve')).rejects.toThrow('Unknown Yggdrasil authority')
  })
})