import { Socket } from 'net'
import { Agent, Client, Dispatcher, RetryHandler, buildConnector, errors, util } from 'undici'

type DispatchHandlers = Dispatcher.DispatchHandlers
const { InvalidArgumentError, RequestAbortedError } = errors

function defaultProtocolPort(protocol: string) {
  return protocol === 'https:' ? 443 : 80
}

interface Proxy {
  setProxyEnabled(e: boolean): void
  setProxy(uri: URL, auth?: string): Promise<void>
}

export class ProxySettingController {
  #settings: Proxy[] = []

  add(p: Proxy) {
    this.#settings.push(p)
  }

  setProxyEnabled(e: boolean) {
    for (const p of this.#settings) {
      p.setProxyEnabled(e)
    }
  }

  async setProxy(uri: URL, auth?: string): Promise<void> {
    for (const p of this.#settings) {
      await p.setProxy(uri, auth)
    }
  }
}

/**
 * Implement mutable proxy
 */
export class NetworkAgent extends Dispatcher {
  readonly agent: Agent

  private isProxyEnabled = false
  private proxyUri?: URL
  private proxyClient?: Client
  private proxyHeader?: Record<string, string>

  private pConnect: buildConnector.connector
  private rConnect: buildConnector.connector
  private requestTls?: buildConnector.BuildOptions
  private proxyTls?: buildConnector.BuildOptions

  #userAgent: string
  #retryOptions: RetryHandler.RetryOptions
  #dispatchInterceptors?: Array<(opts: Dispatcher.DispatchOptions) => void>

  async setProxy(uri: URL, auth?: string) {
    const oldClient = this.proxyClient
    this.proxyUri = uri
    this.proxyClient = new Client(uri, { connect: this.pConnect })
    if (auth) {
      this.proxyHeader = {
        'proxy-authorization': `Basic ${auth}`,
      }
    }
    if (oldClient) {
      await oldClient.close()
    }
  }

  setProxyEnabled(enabled: boolean) {
    this.isProxyEnabled = enabled
  }

  setConnectTimeout(timeout: number) {
    this.pConnect = buildConnector({ timeout, ...this.proxyTls || {} })
    this.rConnect = buildConnector({ timeout, ...this.requestTls || {} })
    const oldClient = this.proxyClient
    if (this.proxyUri) {
      this.proxyClient = new Client(this.proxyUri, { connect: this.pConnect })
    }
    if (oldClient) {
      oldClient.close()
    }
  }

  constructor(opts: {
    userAgent: string
    retryOptions: RetryHandler.RetryOptions
    dispatchInterceptors?: Array<(opts: Dispatcher.DispatchOptions) => void>
    factory: (connect: buildConnector.connector) => Agent
    requestTls?: buildConnector.BuildOptions
    proxyTls?: buildConnector.BuildOptions
  }) {
    super()

    this.#retryOptions = opts.retryOptions
    this.#userAgent = opts.userAgent
    this.#dispatchInterceptors = opts.dispatchInterceptors
    this.requestTls = opts.requestTls
    this.proxyTls = opts.proxyTls

    this.pConnect = buildConnector(opts.proxyTls)
    this.rConnect = buildConnector(opts.requestTls)

    const connect = async (opts: any, callback: buildConnector.Callback) => {
      if (!this.isProxyEnabled || !this.proxyClient) {
        this.rConnect(opts, callback)
        return
      }
      let requestedHost = opts.host
      if (!opts.port) {
        requestedHost += `:${defaultProtocolPort(opts.protocol)}`
      }
      try {
        const { socket, statusCode } = await this.proxyClient.connect({
          path: requestedHost,
          signal: opts.signal,
          headers: {
            ...(this.proxyHeader || {}),
            host: opts.host,
          },
        })
        if (statusCode !== 200) {
          socket.on('error', () => { }).destroy()
          callback(new RequestAbortedError('Proxy response !== 200 when HTTP Tunneling'), null)
        }
        if (opts.protocol !== 'https:') {
          callback(null, socket as Socket)
          return
        }
        const servername = opts.servername
        this.rConnect({
          ...opts,
          servername,
          httpSocket: socket,
        }, callback)
      } catch (err) {
        callback(err as Error, null)
      }
    }

    this.agent = opts.factory(connect as any)
  }

  dispatch(opts: Agent.DispatchOptions, handler: DispatchHandlers) {
    const { host } = new URL(opts.origin as string)
    const headers = opts.headers ? opts.headers instanceof Array ? util.parseHeaders(opts.headers as any) : opts.headers as any : {}
    if (!headers['user-agent']) {
      headers['user-agent'] = this.#userAgent
    }

    if (this.#dispatchInterceptors) {
      for (const interceptor of this.#dispatchInterceptors) {
        interceptor(opts)
      }
    }

    throwIfProxyAuthIsSent(headers)

    const retry = new RetryHandler({
      ...opts,
      method: opts.method,
      headers: {
        ...headers,
        host,
      },
      retryOptions: this.#retryOptions,
    }, {
      dispatch: this.agent.dispatch.bind(this.agent),
      handler,
    })

    return this.agent.dispatch(
      {
        ...opts,
        method: opts.method,
        headers,
      },
      retry,
    )
  }
}

/**
 * Previous versions of ProxyAgent suggests the Proxy-Authorization in request headers
 * Nevertheless, it was changed and to avoid a security vulnerability by end users
 * this check was created.
 * It should be removed in the next major version for performance reasons
 */
function throwIfProxyAuthIsSent(headers: Record<string, any>) {
  const existProxyAuth = headers && Object.keys(headers)
    .find((key) => key.toLowerCase() === 'proxy-authorization')
  if (existProxyAuth) {
    throw new InvalidArgumentError('Proxy-Authorization should be sent in ProxyAgent constructor')
  }
}
