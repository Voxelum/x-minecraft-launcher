import { describe, expect, it, vi } from 'vitest'
const autoUpdater = vi.hoisted(() => ({ autoDownload: true, autoInstallOnAppQuit: true }))
vi.mock('electron-updater', () => ({ autoUpdater }))
import { pluginAutoUpdate } from './pluginAutoUpdate'

describe('Vardrynn automatic update isolation', () => {
  it.each(['raw', 'appimage', 'appx'])('ignores persisted update opt-ins for %s', async (env) => {
    autoUpdater.autoDownload = autoUpdater.autoInstallOnAppQuit = true
    const state = { autoDownload: true, autoInstallOnAppQuit: true, appImageUpdateMode: 'self-managed' }
    const listeners: Array<(value: typeof state) => void> = []
    await pluginAutoUpdate({ env, registry: { get: async () => ({
      ...state, subscribe: (_: string, fn: (value: typeof state) => void) => listeners.push(fn),
    }) } } as any, {} as any)
    for (const listener of listeners) listener(state)
    expect(autoUpdater.autoDownload).toBe(false)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false)
  })
})
