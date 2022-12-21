/* eslint-disable no-dupe-class-members */
import { Socket } from 'net'
import { TlsOptions } from 'tls'
import { Agent, buildConnector, Client, errors, Dispatcher } from 'undici'
import { kClose, kDestroy } from 'undici/lib/core/symbols'
import DispatcherBase from 'undici/lib/dispatcher-base'
import { URL } from 'url'
import { buildHeaders } from './utils'

type DispatchHandlers = Dispatcher.DispatchHandlers
const { InvalidArgumentError, RequestAbortedError } = errors

function defaultProtocolPort(protocol: string) {
  return protocol === 'https:' ? 443 : 80
}

/**
 * Implement proxy and cache
 */
export class ProxyDispatcher extends DispatcherBase {
  private dispatcher: Dispatcher

  private isProxyEnabled = false
  private proxyClient?: Client
  private proxyHeader?: Record<string, string>

  private pConnect: buildConnector.connector

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

  constructor(opts: {
    factory: (connect: buildConnector.connector) => Dispatcher
    requestTls?: TlsOptions & { servername?: string }
    proxyTls?: TlsOptions & { servername?: string }
  }) {
    super()

    this.pConnect = buildConnector({ timeout: 10_000 })
    const connector = buildConnector({ timeout: 10_000 })

    const connect = async (opts: any, callback: buildConnector.Callback) => {
      if (!this.isProxyEnabled || !this.proxyClient) {
        connector(opts, callback)
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
        connector({ ...opts, servername, httpSocket: socket }, callback)
      } catch (err) {
        callback(err as Error, null)
      }
    }

    this.dispatcher = opts.factory(connect as any)
  }

  dispatch(opts: Agent.DispatchOptions, handler: DispatchHandlers) {
    const { host } = new URL(opts.origin as string)
    const headers = buildHeaders(opts.headers || {})
    throwIfProxyAuthIsSent(headers)

    return this.dispatcher.dispatch(
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
    await this.dispatcher.close()
    await this.proxyClient?.close()
  }

  async [kDestroy]() {
    await this.dispatcher.destroy()
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
