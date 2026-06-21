import { describe, it, expect } from 'vitest'
import { createServer, IncomingMessage, ServerResponse, Server } from 'http'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { download } from './download'
import { ProgressTrackerSingle } from './progress'
import type { DownloadController, DownloadResult } from './controller'

interface RouteSpec {
  status?: number
  body?: Buffer | string
  headers?: Record<string, string>
  /**
   * Custom handler — wins over status/body if provided.
   */
  handle?: (req: IncomingMessage, res: ServerResponse) => void
}

async function startServer(routes: Record<string, RouteSpec>) {
  const server: Server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    const route = routes[path]
    if (!route) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    if (route.handle) {
      route.handle(req, res)
      return
    }
    res.writeHead(route.status ?? 200, route.headers ?? {})
    res.end(route.body ?? '')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as any).port
  return { server, baseUrl: `http://127.0.0.1:${port}` }
}

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'xmcl-ft-'))
}

describe('@xmcl/file-transfer download', () => {
  it('downloads a basic 200 response into the destination', async () => {
    const content = 'hello world'
    const { server, baseUrl } = await startServer({
      '/a': {
        status: 200,
        body: content,
        headers: { 'Content-Length': Buffer.byteLength(content).toString() },
      },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'a.txt')
      await download({ url: `${baseUrl}/a`, destination: dest })
      expect((await readFile(dest)).toString()).toBe(content)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  /**
   * BUG F1 — When the server returns an HTTP error (4xx/5xx), the
   * inner `RangeRequestHandler.onHeaders` rejects the parent's
   * resolver before `onHeaderParsed` runs. As a result
   * `childrenResolvers` is never resolved/rejected, and the
   * `Promise.allSettled([resolvers, childrenResolvers]).finally(... done = true)`
   * wiring on the tracker never fires.
   *
   * The download() promise rejects (so the caller sees the error),
   * but `tracker.done` stays false forever, and the inner
   * Promise.allSettled retains both promises preventing GC.
   *
   * Expected: tracker.done becomes true on terminal HTTP errors too.
   */
  it('marks tracker.done on HTTP 4xx error responses', async () => {
    const { server, baseUrl } = await startServer({
      '/missing': { status: 404, body: 'not found' },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'missing.bin')
      const tracker = new ProgressTrackerSingle()
      await expect(
        download({ url: `${baseUrl}/missing`, destination: dest, tracker }),
      ).rejects.toThrow()

      // Give microtasks a chance to flush the .finally
      await new Promise((r) => setImmediate(r))
      expect(tracker.done).toBe(true)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  /**
   * BUG F4 — A misbehaving server can return 206 Partial Content
   * without a Content-Range header. The current code does
   * `contentRange.match(...)` unconditionally, throwing
   * "Cannot read property 'match' of undefined" — the error is
   * surfaced as a generic JS TypeError instead of a clean
   * download error.
   *
   * Expected: the request fails cleanly (rejects) without a
   * TypeError.
   */
  it('handles 206 responses with a missing Content-Range header without throwing TypeError', async () => {
    const { server, baseUrl } = await startServer({
      '/bad-206': {
        handle: (_req, res) => {
          // No Content-Range header — malformed
          res.writeHead(206, { 'Content-Length': '5' })
          res.end('hello')
        },
      },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'a.bin')
      const result = await download({ url: `${baseUrl}/bad-206`, destination: dest }).catch(
        (e) => e,
      )

      // It MUST reject (no Content-Range = unparseable response), and
      // the error must not be a raw TypeError from optional chaining.
      expect(result).toBeInstanceOf(Error)
      expect((result as Error).constructor.name).not.toBe('TypeError')
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  /**
   * Regression for f72ae9fc: undici's retry interceptor re-issues a
   * dropped download with `Range: bytes=<consumed>-`. If the origin
   * cannot honour that range (replies fresh 200), it throws
   * `RequestRetryError` and the partial bytes we already wrote to the
   * destination are stale. We expect download() to truncate the fd and
   * restart the same URL from byte 0 exactly once, so the file ends
   * with the correct full content rather than failing or producing a
   * shifted/duplicated body.
   */
  it('rewinds the destination and retries once when undici reports range-retry failure', async () => {
    const fullBody = Buffer.alloc(2048)
    for (let i = 0; i < fullBody.length; i++) fullBody[i] = i & 0xff
    let reqCount = 0
    const { server, baseUrl } = await startServer({
      '/flaky': {
        handle: (req, res) => {
          reqCount++
          if (reqCount === 1) {
            // Promise the full length, write a partial chunk, then kill
            // the socket so undici observes a body-too-short / socket
            // error and triggers its retry interceptor.
            res.writeHead(200, { 'Content-Length': fullBody.length.toString() })
            res.write(fullBody.subarray(0, 256))
            setImmediate(() => req.socket.destroy())
            return
          }
          if (reqCount === 2) {
            // undici retries with `Range: bytes=256-`. Reply with a
            // fresh 200 (no Range support) — this is exactly the
            // pattern that surfaces in production telemetry as
            // UND_ERR_REQ_RETRY "server does not support the range
            // header and the payload was partially consumed".
            res.writeHead(200, { 'Content-Length': fullBody.length.toString() })
            res.end(fullBody)
            return
          }
          // Our rewind dispatches a fresh request — serve the full body.
          res.writeHead(200, { 'Content-Length': fullBody.length.toString() })
          res.end(fullBody)
        },
      },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'flaky.bin')
      await download({ url: `${baseUrl}/flaky`, destination: dest })
      const written = await readFile(dest)
      expect(written.length).toBe(fullBody.length)
      expect(written.equals(fullBody)).toBe(true)
      // At least: initial attempt + undici's range retry + our rewind.
      expect(reqCount).toBeGreaterThanOrEqual(3)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  /**
   * Companion to the rewind regression: only one rewind is allowed per
   * URL, so if the range-retry condition keeps reproducing on the same
   * URL, download() must give up and propagate the error rather than
   * loop forever.
   */
  it('does not loop forever if the range-retry condition repeats on the same URL', async () => {
    const fullBody = Buffer.alloc(1024, 0xcd)
    let reqCount = 0
    const { server, baseUrl } = await startServer({
      '/always-bad': {
        handle: (req, res) => {
          reqCount++
          // Every attempt: partial body then socket reset.
          res.writeHead(200, { 'Content-Length': fullBody.length.toString() })
          res.write(fullBody.subarray(0, 128))
          setImmediate(() => req.socket.destroy())
        },
      },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'bad.bin')
      const err = await download({ url: `${baseUrl}/always-bad`, destination: dest }).catch(
        (e) => e,
      )
      expect(err).toBeInstanceOf(Error)
      // Loose upper bound: initial + undici retries (≤3) + 1 rewind +
      // its undici retries (≤3) = ≤8. The exact number depends on
      // undici's retry interceptor; the important thing is it isn't
      // unbounded.
      expect(reqCount).toBeLessThanOrEqual(12)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('@xmcl/file-transfer download (controller)', () => {
  /**
   * A Range-capable server that dribbles every response a few bytes at a
   * time so the controller's sampler has time to fire (and possibly
   * abort) on both the first attempt and any resumed `Range: bytes=N-`
   * attempt. Resumed requests are served as 206 from N.
   */
  function rangeServer(full: Buffer) {
    let requests = 0
    const dribble = (req: IncomingMessage, res: ServerResponse, slice: Buffer) => {
      const chunkSize = Math.max(1, Math.ceil(slice.length / 8))
      res.write(slice.subarray(0, chunkSize))
      let i = chunkSize
      const timer = setInterval(() => {
        if (res.writableEnded || res.destroyed) {
          clearInterval(timer)
          return
        }
        if (i >= slice.length) {
          clearInterval(timer)
          res.end()
          return
        }
        res.write(slice.subarray(i, i + chunkSize))
        i += chunkSize
      }, 10)
      req.on('close', () => clearInterval(timer))
    }
    return {
      get requests() {
        return requests
      },
      routes: {
        '/r': {
          handle: (req: IncomingMessage, res: ServerResponse) => {
            requests++
            const range = req.headers['range']
            if (typeof range === 'string') {
              const m = /bytes=(\d+)-/.exec(range)
              const start = m ? parseInt(m[1], 10) : 0
              const slice = full.subarray(start)
              res.writeHead(206, {
                'Accept-Ranges': 'bytes',
                'Content-Range': `bytes ${start}-${full.length - 1}/${full.length}`,
                'Content-Length': String(slice.length),
              })
              dribble(req, res, slice)
              return
            }
            res.writeHead(200, {
              'Accept-Ranges': 'bytes',
              'Content-Length': String(full.length),
            })
            dribble(req, res, full)
          },
        },
      },
    }
  }

  it('resumes from the partial bytes after a controller-requested abort', async () => {
    const full = Buffer.alloc(256)
    for (let i = 0; i < full.length; i++) full[i] = (i * 7) & 0xff
    const srv = rangeServer(full)
    const { server, baseUrl } = await startServer(srv.routes)
    const dir = await tempDir()

    let sampled = 0
    const reports: DownloadResult[] = []
    const controller: DownloadController = {
      sampleInterval: 15,
      warmup: 0,
      maxResumes: 5,
      onSample: () => (++sampled === 1 ? 'abort' : 'continue'),
      report: (r) => reports.push(r),
    }

    try {
      const dest = join(dir, 'r.bin')
      await download({ url: `${baseUrl}/r`, destination: dest, controller, expectedTotal: full.length })

      const written = await readFile(dest)
      expect(written.equals(full)).toBe(true)
      // At least one abort + one resuming request.
      expect(srv.requests).toBeGreaterThanOrEqual(2)
      expect(reports.some((r) => r.outcome === 'aborted')).toBe(true)
      expect(reports.some((r) => r.outcome === 'completed')).toBe(true)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('completes normally and reports once when the controller never aborts', async () => {
    const content = 'controller-pass-through'
    const { server, baseUrl } = await startServer({
      '/a': {
        status: 200,
        body: content,
        headers: { 'Content-Length': Buffer.byteLength(content).toString() },
      },
    })
    const dir = await tempDir()
    const reports: DownloadResult[] = []
    const controller: DownloadController = {
      sampleInterval: 1000,
      onSample: () => 'continue',
      report: (r) => reports.push(r),
    }
    try {
      const dest = join(dir, 'a.txt')
      const tracker = new ProgressTrackerSingle()
      await download({ url: `${baseUrl}/a`, destination: dest, controller, tracker })
      expect((await readFile(dest)).toString()).toBe(content)
      expect(reports).toHaveLength(1)
      expect(reports[0].outcome).toBe('completed')
      await new Promise((r) => setImmediate(r))
      expect(tracker.done).toBe(true)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('commits to finishing (never fails) after the resume budget is exhausted', async () => {
    // A managed abort is an optimization, not a hard failure. Once the
    // re-roll budget is spent the download must COMMIT to finishing on a
    // working (if slow) connection rather than rejecting — otherwise the
    // adaptive controller could abort a perfectly good download to death.
    const full = Buffer.alloc(256)
    for (let i = 0; i < full.length; i++) full[i] = (i * 7) & 0xff
    const srv = rangeServer(full)
    const { server, baseUrl } = await startServer(srv.routes)
    const dir = await tempDir()
    const controller: DownloadController = {
      sampleInterval: 15,
      warmup: 0,
      maxResumes: 2,
      onSample: () => 'abort', // always abort
    }
    try {
      const dest = join(dir, 'r.bin')
      await download({
        url: `${baseUrl}/r`,
        destination: dest,
        controller,
        expectedTotal: full.length,
      })
      // It completes correctly despite the controller always asking to abort.
      expect((await readFile(dest)).equals(full)).toBe(true)
      // Bounded: maxResumes (2) re-rolls + the committed finishing attempt.
      expect(srv.requests).toBeLessThanOrEqual(6)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('@xmcl/file-transfer download (controller range-split)', () => {
  function serveRange(
    full: Buffer,
    req: IncomingMessage,
    res: ServerResponse,
    support206 = true,
  ) {
    const range = req.headers['range']
    if (support206 && typeof range === 'string') {
      const m = /bytes=(\d+)-(\d*)/.exec(range)
      const start = m ? parseInt(m[1], 10) : 0
      const end = m && m[2] ? parseInt(m[2], 10) : full.length - 1
      const slice = full.subarray(start, end + 1)
      res.writeHead(206, {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${full.length}`,
        'Content-Length': String(slice.length),
      })
      res.end(slice)
    } else {
      res.writeHead(200, { 'Content-Length': String(full.length) })
      res.end(full)
    }
  }

  function patterned(size: number) {
    const b = Buffer.alloc(size)
    for (let i = 0; i < size; i++) b[i] = (i * 131) & 0xff
    return b
  }

  const splitController: DownloadController = {
    onSample: () => 'continue',
    rangeSplitThreshold: 1024,
    rangeConcurrency: 4,
  }

  it('range-splits a large file into parallel segments and reconstructs it', async () => {
    const full = patterned(8 * 1024)
    const ranges: string[] = []
    let requests = 0
    const { server, baseUrl } = await startServer({
      '/f': {
        handle: (req, res) => {
          requests++
          if (typeof req.headers.range === 'string') ranges.push(req.headers.range)
          serveRange(full, req, res)
        },
      },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'f.bin')
      await download({
        url: `${baseUrl}/f`,
        destination: dest,
        controller: splitController,
        expectedTotal: full.length,
      })
      expect((await readFile(dest)).equals(full)).toBe(true)
      // 4 parallel segments => 4 ranged requests, each a distinct range.
      expect(requests).toBe(4)
      expect(new Set(ranges).size).toBe(4)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('reconstructs a ranged download across redirects (bmcl-like)', async () => {
    const full = patterned(8 * 1024)
    let bmclHits = 0
    const mirrorRanges: string[] = []
    const { server, baseUrl } = await startServer({
      '/bmcl': {
        handle: (_req, res) => {
          bmclHits++
          res.writeHead(302, { Location: '/mirror' })
          res.end()
        },
      },
      '/mirror': {
        handle: (req, res) => {
          if (typeof req.headers.range === 'string') mirrorRanges.push(req.headers.range)
          serveRange(full, req, res)
        },
      },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'f.bin')
      await download({
        url: `${baseUrl}/bmcl`,
        destination: dest,
        controller: splitController,
        expectedTotal: full.length,
      })
      expect((await readFile(dest)).equals(full)).toBe(true)
      // Each segment is its own request through the redirect, mirroring
      // how bmcl re-assigns a mirror per request.
      expect(bmclHits).toBe(4)
      expect(new Set(mirrorRanges).size).toBe(4)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('falls back to a single stream when a mirror ignores Range', async () => {
    const full = patterned(8 * 1024)
    const { server, baseUrl } = await startServer({
      '/f': {
        handle: (req, res) => serveRange(full, req, res, false), // always 200
      },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'f.bin')
      await download({
        url: `${baseUrl}/f`,
        destination: dest,
        controller: splitController,
        expectedTotal: full.length,
      })
      expect((await readFile(dest)).equals(full)).toBe(true)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('re-rolls and resumes a single slow segment without corrupting the file', async () => {
    const full = patterned(16 * 1024)
    let requests = 0
    // Dribble each 206 response so the sampler can fire and abort.
    const dribbleRange = (req: IncomingMessage, res: ServerResponse) => {
      requests++
      const range = req.headers['range']
      const m = typeof range === 'string' ? /bytes=(\d+)-(\d*)/.exec(range) : null
      const start = m ? parseInt(m[1], 10) : 0
      const end = m && m[2] ? parseInt(m[2], 10) : full.length - 1
      const slice = full.subarray(start, end + 1)
      res.writeHead(206, {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${full.length}`,
        'Content-Length': String(slice.length),
      })
      const step = Math.max(1, Math.ceil(slice.length / 8))
      res.write(slice.subarray(0, step))
      let i = step
      const timer = setInterval(() => {
        if (res.writableEnded || res.destroyed) return clearInterval(timer)
        if (i >= slice.length) {
          clearInterval(timer)
          return res.end()
        }
        res.write(slice.subarray(i, i + step))
        i += step
      }, 8)
      req.on('close', () => clearInterval(timer))
    }
    const { server, baseUrl } = await startServer({ '/f': { handle: dribbleRange } })
    const dir = await tempDir()
    let samples = 0
    const controller: DownloadController = {
      sampleInterval: 15,
      warmup: 0,
      maxResumes: 5,
      rangeSplitThreshold: 1024,
      rangeConcurrency: 4,
      // Abort exactly the first segment that gets sampled, once.
      onSample: () => (++samples === 1 ? 'abort' : 'continue'),
    }
    try {
      const dest = join(dir, 'f.bin')
      await download({
        url: `${baseUrl}/f`,
        destination: dest,
        controller,
        expectedTotal: full.length,
      })
      expect((await readFile(dest)).equals(full)).toBe(true)
      // 4 segments + at least one resumed segment.
      expect(requests).toBeGreaterThanOrEqual(5)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('resumes when a mirror returns a SHORT 206 range (no zero-filled gap)', async () => {
    // Regression for the forge "received empty data" corruption: a mirror
    // that answers a ranged request with fewer bytes than asked for (a
    // valid but short 206) must NOT be treated as complete — the missing
    // tail has to be resumed, otherwise the file keeps zero-filled holes.
    const full = patterned(8 * 1024)
    const MAX_PIECE = 700 // server never serves more than this per request
    let requests = 0
    const { server, baseUrl } = await startServer({
      '/f': {
        handle: (req, res) => {
          requests++
          const range = req.headers['range']
          const m = typeof range === 'string' ? /bytes=(\d+)-(\d*)/.exec(range) : null
          const start = m ? parseInt(m[1], 10) : 0
          const reqEnd = m && m[2] ? parseInt(m[2], 10) : full.length - 1
          // Deliberately under-deliver: cap the served range.
          const end = Math.min(reqEnd, start + MAX_PIECE - 1)
          const slice = full.subarray(start, end + 1)
          res.writeHead(206, {
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${full.length}`,
            'Content-Length': String(slice.length),
          })
          res.end(slice)
        },
      },
    })
    const dir = await tempDir()
    const controller: DownloadController = {
      onSample: () => 'continue',
      rangeSplitThreshold: 1024,
      rangeConcurrency: 4,
      maxResumes: 100,
    }
    try {
      const dest = join(dir, 'f.bin')
      await download({
        url: `${baseUrl}/f`,
        destination: dest,
        controller,
        expectedTotal: full.length,
      })
      const written = await readFile(dest)
      expect(written.length).toBe(full.length)
      expect(written.equals(full)).toBe(true)
      // Each 2 KiB segment needs several 700-byte pieces to complete.
      expect(requests).toBeGreaterThan(4)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})




