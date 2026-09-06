import { describe, it, expect, vi } from 'vitest'
import { downloadInstanceFiles } from './downloadInstanceFiles'
import { createServer, Server } from 'http'
import { mkdtemp, rm, readFile, pathExists } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { createHash } from 'crypto'
import { MockAgent } from 'undici'

function sha1(content: string) {
  return createHash('sha1').update(content).digest('hex')
}

async function startServer(content: string) {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': Buffer.byteLength(content).toString(),
    })
    res.end(content)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as any).port
  return { server, baseUrl: `http://127.0.0.1:${port}` }
}

describe('downloadInstanceFiles', () => {
  it('verifies and marks each completed file ready before another download finishes', async () => {
    const content = 'ready'
    const release = Promise.withResolvers<void>()
    const server = createServer(async (request, response) => {
      response.writeHead(200, { 'Content-Length': content.length })
      if (request.url === '/slow') await release.promise
      response.end(content)
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing HTTP fixture address')
    const root = await mkdtemp(join(tmpdir(), 'xmcl-dl-progressive-'))
    const finished = new Set<string>()
    let settled = false
    const downloading = downloadInstanceFiles(['ready', 'slow'].map(path => ({
      options: { url: `http://127.0.0.1:${address.port}/${path}`, destination: join(root, path) },
      file: { path, hashes: { sha1: sha1(content) } },
    })), finished, new AbortController().signal, {}).then(() => { settled = true })
    try {
      await vi.waitFor(() => expect([...finished]).toEqual(['ready']))
      expect(settled).toBe(false)
      expect(await readFile(join(root, 'ready'), 'utf8')).toBe(content)
    } finally {
      release.resolve()
      await downloading
      server.close()
      await rm(root, { recursive: true, force: true })
    }
    expect([...finished].sort()).toEqual(['ready', 'slow'])
  })

  it('successfully downloads a file when content matches', async () => {
    const content = 'CORRECT-CONTENT'
    const { server, baseUrl } = await startServer(content)
    const dir = await mkdtemp(join(tmpdir(), 'xmcl-dl-ok-'))
    try {
      const dest = join(dir, 'a.jar')
      const finished = new Set<string>()
      await downloadInstanceFiles(
        [
          {
            options: {
              url: [`${baseUrl}/a.jar`],
              destination: dest,
              expectedTotal: content.length,
            },
            file: {
              path: 'a.jar',
              hashes: { sha1: sha1(content) },
              downloads: [`${baseUrl}/a.jar`],
            },
          },
        ],
        finished,
        new AbortController().signal,
        {},
      )

      expect(await pathExists(dest)).toBe(true)
      expect((await readFile(dest)).toString()).toBe(content)
      expect(finished.has('a.jar')).toBe(true)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  /**
   * BUG K (CRITICAL) — instance file downloads have NO integrity check.
   *
   * Trace:
   *   - InstanceInstallService passes `validator: { algorithm: 'sha1', hash }`
   *     when building each download payload.
   *   - That field is silently dropped because:
   *       1. `DownloadMultipleOption` is a `Pick<>` that does not include
   *          `validator`.
   *       2. `downloadInstanceFiles` re-builds the payload with only
   *          `url, destination, headers, expectedTotal` —
   *          stripping `validator`.
   *       3. The `download` function in @xmcl/file-transfer never reads
   *          `validator` either; the field is documented in the README
   *          but not implemented.
   *
   * Effect: every modpack file ever downloaded by this launcher is
   * accepted byte-for-byte from whatever server answers. A typo'd
   * mirror, a poisoned CDN, an HTTP MITM, or a compromised modpack
   * host can replace mod jars with arbitrary code and the launcher
   * will install them without warning. The `sha1` field in modpack
   * manifests is decorative.
   *
   * Expected: when the server returns content whose sha1 does NOT
   * match the manifest, downloadInstanceFiles must reject (and the
   * destination file must not be left in place).
   */
  it('rejects downloads whose content sha1 does not match the manifest hash', async () => {
    const wrongContent = 'ATTACKER-INJECTED-CONTENT'
    const expectedContent = 'LEGIT-MOD-CONTENT'
    const { server, baseUrl } = await startServer(wrongContent)
    const dir = await mkdtemp(join(tmpdir(), 'xmcl-dl-bad-'))
    try {
      const dest = join(dir, 'a.jar')
      const finished = new Set<string>()

      await expect(
        downloadInstanceFiles(
          [
            {
              options: {
                url: [`${baseUrl}/a.jar`],
                destination: dest,
                expectedTotal: wrongContent.length,
              },
              file: {
                path: 'a.jar',
                hashes: { sha1: sha1(expectedContent) },
                downloads: [`${baseUrl}/a.jar`],
              },
            },
          ],
          finished,
          new AbortController().signal,
          {},
        ),
      ).rejects.toThrow()

      expect(finished.has('a.jar')).toBe(false)
      // Destination must not contain attacker content
      if (await pathExists(dest)) {
        const content = (await readFile(dest)).toString()
        expect(content).not.toBe(wrongContent)
      }
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects downloads when only sha256 is provided and content does not match', async () => {
    const wrongContent = 'WRONG-256'
    const { server, baseUrl } = await startServer(wrongContent)
    const dir = await mkdtemp(join(tmpdir(), 'xmcl-dl-256-'))
    try {
      const dest = join(dir, 'a.jar')
      const finished = new Set<string>()
      const expectedSha256 = createHash('sha256').update('CORRECT-256').digest('hex')

      await expect(
        downloadInstanceFiles(
          [
            {
              options: {
                url: [`${baseUrl}/a.jar`],
                destination: dest,
                expectedTotal: wrongContent.length,
              },
              file: {
                path: 'a.jar',
                hashes: { sha256: expectedSha256 },
                downloads: [`${baseUrl}/a.jar`],
              },
            },
          ],
          finished,
          new AbortController().signal,
          {},
        ),
      ).rejects.toThrow()
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('verifies the strongest hash even for a known HTTPS CDN and a matching weaker hash', async () => {
    const wrongContent = 'BAD-BYTES'
    const expectedContent = 'EXPECTED-MOD-CONTENT'
    const dispatcher = new MockAgent()
    dispatcher.disableNetConnect()
    dispatcher.get('https://cdn.modrinth.com').intercept({ path: '/a.jar' }).reply(200, wrongContent, {
      headers: { 'content-length': String(wrongContent.length) },
    })
    const dir = await mkdtemp(join(tmpdir(), 'xmcl-dl-trust-'))
    try {
      const dest = join(dir, 'a.jar')
      const finished = new Set<string>()

      await expect(downloadInstanceFiles(
        [
          {
            options: {
              url: ['https://cdn.modrinth.com/a.jar'],
              destination: dest,
              expectedTotal: wrongContent.length,
            },
            file: {
              path: 'a.jar',
              hashes: {
                sha512: createHash('sha512').update(expectedContent).digest('hex'),
                sha1: sha1(wrongContent),
              },
            },
          },
        ],
        finished,
        new AbortController().signal,
        { dispatcher },
      )).rejects.toMatchObject({ errors: [expect.objectContaining({ name: 'ChecksumNotMatchError', algorithm: 'sha512' })] })

      expect(finished.has('a.jar')).toBe(false)
      expect(await pathExists(dest)).toBe(false)
    } finally {
      await dispatcher.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('verifies downloads with fallback URLs', async () => {
    const wrongContent = 'BAD-BYTES'
    const expectedContent = 'EXPECTED'
    const { server, baseUrl } = await startServer(wrongContent)
    const dir = await mkdtemp(join(tmpdir(), 'xmcl-dl-mixedtrust-'))
    try {
      const dest = join(dir, 'a.jar')
      const finished = new Set<string>()

      await expect(
        downloadInstanceFiles(
          [
            {
              options: {
                url: [`${baseUrl}/a.jar`, 'http://untrusted.example/a.jar'],
                destination: dest,
                expectedTotal: wrongContent.length,
              },
              file: {
                path: 'a.jar',
                hashes: { sha1: sha1(expectedContent) },
                downloads: [`${baseUrl}/a.jar`, 'http://untrusted.example/a.jar'],
              },
            },
          ],
          finished,
          new AbortController().signal,
          {},
        ),
      ).rejects.toThrow()

      expect(finished.has('a.jar')).toBe(false)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('verifies HTTP downloads', async () => {
    const wrongContent = 'BAD-BYTES'
    const expectedContent = 'EXPECTED'
    const { server, baseUrl } = await startServer(wrongContent)
    const dir = await mkdtemp(join(tmpdir(), 'xmcl-dl-http-'))
    try {
      const dest = join(dir, 'a.jar')
      const finished = new Set<string>()

      await expect(
        downloadInstanceFiles(
          [
            {
              options: {
                url: [`${baseUrl}/a.jar`],
                destination: dest,
                expectedTotal: wrongContent.length,
              },
              file: {
                path: 'a.jar',
                hashes: { sha1: sha1(expectedContent) },
                downloads: [`${baseUrl}/a.jar`],
              },
            },
          ],
          finished,
          new AbortController().signal,
          {},
        ),
      ).rejects.toThrow()
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
