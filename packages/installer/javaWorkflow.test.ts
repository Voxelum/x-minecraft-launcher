import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { finished } from 'stream/promises'
import { afterEach, describe, expect, test } from 'vitest'
import { ZipFile } from 'yazl'
import { createJavaRuntimeInstallWorkflow, createZuluRuntimeInstallWorkflow } from './javaWorkflow'
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
      },
    }
    await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest))
    const second = await workflow.next()
    expect(second.done).toBe(false)
    if (!second.done) {
      expect(second.plan.tasks).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'files' }),
        expect.objectContaining({
          type: 'materialize',
          operations: expect.arrayContaining([
            expect.objectContaining({ type: 'ensure-directory' }),
            expect.objectContaining({ type: 'chmod', mode: 0o755 }),
            expect.objectContaining({ type: 'link' }),
          ]),
        }),
      ]))
      await executeInstallManifest(second.plan, createNodeInstallRuntime({
        checksum: (path) => readFile(path, 'utf8'),
        download: async (files) => {
          await Promise.all(files.map(async (file) => {
            await mkdir(dirname(file.path), { recursive: true })
            await writeFile(file.path, file.checksum?.value ?? 'downloaded')
          }))
        },
      }))
      await expect(readFile(join(destination, 'bin', 'java'), 'utf8')).resolves.toBe('java')
      await expect(readFile(join(destination, 'bin', 'java-link'), 'utf8')).resolves.toBe('java')
    }
  })

  test('extracts a Zulu archive through generic materialization', async () => {
    const destination = await createRoot()
    const source = join(await createRoot(), 'zulu.zip')
    await createZip(source, 'zulu/bin/java.exe', 'java')
    const content = await readFile(source)
    const workflow = createZuluRuntimeInstallWorkflow({
      runtime: {
        url: 'https://example.com/zulu.zip',
        sha256: createHash('sha256').update(content).digest('hex'),
        size: content.length,
        os: 'win32',
        architecture: 'x64',
        features: [],
      },
      destination,
      executable: join(destination, 'bin', 'java.exe'),
    })
    const first = await workflow.next()
    expect(first.done).toBe(false)
    if (first.done) return
    const archive = first.plan.tasks[0].type === 'files' && first.plan.tasks[0].files[0].path
    if (!archive) throw new Error('Missing archive output')
    await mkdir(dirname(archive), { recursive: true })
    await writeFile(archive, content)

    const second = await workflow.next()
    expect(second.done).toBe(false)
    if (second.done) return
    await executeInstallManifest(second.plan, createNodeInstallRuntime())

    await expect(readFile(join(destination, 'bin', 'java.exe'), 'utf8')).resolves.toBe('java')
  })
})
