import { createReadStream, existsSync } from 'fs'
import { createServer, Server } from 'http'
import { AddressInfo } from 'net'
import { extname, join, normalize, resolve, sep } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { LauncherProtocolHandler } from '@xmcl/runtime/app'

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
}

/**
 * Serves the renderer bundle to the webview and forwards everything else to the
 * launcher protocol handler.
 *
 * This replaces `ElectronSession`'s request interception: Electron answered the
 * `xmcl.runtime` origin from `__dirname/renderer` inside the session, and sent
 * every other request through `app.protocol.handle`. WebKitGTK has no
 * equivalent hook we can reach from Node, so the same two routes are served
 * over loopback HTTP instead, and the webview simply loads that origin.
 */
export class RendererServer {
  private protocol: LauncherProtocolHandler | undefined

  private readonly http: Server = createServer((req, res) => {
    void this.serve(req.method ?? 'GET', req.url ?? '/', req, res).catch(() => {
      res.statusCode = 500
      res.end()
    })
  })

  constructor(private readonly dist: string) {}

  /** Route non-asset requests once the runtime is constructed. */
  setProtocol(protocol: LauncherProtocolHandler) {
    this.protocol = protocol
  }

  async listen() {
    await new Promise<void>((res, rej) => {
      this.http.once('error', rej)
      this.http.listen(0, '127.0.0.1', () => {
        this.http.removeListener('error', rej)
        res()
      })
    })
    return (this.http.address() as AddressInfo).port
  }

  close() {
    return new Promise<void>((res) => this.http.close(() => res()))
  }

  private async serve(method: string, rawUrl: string, req: import('http').IncomingMessage, res: import('http').ServerResponse) {
    const url = new URL(rawUrl, 'http://127.0.0.1')
    const file = this.resolveAsset(url.pathname)
    if (file) {
      res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
      await pipeline(createReadStream(file), res).catch(() => {
        if (!res.headersSent) res.writeHead(404)
        res.end()
      })
      return
    }

    if (!this.protocol) {
      res.writeHead(404).end()
      return
    }

    const response = await this.protocol.handle({
      method,
      url: new URL(url.pathname + url.search, 'xmcl://launcher'),
      headers: req.headers as Record<string, any>,
      body: req,
    })
    res.statusCode = response.status
    for (const [k, v] of Object.entries(response.headers)) {
      res.setHeader(k, v as any)
    }
    if (response.body instanceof Readable) {
      await pipeline(response.body, res)
    } else {
      res.end(response.body)
    }
  }

  /**
   * Only paths that stay inside the renderer directory are served — the webview
   * is a browser, and this server listens on a port any local process can hit.
   */
  private resolveAsset(pathname: string) {
    if (pathname === '/') pathname = '/index.html'
    if (!/\.[a-z0-9]+$/i.test(pathname)) return undefined
    const root = resolve(this.dist)
    const target = resolve(join(root, normalize(pathname)))
    if (target !== root && !target.startsWith(root + sep)) return undefined
    return existsSync(target) ? target : undefined
  }
}
