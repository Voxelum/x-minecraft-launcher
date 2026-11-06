import { download } from '@xmcl/file-transfer'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { Agent } from 'undici'
import { describe, expect, it, vi } from 'vitest'
import {
  createDatabaseDownloadController,
  databaseAssetExists,
  fetchDatabaseText,
  getModMetadataDownloadUrls,
  getProjectMappingDownloadUrls,
} from './databaseDownload'

describe('database downloads', () => {
  it('requests nothing without a Vardrynn service origin', async () => {
    expect(getModMetadataDownloadUrls(undefined, 'db.sqlite')).toEqual([])
    expect(getProjectMappingDownloadUrls(undefined, 'zh-cn.sqlite.gz')).toEqual([])
    const fetcher = vi.fn()
    await expect(fetchDatabaseText(fetcher, [])).rejects.toThrow('No database metadata source is configured')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('uses only the Vardrynn service database route', () => {
    expect(getModMetadataDownloadUrls('https://api.olaveapi.com', 'db.sqlite.sha1')).toEqual([
      'https://api.olaveapi.com/v1/databases/mod-metadata/db.sqlite.sha1',
    ])
    expect(getProjectMappingDownloadUrls('http://localhost:8787', 'zh-cn.sqlite.gz')).toEqual([
      'http://localhost:8787/v1/databases/project-mapping/zh-cn.sqlite.gz',
    ])
    expect(getProjectMappingDownloadUrls('https://api.olaveapi.com', '../x/y')[0]).toBe(
      'https://api.olaveapi.com/v1/databases/project-mapping/..%2Fx%2Fy',
    )
  })

  it('trims the checksum text', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(' checksum\n'))
    await expect(fetchDatabaseText(fetcher, ['https://api.olaveapi.com/db'])).resolves.toBe('checksum')
  })

  it('treats a 404 as a missing locale', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    await expect(databaseAssetExists(fetcher, ['https://api.olaveapi.com/missing'])).resolves.toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('lets the single source finish instead of aborting slow downloads', () => {
    const controller = createDatabaseDownloadController()
    expect(controller.isAbortable?.('https://api.olaveapi.com')).toBe(false)
    expect(controller.onSample).toBeUndefined()
  })

  it.each([false, true])('downloads a valid gzip database without a known size (fallback: %s)', async (fallback) => {
    const data = Buffer.from('project mapping database payload')
    const compressed = gzipSync(data)
    const requests: string[] = []
    const server = createServer((req, res) => {
      requests.push(req.url!)
      if (fallback && req.url === '/primary') {
        res.writeHead(503)
        res.end()
        return
      }
      res.writeHead(200, { 'Content-Length': String(compressed.length) })
      res.end(compressed)
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close()
      throw new Error('Expected a TCP address for the database download server')
    }
    const baseUrl = `http://127.0.0.1:${address.port}`
    const dir = await mkdtemp(join(tmpdir(), 'xmcl-db-download-'))
    const dispatcher = new Agent()
    try {
      const destination = join(dir, 'project-mapping.sqlite.download.gz')
      await download({
        url: [`${baseUrl}/primary`, `${baseUrl}/fallback`],
        destination,
        dispatcher,
        controller: createDatabaseDownloadController(),
      })

      const downloaded = await readFile(destination)
      expect(downloaded).toEqual(compressed)
      expect(gunzipSync(downloaded)).toEqual(data)
      expect(requests).toEqual(fallback ? ['/primary', '/fallback'] : ['/primary'])
    } finally {
      await dispatcher.close()
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
