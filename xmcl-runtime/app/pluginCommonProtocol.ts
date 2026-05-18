import { Readable } from 'stream'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'

/**
 * Convert a WHATWG ReadableStream into a Node Readable while silently
 * swallowing ERR_INVALID_STATE "Controller is already closed". That error
 * fires when the underlying fetch is aborted (user navigated away, window
 * closed, request cancelled) and a late chunk tries to enqueue into a
 * stream the consumer has already torn down — benign, but produces a noisy
 * trackException because the minified async stack is unidentifiable
 * (see issue #1446).
 */
const adaptWebBody = (body: ReadableStream | Readable | null | undefined) => {
  if (!(body instanceof ReadableStream)) return body ?? undefined
  const readable = Readable.fromWeb(body as any)
  readable.on('error', (err: any) => {
    if (err && (err.code === 'ERR_INVALID_STATE' || err.message === 'Invalid state: Controller is already closed')) {
      // Already-closed controller — consumer is gone, drop quietly.
      return
    }
    // Re-emit non-benign errors so the protocol handler still surfaces them.
    readable.destroy(err)
  })
  return readable
}

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
      response.body = adaptWebBody(resp.body as any)
    } catch (e) {
      throw e
    }
  }
  app.protocol.registerHandler('http', handler, true)
  app.protocol.registerHandler('https', handler, true)
}
