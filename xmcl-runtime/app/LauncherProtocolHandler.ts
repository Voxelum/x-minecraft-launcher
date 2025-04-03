import { Readable } from 'stream'

export interface Context {
  request: Request
  response: Response
  handle: Handler
}

export interface RequestOptions {
  method?: string
  url: string | URL
  headers?: Record<string, any>
  body?: string | Buffer | Readable
}

export interface Request {
  method: string
  url: URL
  headers: Record<string, any>
  body?: string | Buffer | Readable
}

export interface Response {
  status?: number
  headers: Record<string, any>
  body?: string | Buffer | Readable
}

export interface Handler {
  (context: Context): Promise<void> | void
}

export type ResolvedResponse = Response & {
  [P in keyof Pick<Response, 'headers' | 'status'>]-?: Response[P];
}

/**
 * The universal http-like protocol handler.
 *
 * This can handle the request from
 * 1. HTTP server hosted by the launcher (yggdrasil server)
 * 2. URL drop to launcher UI
 * 3. open-url event or launcher process startup argument
 * 4. HTTP request from the browser process
 *
 * The drop in request or localhost request will be transformed into xmcl:// protocol
 */
export class LauncherProtocolHandler {
  private handlers: [string, Handler][] = []
  private sinkHandlers: Record<string, Handler> = {}

  /**
   * Register a http-like handler for a specific protocol
   *
   * @param protocol The protocol
   * @param handler The protocol handler
   */
  registerHandler(protocol: string, handler: Handler, sink = false) {
    if (sink) {
      if (this.sinkHandlers[protocol]) {
        throw new TypeError(`Handler for protocol ${protocol} already registered`)
      }
      this.sinkHandlers[protocol] = handler
      return
    }
    this.handlers.push([protocol, handler])
  }

  getProtocols() {
    return [...new Set(this.handlers.map(v => v[0]))]
  }

  async handle(request: RequestOptions): Promise<ResolvedResponse> {
    const handle: Handler = async (ctx) => {
      const handers = this.handlers.filter(v => `${v[0]}:` === ctx.request.url.protocol).map(v => v[1])
      for (const handler of handers) {
        await handler(ctx)
      }
      await this.sinkHandlers[ctx.request.url.protocol.substring(0, ctx.request.url.protocol.length - 1)]?.(ctx)
    }
    const context: Context = {
      request: {
        method: request.method ?? 'GET',
        url: typeof request.url === 'string' ? new URL(request.url, 'xmcl://launcher') : request.url,
        headers: request.headers || {},
        body: request.body,
      },
      response: {
        headers: {},
      },
      handle,
    }
    await handle(context)
    return {
      status: context.response.status ?? 404,
      headers: context.response.headers,
      body: context.response.body,
    }
  }
}
