import { Readable } from 'stream'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'

/**
 * The plugin to handle all fallback http request
 */
export const pluginCommonProtocol: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request, response }) => {
    if (request.url.host === 'launcher') return
    if (response.status) return
    const body = request.body
    try {
      const resp = await app.fetch(request.url.toString(), {
        headers: request.headers,
        method: request.method,
        body: body instanceof Readable ? Readable.toWeb(body) as any : body,
        redirect: 'follow',
        // @ts-ignore
        duplex: body ? 'half' : undefined,
      })
      response.status = resp.status
      response.headers = resp.headers
      response.body = resp.body instanceof ReadableStream ? Readable.fromWeb(resp.body as any) : (resp.body ?? undefined)
    } catch (e) {
      throw e
    }
  }
  app.protocol.registerHandler('http', handler, true)
  app.protocol.registerHandler('https', handler, true)
}
