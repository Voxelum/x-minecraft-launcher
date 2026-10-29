import { MinecraftFolder, Version, type ResolvedVersion } from '@xmcl/core'
import { readFile, rm, writeFile } from 'fs/promises'
import { executeInstallManifest } from './installManifest'
import { createDefaultNodeInstallRuntime } from './installManifest.default'
import { expect, test } from 'vitest'
import {
  resolveMinecraftJarInstallFile,
  resolveMinecraftServerProfileTask,
  resolveMinecraftVersionJsonInstallFile,
} from './minecraft'

test('can resolve the version JSON install file', async ({ temp }) => {
  const id = '1.17.1'
  const folder = MinecraftFolder.from(temp)
  const file = resolveMinecraftVersionJsonInstallFile(
    {
      id,
      type: 'release',
      time: '2024-01-01T00:00:00.000Z',
      releaseTime: '2024-01-01T00:00:00.000Z',
      url: 'https://example.com/version.json',
    },
    folder,
  )

  expect(file).toEqual({
    path: folder.getVersionJson(id),
    urls: ['https://example.com/version.json'],
    validator: 'json',
    replace: true,
  })
})

test('always strictly validates the minecraft jar install file', async ({ temp }) => {
  const id = '1.17.1'
  const folder = MinecraftFolder.from(temp)
  const version = {
    id,
    minecraftVersion: id,
    minecraftDirectory: folder.root,
    downloads: {
      client: {
        url: 'https://example.com/client.jar',
        sha1: 'client-sha1',
        size: 123,
      },
    },
  } as ResolvedVersion

  const file = resolveMinecraftJarInstallFile(version, { timestamp: Date.now() })

  expect(file).toEqual({
    path: folder.getVersionJar(id, 'client'),
    urls: ['https://example.com/client.jar'],
    size: 123,
    checksum: {
      algorithm: 'sha1',
      value: 'client-sha1',
    },
    validator: 'zip',
    validatedAt: undefined,
  })
})
for (const id of ['1.7.10', '1.21.1', '26.3']) {
  test(`materializes a resolvable vanilla server profile for ${id} and repairs a missing profile`, async ({ temp }) => {
    const folder = MinecraftFolder.from(temp)
    const version = {
      id,
      minecraftVersion: id,
      minecraftDirectory: folder.root,
      time: '2026-01-01T00:00:00Z',
      releaseTime: '2026-01-01T00:00:00Z',
    } as ResolvedVersion
    const task = resolveMinecraftServerProfileTask(version)
    const install = () => executeInstallManifest({ schemaVersion: 1, tasks: [task] }, createDefaultNodeInstallRuntime())

    await install()
    // The client profile must not be overwritten or used as a server entrypoint.
    await writeFile(folder.getVersionJson(id), '{"mainClass":"client.Main"}')
    for (let attempt = 0; attempt < 2; attempt++) {
      const server = await Version.parseServer(folder, id)
      expect(server.id).toBe(id)
      expect(server.minecraftVersion).toBe(id)
      expect(folder.getLibraryByPath(server.jar!)).toBe(folder.getVersionJar(id, 'server'))
      expect(server.mainClass).toBe('')
      expect(server.libraries).toEqual([])
      expect(server.arguments).toEqual({ jvm: [], game: [] })
      await rm(folder.getVersionServerJson(id))
      await install()
    }
    expect(await readFile(folder.getVersionJson(id), 'utf8')).toBe('{"mainClass":"client.Main"}')
  })
}
