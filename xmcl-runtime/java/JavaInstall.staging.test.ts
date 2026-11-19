import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { copyFile, mkdtemp, mkdir, readFile, readdir, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { createNodeInstallRuntime, executeInstallManifest, resolveJava } from '@xmcl/installer'
import { pack } from 'tar-stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installJavaRuntime, withStagedJavaRuntime } from './JavaInstall'

describe('staged Java installation', () => {
  let root: string
  let destination: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xmcl-java-stage-'))
    destination = join(root, 'runtime')
    await mkdir(destination)
    await writeFile(join(destination, 'java'), 'old')
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('leaves the old runtime unchanged if preparation fails', async () => {
    await expect(
      withStagedJavaRuntime(
        destination,
        async (staging) => {
          await mkdir(staging)
          await writeFile(join(staging, 'java'), 'partial')
          throw new Error('download failed')
        },
        async () => undefined,
      ),
    ).rejects.toThrow('download failed')
    expect(await readFile(join(destination, 'java'), 'utf8')).toBe('old')
    expect(await readdir(root)).toEqual(['runtime'])
  })

  it('never overwrites an existing runtime', async () => {
    await expect(
      withStagedJavaRuntime(
        destination,
        async (staging) => {
          await mkdir(staging)
          await writeFile(join(staging, 'java'), 'new')
        },
        async () => undefined,
      ),
    ).rejects.toThrow('destination already exists')
    expect(await readFile(join(destination, 'java'), 'utf8')).toBe('old')
    expect(await readdir(root)).toEqual(['runtime'])
  })

  it('removes a new runtime when activation fails without touching the old one', async () => {
    const newDestination = join(root, 'new-runtime')
    await expect(withStagedJavaRuntime(
      newDestination,
      async (staging) => {
        await mkdir(staging)
        await writeFile(join(staging, 'java'), 'new')
      },
      async () => { throw new Error('validation failed') },
    )).rejects.toThrow('validation failed')
    expect(await readFile(join(destination, 'java'), 'utf8')).toBe('old')
    expect(await readdir(root)).toEqual(['runtime'])
  })

  it('installs a new runtime after successful preparation and activation', async () => {
    const newDestination = join(root, 'new-runtime')
    const result = await withStagedJavaRuntime(
      newDestination,
      async (staging) => {
        await mkdir(staging)
        await writeFile(join(staging, 'java'), 'new')
      },
      async () => readFile(join(newDestination, 'java'), 'utf8'),
    )
    expect(result).toBe('new')
    expect(await readFile(join(destination, 'java'), 'utf8')).toBe('old')
    expect((await readdir(root)).sort()).toEqual(['new-runtime', 'runtime'])
  })

  it.skipIf(process.platform === 'win32')('extracts and validates a wrapped Java archive', async () => {
    const archive = join(root, 'fixture.tar.gz')
    const tar = pack()
    tar.entry({ name: 'jdk/bin/java', mode: 0o755 }, '#!/bin/sh\necho \'openjdk version "17.0.2"\' >&2\n')
    tar.entry({ name: 'jdk/lib/runtime' }, 'library')
    tar.entry({ name: 'jdk/lib/runtime-link', type: 'symlink', linkname: 'runtime' })
    tar.finalize()
    await pipeline(tar, createGzip(), createWriteStream(archive))
    const hash = createHash('sha256').update(await readFile(archive)).digest('hex')
    const app = {
      platform: { os: 'linux', arch: 'x64' },
      fetch: async () => new Response(JSON.stringify({ runtimes: [{
        name: 'temurin17.0.2+1', vendor: 'eclipse', runtimeOS: 'linux-x64',
        downloadType: 'archive', url: 'https://example.test/fixture.tar.gz',
        checksum: { type: 'sha256', hash },
      }] })),
      mutex: { of: () => ({ runExclusive: (action: () => Promise<unknown>) => action() }) },
    }
    const runtime = createNodeInstallRuntime({
      download: async (files) => {
        for (const file of files) {
          await mkdir(dirname(file.path), { recursive: true })
          await copyFile(archive, file.path)
        }
      },
      checksum: async (path, algorithm) => createHash(algorithm).update(await readFile(path)).digest('hex'),
    })
    const installer = { install: (plan: Parameters<typeof executeInstallManifest>[0]) => executeInstallManifest(plan, runtime) }
    const java = await installJavaRuntime(
      app as never, ((...parts: string[]) => join(root, ...parts)) as never,
      installer as never, { controller: new AbortController() } as never,
      'net.adoptium.java', 'java17', 17, (path) => resolveJava(path, { timeout: 5000 }),
    )
    expect(java.path).toBe(join(root, 'jre', 'temurin17.0.2+1', 'bin', 'java'))
    expect(java.majorVersion).toBe(17)
    expect(await readlink(join(root, 'jre', 'temurin17.0.2+1', 'lib', 'runtime-link'))).toBe('runtime')
    expect(await readFile(join(root, 'jre', 'temurin17.0.2+1', 'lib', 'runtime-link'), 'utf8')).toBe('library')
  })
})
