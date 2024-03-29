/* eslint-disable no-dupe-class-members */
import { Socket } from 'net'
import { TlsOptions } from 'tls'
import { Agent, buildConnector, Client, errors, Dispatcher } from 'undici'
import { kClose, kDestroy } from 'undici/lib/core/symbols'
import DispatcherBase from 'undici/lib/dispatcher/dispatcher-base'
import { URL } from 'url'
import { buildHeaders } from './utils'

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
export class ProxyAgent extends DispatcherBase {
  readonly agent: Agent

  private isProxyEnabled = false
  private proxyClient?: Client
  private proxyHeader?: Record<string, string>

  private pConnect: buildConnector.connector
  private _connect: buildConnector.connector
  private requestTls?: buildConnector.BuildOptions
  private proxyTls?: buildConnector.BuildOptions

  async setProxy(uri: URL, auth?: string) {
    const oldClient = this.proxyClient
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
    this._connect = buildConnector({ timeout, ...this.requestTls || {} })
  }

  constructor(opts: {
    controller: ProxySettingController
    factory: (connect: buildConnector.connector) => Agent
    requestTls?: buildConnector.BuildOptions
    proxyTls?: buildConnector.BuildOptions
  }) {
    super()

    opts.controller.add(this)
    this.requestTls = opts.requestTls
    this.proxyTls = opts.proxyTls

    this.pConnect = buildConnector(opts.proxyTls)
    this._connect = buildConnector(opts.requestTls)

    const connect = async (opts: any, callback: buildConnector.Callback) => {
      if (!this.isProxyEnabled || !this.proxyClient) {
        this._connect(opts, callback)
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
        this._connect({
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
    const headers = buildHeaders(opts.headers || {})
    throwIfProxyAuthIsSent(headers)

    return this.agent.dispatch(
      {
        ...opts,
        method: opts.method,
        headers: {
          ...headers,
          host,
        },
      },
      handler,
    )
  }

  async [kClose]() {
    await this.agent.close()
    await this.proxyClient?.close()
  }

  async [kDestroy]() {
    await this.agent.destroy()
    await this.proxyClient?.destroy()
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
