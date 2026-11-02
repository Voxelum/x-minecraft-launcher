import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getFeedURL: vi.fn(), checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn(), openExternal: vi.fn(),
}))
vi.mock('electron', () => ({ app: {}, shell: { openExternal: mocks.openExternal } }))
vi.mock('electron-updater', () => ({
  autoUpdater: mocks,
  UpdaterSignal: class { progress() {} },
  CancellationToken: class { cancel() {} },
}))
vi.mock('~/infra', () => ({ kGFW: Symbol('gfw') }))
vi.mock('~/settings', () => ({ kSettings: Symbol('settings') }))
vi.mock('./elevate', () => ({ ensureElevateExe: vi.fn() }))
import { ElectronUpdater } from './updater'

const staleRelease = { name: '0.74.0', date: '', body: '', files: [], newUpdate: true, operation: 'autoupdater' }
function createApp(env = 'appimage') {
  return {
    env, version: '0.73.0', platform: { os: 'linux' },
    getLogger: () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    registry: { get: vi.fn<() => Promise<any>>().mockResolvedValue({ allowPrerelease: false, locale: 'en' }) },
    fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      tag_name: 'v0.74.0', body: 'notes', published_at: '', assets: [
        { name: 'app-0.74.0-linux.asar', browser_download_url: 'https://example.test/update' },
      ],
    }) }),
  }
}

describe('AppImage external update boundary', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllEnvs())
  it('retains self-managed stable-path discovery and explicit installation; blocks after mode switch', async () => {
    vi.stubEnv('APPIMAGE', '/opt/xmcl.AppImage')
    const settings = { appImageUpdateMode: 'self-managed' }
    const app = createApp()
    app.registry.get.mockResolvedValue(settings)
    mocks.checkForUpdates.mockResolvedValue({ updateInfo: { version: '0.74.0', releaseNotes: '', releaseDate: '', files: [] } })
    const updater = new ElectronUpdater(app as any)
    expect(await updater.checkUpdateTask()).toMatchObject({ operation: 'autoupdater' })
    await updater.downloadUpdate(staleRelease)
    expect(mocks.downloadUpdate).toHaveBeenCalledOnce()
    await updater.installUpdateAndQuit(staleRelease)
    expect(mocks.quitAndInstall).toHaveBeenCalledOnce()
    settings.appImageUpdateMode = 'external'
    mocks.downloadUpdate.mockClear()
    mocks.quitAndInstall.mockClear()
    await updater.downloadUpdate(staleRelease)
    await updater.installUpdateAndQuit(staleRelease)
    expect(mocks.downloadUpdate).not.toHaveBeenCalled()
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
    expect(await updater.checkUpdateTask()).toMatchObject({ operation: 'manual' })
  })
  it('keeps self-managed versioned paths manual and blocks stale Asar installation', async () => {
    vi.stubEnv('APPIMAGE', '/opt/xmcl-0.73.0.AppImage')
    const app = createApp()
    app.registry.get.mockResolvedValue({ appImageUpdateMode: 'self-managed' })
    const updater = new ElectronUpdater(app as any)
    expect(await updater.checkUpdateTask()).toMatchObject({ operation: 'manual' })
    expect(mocks.checkForUpdates).not.toHaveBeenCalled()
    vi.stubEnv('APPIMAGE', '/opt/xmcl.AppImage')
    await updater.installUpdateAndQuit({ ...staleRelease, operation: 'asar' })
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
  })
  it('discovers metadata as manual without invoking electron-updater', async () => {
    const app = createApp()
    const updater = new ElectronUpdater(app as any)
    expect(await updater.checkUpdateTask()).toMatchObject({ operation: 'manual', newUpdate: true })
    expect(app.fetch).toHaveBeenCalledOnce()
    expect(mocks.checkForUpdates).not.toHaveBeenCalled()
  })
  it('retains the Linux self-update discovery path outside AppImage', async () => {
    mocks.checkForUpdates.mockResolvedValue({ updateInfo: { version: '0.74.0', releaseNotes: '', releaseDate: '', files: [] } })
    const app = createApp('raw')
    expect(await new ElectronUpdater(app as any).checkUpdateTask()).toMatchObject({ operation: 'autoupdater' })
    expect(mocks.checkForUpdates).toHaveBeenCalledOnce()
    expect(app.fetch).not.toHaveBeenCalled()
  })
  it.each(['autoupdater', 'asar', 'manual'])('blocks download and install for cached %s releases', async (operation) => {
    const updater = new ElectronUpdater(createApp() as any)
    const release = { ...staleRelease, operation }
    await updater.downloadUpdate(release)
    await updater.installUpdateAndQuit(release)
    expect(mocks.downloadUpdate).not.toHaveBeenCalled()
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.openExternal).toHaveBeenCalledTimes(2)
  })
})
