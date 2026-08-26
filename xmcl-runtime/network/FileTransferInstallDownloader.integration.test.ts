import { Dispatcher, Agent } from 'undici'
import { createServer } from 'http'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, test } from 'vitest'
import type { DownloadController } from '@xmcl/file-transfer'
import { ProgressTrackerMultiple } from '@xmcl/installer'
import { createFileTransferInstallDownloader } from './FileTransferInstallDownloader'

class LocalDispatcher extends Dispatcher {
  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly origin: string,
  ) {
    super()
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler): boolean {
    return this.dispatcher.dispatch({ ...options, origin: this.origin }, handler)
  }

  close(): Promise<void> {
    return this.dispatcher.close()
  }
}

describe('FileTransferInstallDownloader integration', () => {
  test('uses the adaptive range path only for BMCL files in a mixed batch', async () => {
    const bmclContent = Buffer.alloc(4 * 1024, 0xab)
    const officialContent = Buffer.alloc(4 * 1024, 0xcd)
    const bmclRanges: Array<string | undefined> = []
    const officialRanges: Array<string | undefined> = []
    const server = createServer((req, res) => {
      const content = req.url === '/bmcl' ? bmclContent : officialContent
      const ranges = req.url === '/bmcl' ? bmclRanges : officialRanges
      const range = req.headers.range
      ranges.push(range)
      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range)
        const start = Number(match?.[1] ?? 0)
        const end = match?.[2] ? Number(match[2]) : content.length - 1
        const slice = content.subarray(start, end + 1)
        res.writeHead(206, {
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${content.length}`,
          'Content-Length': String(slice.length),
        })
        res.end(slice)
        return
      }
      res.writeHead(200, { 'Content-Length': String(content.length) })
      res.end(content)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected a TCP server address')

    const dir = await mkdtemp(join(tmpdir(), 'xmcl-install-download-'))
    const dispatcher = new LocalDispatcher(new Agent(), `http://127.0.0.1:${address.port}`)
    const controller: DownloadController = {
      rangeSplitThreshold: 1024,
      rangeConcurrency: 2,
    }
    const downloader = createFileTransferInstallDownloader({
      dispatcher,
      rangePolicy: { rangeThreshold: Number.MAX_SAFE_INTEGER },
    }, controller)
    const tracker = new ProgressTrackerMultiple()

    try {
      const bmclDestination = join(dir, 'bmcl.bin')
      const officialDestination = join(dir, 'official.bin')
      await downloader.download([
        {
          path: bmclDestination,
          urls: ['http://bmclapi2.bangbang93.com/bmcl'],
          size: bmclContent.length,
        },
        {
          path: officialDestination,
          urls: ['https://piston-data.mojang.com/official'],
          size: officialContent.length,
        },
      ], { tracker })

      expect((await readFile(bmclDestination)).equals(bmclContent)).toBe(true)
      expect((await readFile(officialDestination)).equals(officialContent)).toBe(true)
      expect(bmclRanges).toHaveLength(2)
      expect(new Set(bmclRanges).size).toBe(2)
      expect(officialRanges).toEqual([undefined])
      expect(tracker.trackers).toHaveLength(2)
      expect(tracker.progress).toBe(bmclContent.length + officialContent.length)
      expect(tracker.total).toBe(bmclContent.length + officialContent.length)
    } finally {
      await dispatcher.close()
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})