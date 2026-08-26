import { MinecraftFolder, type ResolvedLibrary, type ResolvedServerVersion, type ResolvedVersion } from '@xmcl/core'
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, describe, expect, test } from 'vitest'
import { diagnoseServerInstallation } from './installer'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-server-diagnose-'))
  roots.push(root)
  const folder = MinecraftFolder.from(root)
  const jar = folder.getVersionJar('1.21.1', 'server')
  const libraryPath = 'com/example/server-lib/1.0/server-lib-1.0.jar'
  const libraryFile = folder.getLibraryByPath(libraryPath)
  await mkdir(dirname(jar), { recursive: true })
  await mkdir(dirname(libraryFile), { recursive: true })
  await writeFile(jar, 'server-jar')
  await writeFile(libraryFile, 'server-library')

  const library = {
    name: 'com.example:server-lib:1.0',
    groupId: 'com.example',
    artifactId: 'server-lib',
    version: '1.0',
    path: libraryPath,
    download: {
      path: libraryPath,
      url: 'https://example.com/server-lib.jar',
      sha1: 'server-library',
      size: 14,
    },
  } as ResolvedLibrary
  const server = {
    id: 'server-profile',
    minecraftVersion: '1.21.1',
    mainClass: 'net.minecraft.server.Main',
    libraries: [library],
    arguments: { game: [], jvm: [] },
  } as ResolvedServerVersion
  const base = {
    id: '1.21.1',
    downloads: { server: { sha1: 'server-jar' } },
  } as ResolvedVersion
  const checksum = (path: string) => readFile(path, 'utf8')
  return { folder, jar, libraryFile, server, base, checksum }
}

describe('server installation diagnosis', () => {
  test('returns no issue for a complete server', async () => {
    const { folder, server, base, checksum } = await fixture()

    await expect(diagnoseServerInstallation(server, folder, base, { checksum }))
      .resolves.toBeUndefined()
  })

  test('reports a missing server jar', async () => {
    const { folder, jar, server, base, checksum } = await fixture()
    await unlink(jar)

    await expect(diagnoseServerInstallation(server, folder, base, { checksum }))
      .resolves.toMatchObject({ jar: 'server-profile' })
  })

  test('reports missing server libraries', async () => {
    const { folder, libraryFile, server, base, checksum } = await fixture()
    await unlink(libraryFile)

    await expect(diagnoseServerInstallation(server, folder, base, { checksum }))
      .resolves.toMatchObject({ libraries: [server.libraries[0]] })
  })

  test('resolves a custom server jar from the libraries directory', async () => {
    const { folder, server, base, checksum } = await fixture()
    const relativeJar = 'net/example/server/1.0/server-1.0.jar'
    const customJar = folder.getLibraryByPath(relativeJar)
    await mkdir(dirname(customJar), { recursive: true })
    await writeFile(customJar, 'server-jar')
    server.jar = relativeJar

    await expect(diagnoseServerInstallation(server, folder, base, { checksum }))
      .resolves.toBeUndefined()
  })
})