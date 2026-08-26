import { mkdtemp, pathExists, readJson, rm, writeFile } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('~/app', () => ({
  Inject: () => () => { },
  LauncherApp: class { },
  LauncherAppKey: Symbol('LauncherAppKey'),
}))

const { LocalSkinService } = await import('./LocalSkinService')

describe('LocalSkinService', () => {
  let appDataPath: string
  let service: InstanceType<typeof LocalSkinService>

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
    }
    service = new LocalSkinService(app as any)
  })

  afterEach(async () => {
    await rm(appDataPath, { recursive: true, force: true })
  })

  test('owns imported files and preserves remote URLs', async () => {
    const source = join(appDataPath, 'source.png')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    await writeFile(source, png)

    const local = await service.addSkin({ name: 'Local', source, slim: false })
    const localPath = new URL(local.url).searchParams.get('path')!
    const remote = await service.addSkin({ name: 'Remote', source: 'https://example.com/skin.png', slim: true })

    expect(localPath).toBe(join(appDataPath, 'closet', `${local.id}.png`))
    await expect(pathExists(localPath)).resolves.toBe(true)
    expect(remote.url).toBe('https://example.com/skin.png')
    expect(await readJson(join(appDataPath, 'closet', 'index.json'))).toMatchObject({
      skins: [{ id: remote.id }, { id: local.id }],
    })

    await service.removeSkin(local.id)
    await expect(pathExists(localPath)).resolves.toBe(false)
    expect((await service.getState()).skins).toEqual([remote])
  })

  test('persists equipped skins independently for each account profile', async () => {
    const first = await service.addSkin({ name: 'First', source: 'https://example.com/first.png', slim: false })
    const second = await service.addSkin({ name: 'Second', source: 'https://example.com/second.png', slim: true })

    await service.setEquippedSkin('user-a:profile-a', first.id)
    await service.setEquippedSkin('user-b:profile-b', second.id)

    const restored = new LocalSkinService(service.app)
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
})