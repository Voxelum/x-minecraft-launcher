import { generateKeyPairSync, sign, createHash } from 'crypto'
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseSignaturePayload } from '~/app/vardrynnRelease'
import { ElectronUpdater, type UpdaterOptions } from './updater'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const rawPublic = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
const PACKAGE = Buffer.from('vardrynn package bytes')
const SHA = createHash('sha256').update(PACKAGE).digest('hex')

function asset(version = '1.2.0', overrides: Record<string, string> = {}) {
  const base = { platform: 'darwin', arch: 'arm64', url: 'https://downloads.example.com/vardrynn-1.2.0-arm64.dmg', sha256: SHA, ...overrides }
  return { ...base, signature: sign(null, releaseSignaturePayload(version, base), privateKey).toString('base64') }
}
const manifest = (assets: unknown[], version = '1.2.0') => ({
  apiVersion: 'v1', version, channel: 'stable', publishedAt: '2026-11-04T00:00:00Z', notesUrl: 'https://example.com/notes', assets,
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

let dir: string
let options: UpdaterOptions
const fetchMock = vi.fn<typeof fetch>()
const open = vi.fn(async (_: string) => '')
const quit = vi.fn()
const relaunch = vi.fn()
const install = vi.fn(async (_: string): Promise<'quit' | 'relaunch' | undefined> => undefined)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vardrynn-updater-'))
  fetchMock.mockReset()
  open.mockClear()
  quit.mockClear()
  relaunch.mockClear()
  install.mockReset()
  install.mockResolvedValue(undefined)
  options = {
    origin: 'https://api.example.com', publicKey: rawPublic, version: '1.0.0', platform: 'darwin', arch: 'arm64',
    stagingDirectory: dir, fetch: fetchMock, open, quit, install, relaunch,
  }
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('unconfigured updater', () => {
  it.each([{ origin: undefined }, { publicKey: undefined }])('reports not-configured and refuses every step: %j', async (missing) => {
    const updater = new ElectronUpdater(undefined, { ...options, ...missing })
    const stale = { name: 'XMCL', date: '', body: '', files: [], newUpdate: true, operation: 'autoupdater' }
    expect(updater.capability).toEqual({ automatic: false, reason: 'not-configured' })
    await expect(updater.checkUpdateTask()).rejects.toThrow('unavailable')
    await expect(updater.downloadUpdate(stale)).rejects.toThrow('unavailable')
    await expect(updater.installUpdateAndQuit(stale)).rejects.toThrow('unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('release discovery', () => {
  it('offers a newer signed release for this host and never follows redirects', async () => {
    fetchMock.mockResolvedValue(json(manifest([asset(), asset('1.2.0', { platform: 'linux', arch: 'x64' })])))
    const updater = new ElectronUpdater(undefined, options)
    expect(updater.capability).toBeUndefined()
    const info = await updater.checkUpdateTask()
    expect(info).toMatchObject({ name: '1.2.0', newUpdate: true, operation: 'verified' })
    expect(info.files).toHaveLength(1)
    expect(info.files[0]).toMatchObject({ name: 'vardrynn-1.2.0-arm64.dmg', platform: 'darwin', sha256: SHA })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.example.com/v1/releases/latest')
    expect(init).toMatchObject({ redirect: 'error', cache: 'no-store' })
  })

  it('reports no new update for the same or an older release', async () => {
    fetchMock.mockResolvedValue(json(manifest([asset()])))
    expect((await new ElectronUpdater(undefined, { ...options, version: '1.2.0' }).checkUpdateTask()).newUpdate).toBe(false)
    fetchMock.mockResolvedValue(json(manifest([asset()])))
    expect((await new ElectronUpdater(undefined, { ...options, version: '2.0.0' }).checkUpdateTask()).newUpdate).toBe(false)
  })

  it('rejects releases with forged, mismatched or missing assets', async () => {
    const updater = new ElectronUpdater(undefined, options)
    fetchMock.mockResolvedValueOnce(json(manifest([{ ...asset(), signature: Buffer.alloc(64).toString('base64') }])))
    await expect(updater.checkUpdateTask()).rejects.toThrow('No signed')
    // Signed for 1.2.0 but advertised as 9.9.9.
    fetchMock.mockResolvedValueOnce(json(manifest([asset()], '9.9.9')))
    await expect(updater.checkUpdateTask()).rejects.toThrow('No signed')
    fetchMock.mockResolvedValueOnce(json(manifest([asset('1.2.0', { platform: 'win32' })])))
    await expect(updater.checkUpdateTask()).rejects.toThrow('No signed')
    fetchMock.mockResolvedValueOnce(json({ apiVersion: 'v2' }))
    await expect(updater.checkUpdateTask()).rejects.toThrow('incompatible')
  })

  it('treats 404 as no release and other failures as errors', async () => {
    const updater = new ElectronUpdater(undefined, options)
    fetchMock.mockResolvedValueOnce(json({}, 404))
    await expect(updater.checkUpdateTask()).rejects.toThrow('No update info found')
    fetchMock.mockResolvedValueOnce(json({}, 503))
    await expect(updater.checkUpdateTask()).rejects.toThrow('503')
  })
})

describe('download and install', () => {
  async function discover() {
    fetchMock.mockResolvedValueOnce(json(manifest([asset()])))
    const updater = new ElectronUpdater(undefined, options)
    return { updater, info: await updater.checkUpdateTask() }
  }

  it('stages a verified package, then opens it and quits', async () => {
    const { updater, info } = await discover()
    fetchMock.mockResolvedValueOnce(new Response(PACKAGE))
    await updater.downloadUpdate(info)
    const staged = join(dir, '1.2.0', 'vardrynn-1.2.0-arm64.dmg')
    expect(await readFile(staged)).toEqual(PACKAGE)
    expect(await readdir(join(dir, '1.2.0'))).toEqual(['vardrynn-1.2.0-arm64.dmg'])

    await updater.installUpdateAndQuit(info)
    expect(open).toHaveBeenCalledWith(staged)
    expect(quit).toHaveBeenCalledOnce()
  })

  it('removes staged packages that are not newer than the running version', async () => {
    for (const name of ['0.9.0', '1.0.0', '1.2.0']) {
      await mkdir(join(dir, name), { recursive: true })
      await writeFile(join(dir, name, 'pkg.dmg'), 'x')
    }
    await discover()
    expect((await readdir(dir)).sort()).toEqual(['1.2.0'])
  })

  it('skips the download when the staged file already matches', async () => {
    const { updater, info } = await discover()
    fetchMock.mockResolvedValueOnce(new Response(PACKAGE))
    await updater.downloadUpdate(info)
    await updater.downloadUpdate(info)
    expect(fetchMock).toHaveBeenCalledTimes(2) // discovery + one download
  })

  it('discards a download that does not match the signed checksum', async () => {
    const { updater, info } = await discover()
    fetchMock.mockResolvedValueOnce(new Response('tampered'))
    await expect(updater.downloadUpdate(info)).rejects.toThrow('signed checksum')
    expect(await readdir(join(dir, '1.2.0'))).toEqual([])
  })

  it('does not install a staged file that changed after download', async () => {
    const { updater, info } = await discover()
    fetchMock.mockResolvedValueOnce(new Response(PACKAGE))
    await updater.downloadUpdate(info)
    const staged = join(dir, '1.2.0', 'vardrynn-1.2.0-arm64.dmg')
    await writeFile(staged, 'swapped')
    await expect(updater.installUpdateAndQuit(info)).rejects.toThrow('does not match')
    expect(open).not.toHaveBeenCalled()
    expect(install).not.toHaveBeenCalled()
    expect(quit).not.toHaveBeenCalled()
    expect(await readdir(join(dir, '1.2.0'))).toEqual([])
  })

  it('refuses stored info that was not signed for this release and host', async () => {
    const { updater, info } = await discover()
    const bad = [
      { ...info, name: '9.9.9' },
      { ...info, operation: 'autoupdater' },
      { ...info, files: [{ ...info.files[0], sha256: 'b'.repeat(64) }] },
      { ...info, files: [{ ...info.files[0], platform: 'win32' }] },
      { ...info, files: [{ ...info.files[0], signature: undefined }] },
      { ...info, files: [] },
      { ...info, files: [{ ...info.files[0], name: '../escape.dmg' }] },
    ]
    for (const candidate of bad) {
      await expect(updater.downloadUpdate(candidate as any)).rejects.toThrow()
      await expect(updater.installUpdateAndQuit(candidate as any)).rejects.toThrow()
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })

  it('installs in place when the platform supports it, opening nothing', async () => {
    for (const [mode, called] of [['quit', quit], ['relaunch', relaunch]] as const) {
      const { updater, info } = await discover()
      fetchMock.mockResolvedValueOnce(new Response(PACKAGE))
      await updater.downloadUpdate(info)
      install.mockResolvedValueOnce(mode)
      await updater.installUpdateAndQuit(info)
      expect(install).toHaveBeenLastCalledWith(join(dir, '1.2.0', 'vardrynn-1.2.0-arm64.dmg'))
      expect(called).toHaveBeenCalledOnce()
    }
    expect(open).not.toHaveBeenCalled()
  })

  it('keeps running when the in-place install fails', async () => {
    const { updater, info } = await discover()
    fetchMock.mockResolvedValueOnce(new Response(PACKAGE))
    await updater.downloadUpdate(info)
    install.mockRejectedValueOnce(new Error('Installation was not authorized'))
    await expect(updater.installUpdateAndQuit(info)).rejects.toThrow('not authorized')
    expect(quit).not.toHaveBeenCalled()
    expect(relaunch).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('does not quit when the OS cannot open the package', async () => {
    const { updater, info } = await discover()
    fetchMock.mockResolvedValueOnce(new Response(PACKAGE))
    await updater.downloadUpdate(info)
    open.mockResolvedValueOnce('no handler')
    await expect(updater.installUpdateAndQuit(info)).rejects.toThrow('no handler')
    expect(quit).not.toHaveBeenCalled()
  })

  it('rejects an upstream download url inside otherwise signed info', async () => {
    const upstream = asset('1.2.0', { url: 'https://github.com/Voxelum/x-minecraft-launcher/releases/download/v1/x.dmg' })
    const updater = new ElectronUpdater(undefined, options)
    const info = { name: '1.2.0', body: '', date: '', newUpdate: true, operation: 'verified', files: [{ name: 'x.dmg', ...upstream }] }
    await expect(updater.downloadUpdate(info)).rejects.toThrow('unsafe')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
