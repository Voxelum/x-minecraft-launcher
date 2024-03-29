import { DefaultRangePolicy, createRedirectInterceptor, getDefaultAgentOptions } from '@xmcl/file-transfer'
import { PoolStats } from '@xmcl/runtime-api'
import { ClassicLevel } from 'classic-level'
import { join } from 'path'
import { Agent, Dispatcher, Pool, setGlobalDispatcher, CacheStorage, buildConnector } from 'undici'
import { kClients, kRunning } from 'undici/lib/core/symbols'
import { LauncherAppPlugin } from '~/app'
import { IS_DEV } from '~/constant'
import { kSettings } from '~/settings'
import { CacheDispatcher, JsonCacheStorage } from './dispatchers/cacheDispatcher'
import { DispatchInterceptor, createInterceptOptionsInterceptor } from './dispatchers/dispatcher'
import { ProxyAgent, ProxySettingController } from './dispatchers/proxyDispatcher'
import { buildHeaders } from './dispatchers/utils'
import { kDownloadOptions, kNetworkInterface } from './networkInterface'
import { kUserAgent } from './userAgent'
import { setTimeout as timeout } from 'timers/promises'

type DispatchOptions = Dispatcher.DispatchOptions

export const pluginNetworkInterface: LauncherAppPlugin = (app) => {
  const cachePath = join(app.appDataPath, 'undici-cache')
  const cache = new ClassicLevel(cachePath, {
    valueEncoding: 'json',
  })
  const logger = app.getLogger('NetworkInterface')
  const version = IS_DEV ? '0.0.0' : app.version
  const userAgent = `voxelum/x_minecraft_launcher/${version} (xmcl.app)`
  app.registry.register(kUserAgent, userAgent)

  const apiClientFactories = [] as Array<(origin: URL, options: Agent.Options) => Dispatcher | undefined>
  const dispatchInterceptors: Array<(opts: DispatchOptions) => void | Promise<void>> = []

  let maxConnection = 64
  const connectorOptions: buildConnector.BuildOptions = {
    timeout: 10_000,
    rejectUnauthorized: false,
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 850,
  }

  const proxy = new ProxySettingController()
  app.registry.get(kSettings).then((state) => {
    maxConnection = state.maxSockets > 0 ? state.maxSockets : 64
    proxy.setProxyEnabled(state.httpProxyEnabled)
    if (state.httpProxy) {
      try {
        proxy.setProxy(new URL(state.httpProxy))
      } catch (e) {
        logger.warn(`Fail to set url as it's not a valid url ${state.httpProxy}`, e)
      }
    }
    state.subscribe('maxSocketsSet', (val) => {
      maxConnection = val > 0 ? val : 64
    })
    state.subscribe('httpProxySet', (p) => {
      try {
        proxy.setProxy(new URL(p))
      } catch (e) {
        logger.warn(`Fail to set url as it's not a valid url ${p}`, e)
      }
    })
    state.subscribe('httpProxyEnabledSet', (e) => {
      proxy.setProxyEnabled(e)
    })
  })

  const patchIfPool = (dispatcher: Dispatcher) => {
    if (dispatcher instanceof Pool) {
      const keys = Reflect.ownKeys(dispatcher)
      const kConnections = keys.find(k => typeof k === 'symbol' && k.description === 'connections')
      if (kConnections) { Object.defineProperty(dispatcher, kConnections, { get: () => maxConnection }) }
    }
    return dispatcher
  }
  const appendUserAgent: DispatchInterceptor = (options) => {
    const headers = buildHeaders(options.headers || {})
    if (!headers['user-agent']) {
      headers['user-agent'] = userAgent
    }
    options.headers = headers
  }

  const apiDispatcher = new CacheDispatcher(new ProxyAgent({
    controller: proxy,
    factory: (connect) => new Agent({
      interceptors: {
        Client: [createInterceptOptionsInterceptor([appendUserAgent, ...dispatchInterceptors]), createRedirectInterceptor(5)],
      },
      pipelining: 1,
      bodyTimeout: 20_000,
      headersTimeout: 10_000,
      connectTimeout: 45_000,
      connect,
      factory(origin, opts: Agent.Options) {
        let dispatcher: Dispatcher | undefined
        for (const factory of apiClientFactories) { dispatcher = factory(typeof origin === 'string' ? new URL(origin) : origin, opts) }
        if (!dispatcher) { dispatcher = new Pool(origin, opts) }
        return patchIfPool(dispatcher)
      },
    }),
    proxyTls: connectorOptions,
    requestTls: connectorOptions,
  }), new JsonCacheStorage(cache))
  setGlobalDispatcher(apiDispatcher)

  function calculateRetryAfterHeader(retryAfter: number) {
    const current = Date.now()
    const diff = new Date(retryAfter).getTime() - current

    return diff
  }

  const downloadAgentOptions = getDefaultAgentOptions({
    maxTimeout: 60_000,
    maxRetries: 30,
    // @ts-ignore
    retry: (err, { state, opts }, cb) => {
      const { statusCode, code, headers } = err as any
      const { method, retryOptions } = opts
      const {
        maxRetries,
        timeout,
        maxTimeout,
        timeoutFactor,
        statusCodes,
        errorCodes,
        methods,
      } = retryOptions! as any
      let { counter, currentTimeout } = state

      currentTimeout =
        currentTimeout != null && currentTimeout > 0 ? currentTimeout : timeout

      // Any code that is not a Undici's originated and allowed to retry
      if (
        code &&
        code !== 'UND_ERR_REQ_RETRY' &&
        code !== 'UND_ERR_SOCKET' &&
        !errorCodes!.includes(code)
      ) {
        if (code !== 'UND_ERR_CONNECT_TIMEOUT') {
          cb(err)
          return
        }
        // Check if there are connection with the same origin
        // If there are, this error is usually due to high traffic, and we should retry
        // @ts-ignore
        const clients = downloadProxy.agent[kClients] as Map<string, Pool>
        if (!opts.origin) {
          cb(err)
          return
        }
        const pool = clients.get(typeof opts.origin === 'string' ? opts.origin : opts.origin.origin)
        const stats = pool?.stats
        if (!stats?.connected && !stats?.pending && !stats?.running && !stats?.queued && !stats?.free) {
          cb(err)
          return
        }
      }

      // If a set of method are provided and the current method is not in the list
      if (Array.isArray(methods) && !methods.includes(method)) {
        cb(err)
        return
      }

      // If a set of status code are provided and the current status code is not in the list
      if (
        statusCode != null &&
        Array.isArray(statusCodes) &&
        !statusCodes.includes(statusCode)
      ) {
        cb(err)
        return
      }

      // If we reached the max number of retries
      if (counter > (maxRetries ?? 5)) {
        cb(err)
        return
      }

      let retryAfterHeader = headers?.['retry-after']
      if (retryAfterHeader) {
        retryAfterHeader = Number(retryAfterHeader)
        retryAfterHeader = Number.isNaN(retryAfterHeader)
          ? calculateRetryAfterHeader(retryAfterHeader)
          : retryAfterHeader * 1e3 // Retry-After is in seconds
      }

      const retryTimeout =
        retryAfterHeader > 0
          ? Math.min(retryAfterHeader, (maxTimeout!))
          : Math.min(currentTimeout * timeoutFactor! ** counter, maxTimeout!)

      state.currentTimeout = retryTimeout

      setTimeout(() => cb(null), retryTimeout)
    },
  })
  const downloadProxy = new ProxyAgent({
    controller: proxy,
    factory: (connect) => new Agent({
      connections: downloadAgentOptions.connections,
      interceptors: {
        Agent: [...downloadAgentOptions.interceptors.Agent],
        Client: [...downloadAgentOptions.interceptors.Client],
      },
      headersTimeout: 45_000,
      connectTimeout: 45_000,
      bodyTimeout: 60_000,
      connect,
      factory: (origin, opts) => patchIfPool(new Pool(origin, opts)),
    }),
    proxyTls: connectorOptions,
    requestTls: connectorOptions,
  })
  app.registry.register(kDownloadOptions, {
    rangePolicy: new DefaultRangePolicy(4 * 1024 * 1024, 4),
    dispatcher: downloadProxy,
    checkpointHandler: {
      lookup: async (url) => { return undefined },
      put: async (url, checkpoint) => { },
      delete: async (url) => { },
    },
    headers: {
      'user-agent': userAgent,
    },
  })

  const getAgentStatus = () => {
    // @ts-ignore
    const clients = downloadProxy.agent[kClients] as Map<string, Dispatcher>
    const result = {} as Record<string, PoolStats>
    for (const [k, v] of clients.entries()) {
      if (v instanceof Pool) {
        const connected = v.stats.connected
        const free = v.stats.free
        const pending = v.stats.pending
        const queued = v.stats.queued
        const running = v.stats.running
        const size = v.stats.size
        const status = { connected, free, pending, queued, running, size }
        result[k] = status
      }
    }
    return result
  }

  downloadProxy.agent.on('drain', (url) => {
    setTimeout(() => {
      // @ts-ignore
      const clients = downloadProxy.agent[kClients] as Map<string, Dispatcher>
      const pool = clients.get(url.origin)
      // @ts-ignore
      const running = pool?.[kRunning]
      if (running && running === 0) {
        pool?.close()
        clients.delete(url.origin)
      }
    }, 60_000)
  })

  app.registry.register(kNetworkInterface, {
    registerClientFactoryInterceptor(interceptor: (origin: URL, options: Agent.Options) => Dispatcher | undefined) {
      apiClientFactories.unshift(interceptor)
      return apiDispatcher
    },
    registerOptionsInterceptor(interceptor: (opts: DispatchOptions) => void | Promise<void>): void {
      dispatchInterceptors.unshift(interceptor)
    },
    getDownloadAgentStatus: getAgentStatus,
    async destroyPool(origin) {
      // @ts-ignore
      const clients = downloadProxy.agent[kClients] as Map<string, Dispatcher>
      const pool = clients.get(origin)
      await Promise.race([pool?.close().then(() => true), timeout(500).then(() => false)]).then((closed) => {
        if (!closed) return pool?.destroy()
      })
      clients.delete(origin)
    },
  })

  app.registryDisposer(async () => {
    await cache.close()
  })
}
