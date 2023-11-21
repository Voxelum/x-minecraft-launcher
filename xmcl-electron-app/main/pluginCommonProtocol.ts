import { Handler, LauncherAppPlugin } from '@xmcl/runtime/app'
import { net } from 'electron'
import { Readable } from 'stream'

/**
 * The plugin to handle builtin icons
 */
export const pluginCommonProtocol: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request, response }) => {
    if (request.url.host === 'launcher') return
    const body = request.body
    const resp = await net.fetch(request.url.toString(), {
      headers: request.headers,
      method: request.method,
      body: body instanceof Readable ? Readable.toWeb(body) as any : body,
    })
    response.status = resp.status
    response.headers = resp.headers
    response.body = resp.body instanceof ReadableStream ? Readable.fromWeb(resp.body as any) : (resp.body ?? undefined)
  }
  app.protocol.registerHandler('http', handler)
  app.protocol.registerHandler('https', handler)
}
