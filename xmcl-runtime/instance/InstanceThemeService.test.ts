import { ThemeData } from '@xmcl/runtime-api'
import { ensureDir, mkdtemp, pathExists, readJson, rm, writeFile } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('~/app', () => ({
  Inject: () => () => { },
  LauncherApp: class { },
  LauncherAppKey: Symbol('LauncherAppKey'),
  PathResolver: class { },
  kGameDataPath: Symbol('kGameDataPath'),
}))

vi.mock('~/service', () => ({
  AbstractService: class {
    protected getAppDataPath: (...args: string[]) => string

    constructor(readonly app: any) {
      this.getAppDataPath = (...args) => join(app.appDataPath, ...args)
    }
  },
  ExposeServiceKey: () => () => { },
}))

const { InstanceThemeService } = await import('./InstanceThemeService')

describe('InstanceThemeService', () => {
  let appDataPath: string
  let instancePath: string

  beforeEach(async () => {
    appDataPath = await mkdtemp(join(tmpdir(), 'xmcl-instance-theme-'))
    instancePath = join(appDataPath, 'instance')
    await ensureDir(instancePath)
  })

  afterEach(async () => {
    await rm(appDataPath, { recursive: true, force: true })
  })

  test('copies shared launcher images into the instance theme folder before saving', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const imageHash = '0123456789abcdef0123456789abcdef01234567'
    await ensureDir(join(appDataPath, 'theme-media'))
    await ensureDir(join(appDataPath, 'resource-images'))
    await writeFile(join(appDataPath, 'theme-media', 'background.png'), png)
    await writeFile(join(appDataPath, 'resource-images', imageHash), png)

    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const app = {
      appDataPath,
      getLogger: () => logger,
      controller: { broadcast: vi.fn() },
    }
    const service = new InstanceThemeService(app as any, () => '')
    const theme: ThemeData = {
      ui: 'keystone',
      version: 1,
      assets: {
        backgroundImage: {
          url: 'http://launcher/theme-media/background.png',
          type: 'image',
          mimeType: 'image/png',
        },
        backgroundImageDark: {
          url: `http://launcher/image/${imageHash}`,
          type: 'image',
          mimeType: 'image/png',
        },
        backgroundMusic: [{
          url: 'https://example.com/music.mp3',
          type: 'audio',
          mimeType: 'audio/mpeg',
        }],
      },
    }

    await service.setInstanceTheme(instancePath, theme)

    const saved = await readJson(join(instancePath, 'theme.json')) as ThemeData
    expect((saved.assets.backgroundImage as any).url).toBe(
      `http://launcher/instance-theme-media/background.png?instancePath=${encodeURIComponent(instancePath)}`,
    )
    expect((saved.assets.backgroundImageDark as any).url).toBe(
      `http://launcher/instance-theme-media/${imageHash}?instancePath=${encodeURIComponent(instancePath)}`,
    )
    expect((saved.assets.backgroundMusic as any[])[0].url).toBe('https://example.com/music.mp3')
    expect(await pathExists(join(instancePath, 'theme', 'background.png'))).toBe(true)
    expect(await pathExists(join(instancePath, 'theme', imageHash))).toBe(true)
  })
})