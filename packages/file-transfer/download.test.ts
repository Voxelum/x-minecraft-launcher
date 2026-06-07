import { describe, it, expect } from 'vitest'
import { createServer, IncomingMessage, ServerResponse, Server } from 'http'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { download } from './download'
import { ProgressTrackerSingle } from './progress'

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
