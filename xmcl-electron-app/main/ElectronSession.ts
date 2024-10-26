import { Session, session } from 'electron'
import ElectronLauncherApp from './ElectronLauncherApp'
import { UserService } from '@xmcl/runtime/user'
import { HAS_DEV_SERVER, HOST } from './constant'
import { join } from 'path'
import { Readable } from 'stream'
import { createReadStream } from 'fs-extra'
import { existsSync } from 'fs'

export class ElectronSession {
  private cached: Record<string, Session> = {}

  constructor(private app: ElectronLauncherApp) { }

  #resolve(url: string): Session {
    const parsed = new URL(url)
    if (parsed.hostname === HOST) {
      if (existsSync(join(this.app.appDataPath, 'Partitions', 'main'))) {
        return session.fromPartition('persist:main')
      } else {
        return session.defaultSession
      }
    }
    return session.fromPartition(`persist:${parsed.hostname}`)
  }

  getSession(url: string) {
    if (this.cached[url]) {
      return this.cached[url]
    }

    const ua = this.app.userAgent
    const sess = this.#resolve(url)

    sess.setUserAgent(ua)

    if (sess !== session.defaultSession) {
      for (const e of session.defaultSession.getAllExtensions()) {
        sess.loadExtension(e.path)
      }
    }

    const handler = async (request: Request): Promise<Response> => {
      const url = new URL(request.url)
      if (url.host === HOST && !HAS_DEV_SERVER) {
        const realPath = join(__dirname, 'renderer', url.pathname)
        const mimeType =
          url.pathname.endsWith('.js')
            ? 'text/javascript'
            : url.pathname.endsWith('.css')
              ? 'text/css'
              : url.pathname.endsWith('.html')
                ? 'text/html'
                : url.pathname.endsWith('.json')
                  ? 'application/json'
                  : url.pathname.endsWith('.png')
                    ? 'image/png'
                    : url.pathname.endsWith('.svg')
                      ? 'image/svg+xml'
                      : url.pathname.endsWith('.ico')
                        ? 'image/x-icon'
                        : url.pathname.endsWith('.woff')
                          ? 'font/woff'
                          : url.pathname.endsWith('.woff2')
                            ? 'font/woff2'
                            : url.pathname.endsWith('.ttf')
                              ? 'font/ttf'
                              // webp
                              : url.pathname.endsWith('.webp') ? 'image/webp' : ''
        return new Response(Readable.toWeb(createReadStream(realPath)) as any, {
          headers: {
            'Content-Type': mimeType,
          },
        })
      }
      request.headers.append('User-Agent', ua)

      if (request.url.startsWith('https://api.xmcl.app/translation') ||
        request.url.startsWith('https://xmcl-web-api--dogfood.deno.dev') ||
        request.url.startsWith('https://api.xmcl.app/rtc/official')
      ) {
        const userService = await this.app.registry.get(UserService)
        const profile = await userService.getOfficialUserProfile().catch(() => undefined)
        if (profile && profile.accessToken) {
          request.headers.set('Authorization', `Bearer ${profile.accessToken}`)
        }
      } else if (request.url.startsWith('https://api.curseforge.com')) {
        request.headers.set('x-api-key', process.env.CURSEFORGE_API_KEY || '')
      }

      const response = await this.app.protocol.handle({
        url: new URL(url),
        method: request.method,
        headers: request.headers,
        body: request.body ? Readable.fromWeb(request.body as any) : request.body as any,
      })

      response.headers['access-control-allow-origin'] = ['*']

      return new Response(response.body instanceof Readable ? Readable.toWeb(response.body) as any : response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    sess.protocol.handle('http', handler)
    sess.protocol.handle('https', handler)

    this.cached[url] = sess

    return sess
  }
}
