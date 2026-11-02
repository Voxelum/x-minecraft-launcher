import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import * as path from 'path'
import { applyAutoUpdateSettings, isExternallyUpdatedAppImage } from './appImageUpdatePolicy'

describe('AppImage update ownership', () => {
  it.each([
    ['/opt/xmcl.AppImage', false],
    ['/opt/0.73.0/xmcl.AppImage', false],
    ['/opt/xmcl-0.73.0-x86_64.AppImage', true],
    ['xmcl.AppImage', true],
    ['', true],
  ])('self-managed path %s requires external update=%s', (path, external) => {
    expect(isExternallyUpdatedAppImage('appimage', 'self-managed', path)).toBe(external)
    expect(isExternallyUpdatedAppImage('appimage', 'external', path)).toBe(true)
  })
  it.each([true, false])('blocks both automatic actions even with saved settings=%s', (enabled) => {
    const updater = { autoDownload: true, autoInstallOnAppQuit: true, allowPrerelease: false }
    applyAutoUpdateSettings(updater, { autoDownload: enabled, autoInstallOnAppQuit: enabled, allowPrerelease: true }, 'appimage')
    expect(updater).toEqual({ autoDownload: false, autoInstallOnAppQuit: false, allowPrerelease: true })
  })

  it.each(['raw', 'appx', 'dmg'])('preserves independent self-update preferences for %s', (env) => {
    const updater = { autoDownload: true, autoInstallOnAppQuit: true, allowPrerelease: false }
    applyAutoUpdateSettings(updater, { autoDownload: false, autoInstallOnAppQuit: true, allowPrerelease: false }, env)
    expect(updater).toEqual({ autoDownload: false, autoInstallOnAppQuit: true, allowPrerelease: false })
  })
})

// Exercise the installed, lockfile-pinned updater's real path-selection code.
// All filesystem/process effects are fakes: no AppImages or user files touched.
describe('electron-updater AppImage path compatibility', () => {
  it.each([
    ['/opt/xmcl.AppImage', '/opt/xmcl.AppImage'],
    ['/opt/xmcl-0.73.0.AppImage', '/opt/xmcl-0.74.0.AppImage'],
  ])('installed updater maps %s to %s', (oldPath, destination) => {
    const require = createRequire(import.meta.url)
    const source = readFileSync(require.resolve('electron-updater/out/AppImageUpdater.js'), 'utf8')
    const unlink = vi.fn()
    const exec = vi.fn()
    const dependencies: Record<string, unknown> = {
      path,
      fs: { unlinkSync: unlink },
      'child_process': { execFileSync: exec },
      'fs-extra': {},
      'builder-util-runtime': { newError: (message: string) => new Error(message) },
      './BaseUpdater': { BaseUpdater: class {} },
      './differentialDownloader/FileWithEmbeddedBlockMapDifferentialDownloader': {},
      './types': {},
      './providers/Provider': {},
    }
    const exports: any = {}
    new Function('require', 'exports', 'process', source)((name: string) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`)
      return dependencies[name]
    }, exports, { env: { APPIMAGE: oldPath } })
    const updater = new exports.AppImageUpdater()
    updater.installerPath = '/cache/xmcl-0.74.0.AppImage'
    updater.emit = vi.fn()
    updater.spawnLog = vi.fn()
    expect(updater.doInstall({ isForceRunAfter: true })).toBe(true)
    expect(unlink).toHaveBeenCalledWith(oldPath)
    expect(exec).toHaveBeenCalledWith('mv', ['-f', '/cache/xmcl-0.74.0.AppImage', destination])
    expect(isExternallyUpdatedAppImage('appimage', 'self-managed', oldPath)).toBe(destination !== oldPath)
  })
})
