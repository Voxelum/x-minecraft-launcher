import { execFileSync, spawn } from 'child_process'
import { EventEmitter } from 'events'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installInPlace, MAC_SWAP_SCRIPT, macAppBundle, type InstallerHost } from './updateInstaller'

let dir: string
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'vardrynn-install-')) })
afterEach(() => rm(dir, { recursive: true, force: true }))

function host(overrides: Partial<InstallerHost> = {}): InstallerHost {
  return {
    platform: 'darwin', packaged: true, execPath: '/Applications/Vardrynn.app/Contents/MacOS/Vardrynn', pid: 4242,
    logPath: join(dir, 'update.log'), spawn: vi.fn(() => ({ unref: vi.fn() })) as any,
    writable: async () => true, executable: async () => true, ...overrides,
  }
}

describe('macAppBundle', () => {
  it('finds the bundle that holds the executable', () => {
    expect(macAppBundle('/Applications/Vardrynn.app/Contents/MacOS/Vardrynn')).toBe('/Applications/Vardrynn.app')
    expect(macAppBundle('/usr/local/bin/node')).toBeUndefined()
  })
})

describe('installInPlace', () => {
  it('never replaces an unpackaged development app', async () => {
    const h = host({ packaged: false })
    expect(await installInPlace(h, '/x/v.dmg')).toBeUndefined()
    expect(h.spawn).not.toHaveBeenCalled()
  })

  it('starts a detached swap helper on macOS and asks to quit', async () => {
    const h = host()
    expect(await installInPlace(h, '/staged/vardrynn-1.2.0-arm64.dmg')).toBe('quit')
    const [cmd, args, opts] = (h.spawn as any).mock.calls[0]
    expect(cmd).toBe('/bin/sh')
    expect(args.slice(2)).toEqual(['vardrynn-update', '4242', '/staged/vardrynn-1.2.0-arm64.dmg', '/Applications/Vardrynn.app'])
    expect(opts.detached).toBe(true)
  })

  it('falls back to opening the package when the bundle cannot be replaced', async () => {
    const translocated = '/private/var/folders/x/AppTranslocation/ABC/d/Vardrynn.app/Contents/MacOS/Vardrynn'
    for (const h of [host({ writable: async () => false }), host({ execPath: translocated }), host({ execPath: '/opt/node' })]) {
      expect(await installInPlace(h, '/x/v.dmg')).toBeUndefined()
      expect(h.spawn).not.toHaveBeenCalled()
    }
    expect(await installInPlace(host(), '/x/v.zip')).toBeUndefined()
  })

  const exiting = (code: number) => vi.fn(() => {
    const child = new EventEmitter()
    setTimeout(() => child.emit('exit', code))
    return child
  }) as any

  it('installs a deb through pkexec on Linux and asks to relaunch', async () => {
    const h = host({ platform: 'linux', spawn: exiting(0) })
    expect(await installInPlace(h, '/staged/vardrynn_1.2.0_amd64.deb')).toBe('relaunch')
    expect((h.spawn as any).mock.calls[0].slice(0, 2)).toEqual(['/usr/bin/pkexec', ['/usr/bin/dpkg', '-i', '/staged/vardrynn_1.2.0_amd64.deb']])
  })

  it('reports a refused or failed Linux install and keeps running', async () => {
    await expect(installInPlace(host({ platform: 'linux', spawn: exiting(126) }), '/x/v.deb')).rejects.toThrow('not authorized')
    await expect(installInPlace(host({ platform: 'linux', spawn: exiting(1) }), '/x/v.deb')).rejects.toThrow('code 1')
    expect(await installInPlace(host({ platform: 'linux', executable: async () => false }), '/x/v.deb')).toBeUndefined()
    expect(await installInPlace(host({ platform: 'win32' }), '/x/v.exe')).toBeUndefined()
  })
})

// Runs the real helper against dmgs made with hdiutil. `open` is stubbed so nothing launches.
describe.runIf(process.platform === 'darwin')('macOS swap helper', () => {
  async function app(root: string, id: string, marker: string) {
    const bundle = join(root, 'Vardrynn.app')
    await mkdir(join(bundle, 'Contents', 'MacOS'), { recursive: true })
    await writeFile(join(bundle, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string></dict></plist>`)
    await writeFile(join(bundle, 'Contents', 'MacOS', 'marker'), marker)
    return bundle
  }
  async function dmg(id: string, marker: string) {
    const src = join(dir, `src-${marker}`)
    await app(src, id, marker)
    const out = join(dir, `${marker}.dmg`)
    execFileSync('hdiutil', ['create', '-quiet', '-fs', 'HFS+', '-srcfolder', src, '-volname', 'Vardrynn', out])
    return out
  }
  async function run(image: string, bundle: string) {
    const bin = join(dir, 'bin')
    await mkdir(bin, { recursive: true })
    await writeFile(join(bin, 'open'), `#!/bin/sh\necho "$@" >> "${join(dir, 'opened')}"\n`, { mode: 0o755 })
    const child = spawn('/bin/sh', ['-c', MAC_SWAP_SCRIPT, 'vardrynn-update', '999999', image, bundle], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    })
    const code = await new Promise((resolve) => child.on('exit', resolve))
    return { code, opened: (await readFile(join(dir, 'opened'), 'utf8')).trim() }
  }

  it('replaces the bundle and reopens it', async () => {
    const bundle = await app(join(dir, 'Applications'), 'com.vardrynn.launcher', 'old')
    const { code, opened } = await run(await dmg('com.vardrynn.launcher', 'new'), bundle)
    expect(code).toBe(0)
    expect(opened).toBe(bundle)
    expect(await readFile(join(bundle, 'Contents', 'MacOS', 'marker'), 'utf8')).toBe('new')
    expect(await readdir(join(dir, 'Applications'))).toEqual(['Vardrynn.app'])
  }, 60_000)

  it('keeps and reopens the old bundle when the package is for another app', async () => {
    const bundle = await app(join(dir, 'Applications'), 'com.vardrynn.launcher', 'old')
    const { code, opened } = await run(await dmg('com.example.other', 'evil'), bundle)
    expect(code).toBe(1)
    expect(opened).toBe(bundle)
    expect(await readFile(join(bundle, 'Contents', 'MacOS', 'marker'), 'utf8')).toBe('old')
    expect(await readdir(join(dir, 'Applications'))).toEqual(['Vardrynn.app'])
  }, 60_000)
})
