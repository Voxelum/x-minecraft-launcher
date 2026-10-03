import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { downloadModpackUrl } from './downloadModpackUrl'

describe('downloadModpackUrl', () => {
  let directory: string
  let server: Server
  let baseUrl: string
  let content: string
  let requests: number

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'xmcl-modpack-url-'))
    content = 'first version'
    requests = 0
    server = createServer((request, response) => {
      requests++
      if (request.url === '/fail.zip') {
        response.writeHead(404).end('not found')
      } else {
        const body = request.url === '/latest.mrpack' ? content : request.url!
        response.writeHead(200, { 'Content-Length': Buffer.byteLength(body) }).end(body)
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test server address')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await rm(directory, { recursive: true, force: true })
  })

  it('isolates full URL identity rather than reusing an existing basename', async () => {
    await writeFile(join(directory, 'pack.zip'), 'old basename cache')
    const sources = ['/a/pack.zip', '/b/pack.zip', '/a/pack.zip?version=2']
    const destinations = await Promise.all(sources.map(source => downloadModpackUrl(baseUrl + source, directory, {})))
    expect(new Set(destinations).size).toBe(sources.length)
    for (const [index, destination] of destinations.entries()) {
      expect(basename(destination)).toBe('pack.zip')
      expect(basename(dirname(destination))).toMatch(
        new RegExp(`^${createHash('sha256').update(baseUrl + sources[index]).digest('hex')}-`),
      )
      expect(await readFile(destination, 'utf8')).toBe(sources[index])
      expect(await readdir(dirname(destination))).toEqual(['pack.zip'])
    }
    expect(await readFile(join(directory, 'pack.zip'), 'utf8')).toBe('old basename cache')
  })

  it('downloads changed content at the same URL without overwriting an earlier import', async () => {
    const first = await downloadModpackUrl(`${baseUrl}/latest.mrpack`, directory, {})
    content = 'second version'
    const second = await downloadModpackUrl(`${baseUrl}/latest.mrpack`, directory, {})
    expect(first).not.toBe(second)
    expect(basename(second)).toBe('latest.mrpack')
    expect(await readFile(first, 'utf8')).toBe('first version')
    expect(await readFile(second, 'utf8')).toBe('second version')
    expect(requests).toBe(2)
  })

  it('keeps concurrent imports of the same URL and their staging files separate', async () => {
    const destinations = await Promise.all(
      Array.from({ length: 8 }, () => downloadModpackUrl(`${baseUrl}/pack.zip`, directory, {})),
    )
    expect(new Set(destinations).size).toBe(8)
    expect(requests).toBe(8)
    for (const destination of destinations) {
      expect(await readFile(destination, 'utf8')).toBe('/pack.zip')
      expect(await readdir(dirname(destination))).toEqual(['pack.zip'])
    }
  })

  it.each(['/a%20pack.mrpack', '/..%2F..%5Cpack.zip', '/'])('keeps a usable filename inside its attempt directory for %s', async (path) => {
    const destination = await downloadModpackUrl(baseUrl + path, directory, {})
    expect(relative(directory, destination).split(/[\\/]/)).toHaveLength(2)
    expect(basename(destination)).toMatch(/\.(zip|mrpack)$/)
    expect(await readFile(destination, 'utf8')).toBe(path)
  })

  it('removes failed attempts and propagates the download error', async () => {
    await expect(downloadModpackUrl(`${baseUrl}/fail.zip`, directory, {})).rejects.toThrow()
    expect(await readdir(directory)).toEqual([])
  })
})
