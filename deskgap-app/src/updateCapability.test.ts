import { describe, expect, it, vi } from 'vitest'
import { getDeskGapUpdateCapability } from './updateCapability'
import { ManualDeskGapUpdater, UnsupportedUpdateError } from './updater'

const native = vi.hoisted(() => ({
  fromName: vi.fn(() => { throw new Error('Unexpected network access') }),
  getPath: vi.fn(() => { throw new Error('Unexpected path access') }),
  executable: new Proxy({}, { get() { throw new Error('Unexpected Windows API access') } }),
}))
vi.mock('deskgap', () => ({
  app: { getPath: native.getPath }, session: { fromName: native.fromName }, windowsExecutable: native.executable,
}))
vi.mock('@xmcl/runtime/app', () => ({ BaseService: class {} }))
vi.mock('@xmcl/runtime/settings', () => ({ kSettings: Symbol('settings') }))
vi.mock('@xmcl/file-transfer', () => ({ download: vi.fn(), getDownloadBaseOptions: vi.fn() }))
vi.mock('@xmcl/installer', () => ({ onDownloadSingle: vi.fn() }))

import { createDeskGapUpdater, pluginDeskGapUpdate } from './updaterHost'
import type { LauncherApp } from '@xmcl/runtime/app'
import type { AppManifest } from '@xmcl/runtime-api'

describe('DeskGap platform capabilities', () => {
  it.each(['darwin', 'linux', 'win32'] as const)('keeps %s arm64 manual', platform => {
    expect(getDeskGapUpdateCapability(platform, 'arm64')).toBe('manual')
  })
  it('only enables the existing Windows x64 adapter', () => {
    expect(getDeskGapUpdateCapability('win32', 'x64')).toBe('windows-exe')
    expect(getDeskGapUpdateCapability('darwin', 'x64')).toBe('manual')
    expect(getDeskGapUpdateCapability('linux', 'x64')).toBe('manual')
    expect(getDeskGapUpdateCapability('win32', 'ia32')).toBe('manual')
  })
  it('rejects checks and installs explicitly rather than reporting no/new update', async () => {
    const updater = new ManualDeskGapUpdater('0.66.2', 'darwin', 'arm64')
    expect(updater.capability).toEqual({ automatic: false, reason: 'not-implemented' })
    await expect(updater.checkUpdateTask()).rejects.toBeInstanceOf(UnsupportedUpdateError)
    await expect(updater.checkUpdateTask()).rejects.toThrow('No release check was performed')
    await expect(updater.downloadUpdate()).rejects.toThrow('not implemented')
    await expect(updater.installUpdateAndQuit()).rejects.toThrow('not implemented')
  })
  it('production Mac never accesses Windows APIs, network, paths, settings or auto-download', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    const arch = vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64')
    try {
      const launcher = { version: '0.66.2' } as LauncherApp
      Object.assign(launcher, { updater: createDeskGapUpdater(launcher) })
      expect(launcher.updater).toBeInstanceOf(ManualDeskGapUpdater)
      await expect(launcher.updater.checkUpdateTask()).rejects.toBeInstanceOf(UnsupportedUpdateError)
      await pluginDeskGapUpdate(launcher, {} as AppManifest)
      expect(native.fromName).not.toHaveBeenCalled()
      expect(native.getPath).not.toHaveBeenCalled()
    } finally {
      platform.mockRestore()
      arch.mockRestore()
      vi.unstubAllEnvs()
    }
  })
})
