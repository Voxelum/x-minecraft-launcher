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

    sess.webRequest.onHeadersReceived((detail, cb) => {
      if (detail.responseHeaders &&
        !detail.responseHeaders['access-control-allow-origin'] &&
        !detail.responseHeaders['Access-Control-Allow-Origin']) {
        detail.responseHeaders['access-control-allow-origin'] = ['*']
      }

      cb({ responseHeaders: detail.responseHeaders })
    })

    sess.webRequest.onBeforeSendHeaders((detail, cb) => {
      if (detail.requestHeaders) {
        detail.requestHeaders['User-Agent'] = ua
      }
      if (detail.url.startsWith('https://api.xmcl.app/modrinth') ||
        detail.url.startsWith('https://api.xmcl.app/curseforge') ||
        detail.url.startsWith('https://xmcl-web-api--dogfood.deno.dev') ||
        detail.url.startsWith('https://api.xmcl.app/rtc/official')
      ) {
        this.app.registry.get(UserService).then(userService => {
          userService.getOfficialUserProfile().then(profile => {
            if (profile && profile.accessToken) {
              detail.requestHeaders.Authorization = `Bearer ${profile.accessToken}`
            }
            cb({ requestHeaders: detail.requestHeaders })
          }).catch(() => {
            cb({ requestHeaders: detail.requestHeaders })
          })
        }).catch(e => {
          cb({ requestHeaders: detail.requestHeaders })
        })
      } else if (detail.url.startsWith('https://api.curseforge.com')) {
        detail.requestHeaders['x-api-key'] = process.env.CURSEFORGE_API_KEY || ''
        cb({ requestHeaders: detail.requestHeaders })
      } else {
        cb({ requestHeaders: detail.requestHeaders })
      }
    })

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
      const response = await this.app.protocol.handle({
        url: new URL(url),
        method: request.method,
        headers: request.headers,
        body: request.body ? Readable.fromWeb(request.body as any) : request.body as any,
      })
      return new Response(response.body instanceof Readable ? Readable.toWeb(response.body) as any : response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    sess.protocol.handle('http', handler)

    this.cached[url] = sess

    return sess
  }
}
