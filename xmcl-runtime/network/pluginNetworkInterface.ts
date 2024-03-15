import { DefaultRangePolicy, getDefaultAgentOptions } from '@xmcl/file-transfer'
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

  const apiAgentOptions = getDefaultAgentOptions()
  const apiDispatcher = new CacheDispatcher(new ProxyAgent({
    controller: proxy,
    factory: (connect) => new Agent({
      interceptors: {
        Agent: [...apiAgentOptions.interceptors.Agent],
        Client: [...apiAgentOptions.interceptors.Client, createInterceptOptionsInterceptor([appendUserAgent, ...dispatchInterceptors])],
      },
      pipelining: 1,
      bodyTimeout: 20_000,
      headersTimeout: 10_000,
      connectTimeout: 10_000,
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

  const downloadAgentOptions = getDefaultAgentOptions({
    maxTimeout: 60_000,
    maxRetries: 30,
  })
  const downloadProxy = new ProxyAgent({
    controller: proxy,
    factory: (connect) => new Agent({
      connections: downloadAgentOptions.connections,
      interceptors: {
        Agent: [...downloadAgentOptions.interceptors.Agent],
        Client: [...downloadAgentOptions.interceptors.Client],
      },
      headersTimeout: 15_000,
      connectTimeout: 35_000,
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
  })

  app.registryDisposer(async () => {
    await cache.close()
  })
}
