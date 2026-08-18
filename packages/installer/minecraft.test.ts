import { MinecraftFolder, type ResolvedVersion } from '@xmcl/core'
import { expect, test } from 'vitest'
import {
  resolveMinecraftJarInstallFile,
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

test('can resolve the minecraft jar install file', async ({ temp }) => {
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

  const file = resolveMinecraftJarInstallFile(version)

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