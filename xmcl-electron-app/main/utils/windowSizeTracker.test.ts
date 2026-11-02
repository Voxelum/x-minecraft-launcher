import { EventEmitter } from 'events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { LauncherApp } from '~/app'
import type { InstalledAppManifest } from '@xmcl/runtime-api'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFileSync: vi.fn(),
  getAllDisplays: vi.fn(),
}))
vi.mock('electron', () => ({ screen: { getAllDisplays: mocks.getAllDisplays } }))
vi.mock('fs-extra', () => ({ readFile: mocks.readFile, writeFileSync: mocks.writeFileSync }))
import { createWindowTracker } from './windowSizeTracker'

class Window extends EventEmitter {
  bounds = { x: -1800, y: -900, width: 1000, height: 600 }
  minimized = false
  maximized = false
  fullScreen = false
  destroyed = false
  isDestroyed() { return this.destroyed }
  isMinimized() { return this.minimized }
  isMaximized() { return this.maximized }
  isFullScreen() { return this.fullScreen }
  getNormalBounds() { return this.bounds }
}

const man = { url: 'https://launcher.test' } as InstalledAppManifest
function tracker() {
  return createWindowTracker({
    appDataPath: '/settings',
    builtinAppManifest: man,
    launcherAppManager: { getAppRoot: () => '/apps/test' },
  } as unknown as LauncherApp, 'app-manager', man)
}
function saved() {
  return JSON.parse(mocks.writeFileSync.mock.lastCall![1])
}

describe('window state persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.readFile.mockResolvedValue('{}')
    mocks.getAllDisplays.mockReturnValue([
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      { bounds: { x: -1920, y: -1080, width: 1920, height: 1080 } },
    ])
  })
  afterEach(() => vi.useRealTimers())

  it('round-trips exact size and negative multi-monitor coordinates', async () => {
    const first = tracker()
    await first.getConfig()
    const win = new Window()
    first.track(win as unknown as BrowserWindow)
    win.emit('move')
    win.emit('resize')
    expect(mocks.writeFileSync).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(saved()).toEqual({ ...win.bounds, maximized: false })
    mocks.readFile.mockResolvedValue(JSON.stringify(saved()))
    const restored = await tracker().getConfig()
    expect(restored).toMatchObject(win.bounds)
    expect(restored.getWidth(1200, 800)).toBe(1000)
    expect(restored.getHeight(720, 400)).toBe(600)
  })

  it('preserves the requested maximized restore state through pre-ready geometry events', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify({ x: 10, y: 20, width: 1200, height: 720, maximized: true }))
    const t = tracker()
    const config = await t.getConfig()
    const win = new Window()
    t.track(win as unknown as BrowserWindow)
    // ElectronController reads this same object in ready-to-show, after track().
    win.emit('resize')
    win.emit('move')
    expect(config.maximized).toBe(true)
    win.maximized = config.maximized
    win.emit('maximize')
    win.emit('close')
    expect(saved().maximized).toBe(true)
  })

  it('restores a window spanning adjacent displays but not a desktop gap', async () => {
    const bounds = { x: -500, y: 100, width: 1000, height: 600 }
    mocks.readFile.mockResolvedValue(JSON.stringify(bounds))
    mocks.getAllDisplays.mockReturnValue([
      { bounds: { x: -1920, y: 0, width: 1920, height: 1080 } },
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ])
    expect(await tracker().getConfig()).toMatchObject(bounds)
    mocks.getAllDisplays.mockReturnValue([
      { bounds: { x: -1920, y: 0, width: 1900, height: 1080 } },
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ])
    expect((await tracker().getConfig()).x).toBeUndefined()
  })

  it('saves final normal bounds on immediate close without a move event', async () => {
    const t = tracker()
    await t.getConfig()
    const win = new Window()
    t.track(win as unknown as BrowserWindow)
    win.emit('move')
    win.bounds = { x: 10, y: 20, width: 1200, height: 720 }
    win.emit('close')
    expect(saved()).toEqual({ ...win.bounds, maximized: false })
    win.destroyed = true
    win.emit('closed')
    vi.runAllTimers()
    expect(mocks.writeFileSync).toHaveBeenCalledTimes(1)
    expect(win.listenerCount('resize')).toBe(0)
    expect(win.listenerCount('maximize')).toBe(0)
    expect(win.listenerCount('close')).toBe(0)
  })

  it('keeps normal bounds while maximized and does not replace them on minimize', async () => {
    const t = tracker()
    await t.getConfig()
    const win = new Window()
    t.track(win as unknown as BrowserWindow)
    win.maximized = true
    win.emit('maximize')
    win.minimized = true
    win.maximized = false
    win.bounds = { x: -32000, y: -32000, width: 160, height: 28 }
    win.emit('minimize')
    win.emit('resize')
    win.emit('move')
    win.emit('close')
    expect(saved()).toEqual({ x: -1800, y: -900, width: 1000, height: 600, maximized: true })
    mocks.readFile.mockResolvedValue(JSON.stringify(saved()))
    expect(await tracker().getConfig()).toMatchObject(saved())
  })

  it('persists unmaximize and ignores fullscreen geometry', async () => {
    const t = tracker()
    await t.getConfig()
    const win = new Window()
    t.track(win as unknown as BrowserWindow)
    win.maximized = true
    win.emit('maximize')
    win.maximized = false
    win.emit('unmaximize')
    win.fullScreen = true
    win.bounds = { x: 0, y: 0, width: 1920, height: 1080 }
    win.emit('resize')
    win.emit('close')
    expect(saved()).toEqual({ x: -1800, y: -900, width: 1000, height: 600, maximized: false })
  })

  it.each([
    { x: -32000, y: -32000, width: 1000, height: 600 },
    { x: 4000, y: 0, width: 1000, height: 600 },
    { x: 0, y: null, width: 1000, height: 600 },
    { x: 0, y: 0, width: -1, height: 600 },
  ])('discards unavailable or incomplete bounds %j', async (bounds) => {
    mocks.readFile.mockResolvedValue(JSON.stringify(bounds))
    const config = await tracker().getConfig()
    expect(config.x).toBeUndefined()
    expect(config.y).toBeUndefined()
  })

  it.each(['null', 'not json', '{"width":1e999,"height":-10,"x":1e999,"y":0}'])('handles invalid configuration %s', async (data) => {
    mocks.readFile.mockResolvedValue(data)
    const config = await tracker().getConfig()
    expect(config.getWidth(1200, 800)).toBe(1200)
    expect(config.getHeight(720, 400)).toBe(720)
    expect(config.x).toBeUndefined()
    expect(config.y).toBeUndefined()
  })

  it('reports save errors without throwing from close', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.writeFileSync.mockImplementationOnce(() => { throw new Error('read only') })
    const t = tracker()
    await t.getConfig()
    const win = new Window()
    t.track(win as unknown as BrowserWindow)
    expect(() => win.emit('close')).not.toThrow()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
