import { createServer } from 'http'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, test } from 'vitest'
import { createDefaultNodeInstallRuntime } from './installManifest.default'
import { executeInstallManifest } from './installManifest'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

test('uses file-transfer as the default Node download adapter', async () => {
  const content = 'default-adapter'
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-length': String(Buffer.byteLength(content)) })
    response.end(content)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing server address')
  const root = await mkdtemp(join(tmpdir(), 'xmcl-default-install-runtime-'))
  roots.push(root)
  const destination = join(root, 'file.txt')

  try {
    await executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'download',
        type: 'files',
        files: [{
          path: destination,
          urls: [`http://127.0.0.1:${address.port}/file.txt`],
          size: Buffer.byteLength(content),
        }],
      }],
    }, createDefaultNodeInstallRuntime())

    await expect(readFile(destination, 'utf8')).resolves.toBe(content)
  } finally {
    server.close()
  }
})
