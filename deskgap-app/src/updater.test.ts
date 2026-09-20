import type { DownloadUpdateOptions } from '@xmcl/runtime/app'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeskGapUpdater, deskGapPublisherNames, LocalDevelopmentUpdater } from './updater'

let directory: string
beforeEach(async () => {
  directory = join(import.meta.dirname, '..', 'build', 'output', 'tests', randomUUID())
  await mkdir(directory, { recursive: true })
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function githubRelease(version = '0.70.0') {
  const name = `xmcl-deskgap-${version}-win32-x64.exe`
  return {
    tag_name: `v${version}`, draft: false, prerelease: false,
    assets: [{ name, size: 100, browser_download_url: `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/${name}` }],
  }
}

function setup() {
  const bytes = Buffer.alloc(100, 'x')
  const executable = {
    isSupported: vi.fn(() => true),
    verifySignature: vi.fn(async (_path: string, _publishers: readonly string[]) => {}),
    install: vi.fn(async (_path: string, _options: { publisherNames: readonly string[]; args?: string[]; quit?: boolean; sha256?: string }) => {}),
  }
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([githubRelease()]))
  const download = vi.fn(async (_url: string, destination: string, _options?: DownloadUpdateOptions) => { await writeFile(destination, bytes) })
  const restart = vi.fn(async (_relaunch: boolean) => {})
  const updater = new DeskGapUpdater({
    version: '0.69.0', repository: 'Voxelum/x-minecraft-launcher', directory, fetch: fetcher,
    executable, download, getSettings: async () => ({ allowPrerelease: false }), restart,
  })
  return { updater, executable, fetcher, download, restart, bytes }
}

describe('DeskGap Windows EXE update adapter', () => {
  it('verifies the fixed publisher before ready and binds installation to the downloaded bytes', async () => {
    const { updater, executable, download, restart, bytes } = setup()
    const release = await updater.checkUpdateTask()
    await updater.downloadUpdate(JSON.parse(JSON.stringify(release)))
    const path = download.mock.calls[0][1]
    expect(executable.verifySignature).toHaveBeenCalledWith(path, deskGapPublisherNames)
    await updater.installUpdateAndQuit(release)
    expect(executable.install).toHaveBeenCalledWith(path, {
      publisherNames: deskGapPublisherNames,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      args: [`--deskgap-wait-for-pid=${process.pid}`], quit: false,
    })
    expect(restart).toHaveBeenCalledWith(false)
  })

  it('forwards task progress/cancellation to the standard downloader and allows retry', async () => {
    const { updater, download } = setup()
    const release = await updater.checkUpdateTask()
    const options = { tracker: vi.fn(), abortSignal: new AbortController().signal }
    download.mockRejectedValueOnce(new Error('network disconnected'))
    await expect(updater.downloadUpdate(release, options)).rejects.toThrow('disconnected')
    expect(download).toHaveBeenCalledWith(release.files[0].url, expect.any(String), options)
    expect(await readdir(directory)).toEqual([])
    await updater.downloadUpdate(release)
  })

  it('never accepts an unsigned or wrong-publisher executable based only on its size or SHA', async () => {
    const { updater, executable, restart } = setup()
    const release = await updater.checkUpdateTask()
    executable.verifySignature.mockRejectedValueOnce(new Error('Untrusted publisher'))
    await expect(updater.downloadUpdate(release)).rejects.toThrow('Untrusted publisher')
    expect(await readdir(directory)).toEqual([])
    await expect(updater.installUpdateAndQuit(release)).rejects.toThrow('verified')
    expect(executable.install).not.toHaveBeenCalled()
    expect(restart).not.toHaveBeenCalled()
    await updater.downloadUpdate(release)
    await updater.installUpdateAndQuit(release)
  })

  it('rejects truncated files before signature verification', async () => {
    const { updater, download, executable } = setup()
    download.mockImplementationOnce(async (_url, path) => { await writeFile(path, 'short') })
    await expect(updater.downloadUpdate(await updater.checkUpdateTask())).rejects.toThrow('size mismatch')
    expect(executable.verifySignature).not.toHaveBeenCalled()
  })

  it('does not download a pre-cancelled request or accept cancellation swallowed by a downloader', async () => {
    const { updater, download, executable } = setup()
    const release = await updater.checkUpdateTask()
    await expect(updater.downloadUpdate(release, { abortSignal: AbortSignal.abort() })).rejects.toThrow()
    expect(download).not.toHaveBeenCalled()
    const controller = new AbortController()
    download.mockImplementationOnce(async () => { controller.abort() })
    await expect(updater.downloadUpdate(release, { abortSignal: controller.signal })).rejects.toThrow()
    expect(executable.verifySignature).not.toHaveBeenCalled()
  })

  it('preserves a verified update when checking the same standard release', async () => {
    const { updater, executable } = setup()
    const release = await updater.checkUpdateTask()
    await updater.downloadUpdate(release)
    expect(await updater.checkUpdateTask()).toBe(release)
    await updater.installUpdateAndQuit(release)
    expect(executable.install).toHaveBeenCalledOnce()
  })

  it('invalidates stale updates and never offers a downgrade', async () => {
    const { updater, fetcher, executable } = setup()
    const release = await updater.checkUpdateTask()
    await updater.downloadUpdate(release)
    fetcher.mockImplementation(async () => Response.json([githubRelease('0.68.0')]))
    expect(await updater.checkUpdateTask()).toMatchObject({ newUpdate: false })
    await expect(updater.installUpdateAndQuit(release)).rejects.toThrow('stale')
    expect(executable.install).not.toHaveBeenCalled()
  })

  it('does not quit when native re-verification or spawn fails and allows installation retry', async () => {
    const { updater, executable, restart } = setup()
    const release = await updater.checkUpdateTask()
    await updater.downloadUpdate(release)
    executable.install.mockRejectedValueOnce(new Error('Artifact changed after download'))
    await expect(updater.installUpdateAndQuit(release)).rejects.toThrow('changed')
    expect(restart).not.toHaveBeenCalled()
    await updater.installUpdateAndQuit(release)
    expect(restart).toHaveBeenCalledOnce()
  })

  it('installs on normal quit only once without relaunching the old runtime', async () => {
    const { updater, executable, restart } = setup()
    await updater.downloadUpdate(await updater.checkUpdateTask())
    await updater.installOnQuit()
    await updater.installOnQuit()
    expect(executable.install).toHaveBeenCalledOnce()
    expect(restart).not.toHaveBeenCalled()
  })

  it('rejects overlap and unsupported platforms rather than disabling publisher verification', async () => {
    const { updater, download, executable } = setup()
    const release = await updater.checkUpdateTask()
    let finish!: () => void
    download.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const pending = updater.downloadUpdate(release)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    await expect(updater.checkUpdateTask()).rejects.toThrow('already running')
    finish()
    await expect(pending).rejects.toThrow()
    executable.isSupported.mockReturnValue(false)
    await expect(updater.checkUpdateTask()).rejects.toThrow('Windows x64')
  })

  it('keeps the development host explicitly non-updatable', async () => {
    const updater = new LocalDevelopmentUpdater('0.69.0')
    expect(await updater.checkUpdateTask()).toMatchObject({ newUpdate: false })
    await expect(updater.downloadUpdate()).rejects.toThrow('disabled')
  })
})
