import { describe, it, expect } from 'vitest'
import { createServer, IncomingMessage, ServerResponse, Server } from 'http'
import { mkdtemp, rm, writeFile, mkdir, readFile, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { downloadStaged } from './downloadStaged'

interface RouteSpec {
  status?: number
  body?: Buffer | string
  headers?: Record<string, string>
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

const pathExists = async (p: string) =>
  stat(p)
    .then(() => true)
    .catch(() => false)

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'xmcl-staged-'))
}

describe('downloadStaged', () => {
  it('writes to a .pending file and renames into the destination on success', async () => {
    const content = 'hello'
    const { server, baseUrl } = await startServer({
      '/a': {
        status: 200,
        body: content,
        headers: { 'Content-Length': '5' },
      },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'a.bin')
      await downloadStaged({ url: `${baseUrl}/a`, destination: dest })
      expect(await pathExists(dest)).toBe(true)
      expect(await pathExists(dest + '.pending')).toBe(false)
      expect((await readFile(dest)).toString()).toBe(content)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('cleans up .pending and does not create destination when the download fails', async () => {
    const { server, baseUrl } = await startServer({
      '/x': { status: 500, body: 'oops' },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'x.bin')
      await expect(downloadStaged({ url: `${baseUrl}/x`, destination: dest })).rejects.toThrow()
      expect(await pathExists(dest)).toBe(false)
      expect(await pathExists(dest + '.pending')).toBe(false)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  }, 30_000)

  it('replaces an existing destination on success', async () => {
    const newContent = 'NEW'
    const { server, baseUrl } = await startServer({
      '/a': { status: 200, body: newContent, headers: { 'Content-Length': '3' } },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'a.bin')
      await mkdir(dir, { recursive: true })
      await writeFile(dest, 'OLD')

      await downloadStaged({ url: `${baseUrl}/a`, destination: dest })

      expect((await readFile(dest)).toString()).toBe(newContent)
      expect(await pathExists(dest + '.pending')).toBe(false)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('does not leave a partial destination on a fresh-call failure', async () => {
    const { server, baseUrl } = await startServer({
      '/x': { status: 404, body: 'nope' },
    })
    const dir = await tempDir()
    try {
      const dest = join(dir, 'x.bin')
      await expect(downloadStaged({ url: `${baseUrl}/x`, destination: dest })).rejects.toThrow()
      expect(await pathExists(dest)).toBe(false)
      expect(await pathExists(dest + '.pending')).toBe(false)
    } finally {
      server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
