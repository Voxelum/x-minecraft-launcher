import { MinecraftFolder, type ResolvedLibrary } from '@xmcl/core'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { resolveAssetInstallFiles } from './assets'
import { createNodeInstallRuntime, executeInstallManifest, type InstallFile } from './installManifest'
import { resolveLibraryInstallFiles } from './libraries'

const roots: string[] = []

afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-installer-recovery-'))
  roots.push(root)
  return root
}

function mockCorruptThenValidDownload(expected: string) {
  let attempt = 0
  return vi.fn(async (files: InstallFile[]) => {
    attempt += 1
    await Promise.all(files.map(async ({ path }) => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, attempt === 1 ? 'corrupt' : expected)
    }))
  })
}

describe('post-download recovery', () => {
  test('redownloads a library whose downloaded checksum does not match', async () => {
    const root = await createRoot()
    const folder = MinecraftFolder.from(root)
    const library = {
      name: 'com.example:library:1.0.0',
      path: 'com/example/library/1.0.0/library-1.0.0.jar',
      download: {
        path: 'com/example/library/1.0.0/library-1.0.0.jar',
        url: 'https://example.com/library.jar',
        sha1: 'valid-library',
        size: 13,
      },
    } as ResolvedLibrary
    const download = mockCorruptThenValidDownload('valid-library')

    await executeInstallManifest(
      {
        schemaVersion: 1,
        tasks: [{ id: 'libraries', type: 'files', files: resolveLibraryInstallFiles([library], folder) }],
      },
      createNodeInstallRuntime({
        download,
        checksum: async (file) => readFile(file, 'utf8'),
      }),
    )

    expect(download).toHaveBeenCalledTimes(2)
    await expect(readFile(join(root, 'libraries', library.download.path), 'utf8'))
      .resolves.toBe('valid-library')
  })

  test('redownloads an asset whose downloaded checksum does not match', async () => {
    const root = await createRoot()
    const folder = MinecraftFolder.from(root)
    const asset = { name: 'asset', hash: 'valid-asset', size: 11 }
    const download = mockCorruptThenValidDownload(asset.hash)

    await executeInstallManifest(
      {
        schemaVersion: 1,
        tasks: [{ id: 'assets', type: 'files', files: resolveAssetInstallFiles([asset], folder) }],
      },
      createNodeInstallRuntime({
        download,
        checksum: async (file) => readFile(file, 'utf8'),
      }),
    )

    expect(download).toHaveBeenCalledTimes(2)
    await expect(readFile(folder.getAsset(asset.hash), 'utf8')).resolves.toBe(asset.hash)
  })
})