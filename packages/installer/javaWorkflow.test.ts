import { createWriteStream } from 'fs'
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { finished } from 'stream/promises'
import { afterEach, describe, expect, test } from 'vitest'
import { pack } from 'tar-stream'
import { createGzip } from 'zlib'
import { ZipFile } from 'yazl'
import {
  createJavaArchiveInstallWorkflow,
  createJavaRuntimeInstallWorkflow,
  createJavaRuntimeManifestInstallWorkflow,
} from './javaWorkflow'
import { createNodeInstallRuntime, executeInstallManifest } from './installManifest'
import type { JavaRuntimeManifest, JavaRuntimeTarget } from './java-runtime.browser'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-java-workflow-'))
  roots.push(root)
  return root
}

async function createZip(path: string, entry: string, content: string) {
  await mkdir(dirname(path), { recursive: true })
  const zip = new ZipFile()
  zip.addBuffer(Buffer.from(content), entry)
  zip.end()
  const output = createWriteStream(path)
  zip.outputStream.pipe(output)
  await finished(output)
}

describe('Java runtime install workflows', () => {
  test('expands an official manifest into files and layout materialization', async () => {
    const destination = await createRoot()
    const target = {
      manifest: { url: 'https://example.com/manifest.json', sha1: 'manifest', size: 1 },
      version: { name: '21', released: '' },
      availability: { group: 0, progress: 100 },
    } as JavaRuntimeTarget
    const workflow = createJavaRuntimeInstallWorkflow({ target, destination })
    const first = await workflow.next()
    expect(first).toMatchObject({ done: false, plan: { tasks: [{ type: 'files' }] } })

    const manifest: JavaRuntimeManifest = {
      target: 'windows-x64',
      version: { name: '21', released: '' },
      files: {
        bin: { type: 'directory' },
        'bin/java': {
          type: 'file',
          executable: true,
          downloads: { raw: { url: 'https://example.com/java', sha1: 'java', size: 4 } },
        },
        'bin/java-link': { type: 'link', target: 'java' },
        man: { type: 'directory' },
        'man/ja': { type: 'link', target: 'ja_JP.UTF-8' },
        'man/ja_JP.UTF-8': { type: 'directory' },
        'man/ja_JP.UTF-8/man1': { type: 'directory' },
        'man/ja_JP.UTF-8/man1/java.1': {
          type: 'file',
          executable: false,
          downloads: {
            raw: { url: 'https://example.com/java.1', sha1: 'manual', size: 6 },
          },
        },
      },
    }
    await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest))
    const second = await workflow.next()
    expect(second.done).toBe(false)
    if (!second.done) {
      expect(second.plan.tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'files' }),
          expect.objectContaining({
            type: 'materialize',
            operations: expect.arrayContaining([
              expect.objectContaining({ type: 'ensure-directory' }),
              expect.objectContaining({ type: 'chmod', mode: 0o755 }),
              expect.objectContaining({ type: 'symlink', target: 'java' }),
              expect.objectContaining({ type: 'symlink', target: 'ja_JP.UTF-8' }),
            ]),
          }),
        ]),
      )
      await executeInstallManifest(
        second.plan,
        createNodeInstallRuntime({
          checksum: (path) => readFile(path, 'utf8'),
          download: async (files) => {
            await Promise.all(
              files.map(async (file) => {
                await mkdir(dirname(file.path), { recursive: true })
                await writeFile(file.path, file.checksum?.value ?? 'downloaded')
              }),
            )
          },
        }),
      )
      await expect(readFile(join(destination, 'bin', 'java'), 'utf8')).resolves.toBe('java')
      await expect(readFile(join(destination, 'bin', 'java-link'), 'utf8')).resolves.toBe('java')
      await expect(
        lstat(join(destination, 'bin', 'java-link')).then((entry) => entry.isSymbolicLink()),
      ).resolves.toBe(true)
      await expect(readlink(join(destination, 'man', 'ja'))).resolves.toBe('ja_JP.UTF-8')
      await expect(
        stat(join(destination, 'man', 'ja')).then((entry) => entry.isDirectory()),
      ).resolves.toBe(true)
      await expect(
        readFile(join(destination, 'man', 'ja', 'man1', 'java.1'), 'utf8'),
      ).resolves.toBe('manual')
    }
  })

  test('rejects traversal paths in an official runtime manifest', async () => {
    const destination = await createRoot()
    const manifest = {
      files: {
        '../outside': { type: 'directory' },
      },
    } as unknown as JavaRuntimeManifest
    const workflow = createJavaRuntimeManifestInstallWorkflow(manifest, destination)
    await expect(workflow.next()).rejects.toThrow('Unsafe path in Java runtime manifest')
  })

  test('rejects symbolic links that escape the runtime destination', async () => {
    const destination = await createRoot()
    const manifest = {
      files: {
        'lib/escape': { type: 'link', target: '../../../outside' },
      },
    } as unknown as JavaRuntimeManifest
    const workflow = createJavaRuntimeManifestInstallWorkflow(manifest, destination)
    await expect(workflow.next()).rejects.toThrow('Unsafe symbolic link in Java runtime manifest')
  })

  test('creates a vendor archive download and extraction plan', async () => {
    const destination = await createRoot()
    const workflow = createJavaArchiveInstallWorkflow({
      url: 'https://example.com/temurin-jre.zip',
      checksum: { algorithm: 'sha256', value: 'abc123' },
      destination,
    })
    const download = await workflow.next()
    expect(download).toMatchObject({
      done: false,
      plan: {
        tasks: [
          {
            id: 'java-vendor-archive',
            type: 'files',
            files: [{ checksum: { algorithm: 'sha256', value: 'abc123' } }],
          },
        ],
      },
    })
    const extract = await workflow.next()
    expect(extract).toMatchObject({ done: false })
    if (!extract.done) {
      const task = extract.plan.tasks[0]
      expect(task).toMatchObject({ id: 'java-vendor-extract', type: 'materialize' })
      if (task.type === 'materialize') {
        expect(task.operations[0]).toMatchObject({
          type: 'extract-archive',
          format: 'zip',
          path: destination,
        })
        expect(task.operations[0]).not.toHaveProperty('stripComponents')
      }
    }
    expect((await workflow.next()).done).toBe(true)
  })

  test('fails archive extraction when a required symbolic link cannot be created', async () => {
    const root = await createRoot()
    const archive = join(root, 'runtime.tar.gz')
    const tar = pack()
    tar.entry({ name: 'bin/java-link', type: 'symlink', linkname: 'java', size: 0 })
    tar.entry({ name: 'bin/java-link', type: 'symlink', linkname: 'java', size: 0 })
    tar.finalize()
    await pipeline(tar, createGzip(), createWriteStream(archive))

    const runtime = createNodeInstallRuntime()
    await expect(
      runtime.materialize([
        {
          type: 'extract-archive',
          archive,
          path: join(root, 'runtime'),
          format: 'tar.gz',
        },
      ]),
    ).rejects.toThrow()
  })

  test('builds a vendor manifest workflow without downloading the manifest again', async () => {
    const destination = await createRoot()
    const manifest: JavaRuntimeManifest = {
      target: 'linux-x64',
      version: { name: '21.0.7', released: '' },
      files: {
        'bin/java': {
          type: 'file',
          executable: true,
          downloads: { raw: { url: 'https://example.com/java', sha1: 'abc', size: 10 } },
        },
      },
    }
    const workflow = createJavaRuntimeManifestInstallWorkflow(manifest, destination)
    const stage = await workflow.next()
    expect(stage).toMatchObject({ done: false })
    if (!stage.done) {
      expect(stage.plan.tasks[0]).toMatchObject({
        id: 'java-runtime-files',
        type: 'files',
        files: [expect.objectContaining({ path: expect.stringContaining('bin/java') })],
      })
    }
    expect((await workflow.next()).done).toBe(true)
  })
})
