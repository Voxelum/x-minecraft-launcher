import { Readable } from 'stream'
import { fetch } from 'undici'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'

/**
 * The plugin to handle builtin icons
 */
export const pluginCommonProtocol: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request, response }) => {
    if (request.url.host === 'launcher') return
    const body = request.body
    try {
      const resp = await app.fetch(request.url.toString(), {
        headers: request.headers,
        method: request.method,
        body: body instanceof Readable ? Readable.toWeb(body) as any : body,
        redirect: 'follow',
      })
      response.status = resp.status
      response.headers = resp.headers
      response.body = resp.body instanceof ReadableStream ? Readable.fromWeb(resp.body as any) : (resp.body ?? undefined)
    } catch (e) {
      const resp = await fetch(request.url.toString(), {
        headers: request.headers,
        method: request.method,
        body: body instanceof Readable ? Readable.toWeb(body) as any : body,
        redirect: 'follow',
      })
      response.status = resp.status
      response.headers = resp.headers
      response.body = resp.body instanceof ReadableStream ? Readable.fromWeb(resp.body as any) : (resp.body as any ?? undefined)
    }
  }
  app.protocol.registerHandler('http', handler)
  app.protocol.registerHandler('https', handler)
}
