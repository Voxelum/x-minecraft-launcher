import { ClassicLevel } from 'classic-level'
import { join } from 'path'
import { Agent, Dispatcher, Pool, setGlobalDispatcher } from 'undici'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { InteroperableDispatcher, ProxyDispatcher } from '../dispatchers'
import { BiDispatcher, kUseDownload } from '../dispatchers/biDispatcher'
import { CacheDispatcher, JsonCacheStorage } from '../dispatchers/cacheDispatcher'
import { buildHeaders } from '../dispatchers/utils'
import { kSettings } from '../entities/settings'
import { IS_DEV } from '../constant'
import { DefaultRangePolicy, resolveAgent } from '@xmcl/file-transfer'
import { kNetworkInterface } from '../entities/networkInterface'
import { kUserAgent } from '../entities/userAgent'
import { kDownloadOptions } from '../entities/downloadOptions'

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

  let maxConnection = 16
  app.registry.get(kSettings).then((state) => {
    maxConnection = state.maxSockets > 0 ? state.maxSockets : Number.POSITIVE_INFINITY
    proxy.setProxyEnabled(state.httpProxyEnabled)
    if (state.httpProxy) {
      try {
        proxy.setProxy(new URL(state.httpProxy))
      } catch (e) {
        logger.warn(`Fail to set url as it's not a valid url ${state.httpProxy}`, e)
      }
    }
    state.subscribe('maxSocketsSet', (val) => {
      maxConnection = val > 0 ? val : Number.POSITIVE_INFINITY
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
  const proxy = new ProxyDispatcher({
    factory(connect) {
      const downloadAgent = new Agent({
        bodyTimeout: 15_000,
        headersTimeout: 10_000,
        connectTimeout: 10_000,
        connect,
        factory(origin, opts: Agent.Options) {
          const dispatcher = new Pool(origin, opts)
          const keys = Reflect.ownKeys(dispatcher)
          const sym = keys.find(k => typeof k === 'symbol' && k.description === 'connections')
          if (sym) {
            Object.defineProperty(dispatcher, sym, {
              get: () => {
                return maxConnection
              },
            })
          }
          return dispatcher
        },
      })
      const apiAgent = new Agent({
        pipelining: 1,
        bodyTimeout: 20_000,
        headersTimeout: 10_000,
        connectTimeout: 10_000,
        connect,
        factory(origin, opts: Agent.Options) {
          let dispatcher: Dispatcher | undefined
          for (const factory of apiClientFactories) { dispatcher = factory(origin, opts) }
          if (!dispatcher) { dispatcher = new Pool(origin, opts) }
          if (dispatcher instanceof Pool) {
            const keys = Reflect.ownKeys(dispatcher)
            const kConnections = keys.find(k => typeof k === 'symbol' && k.description === 'connections')
            if (kConnections) { Object.defineProperty(dispatcher, kConnections, { get: () => maxConnection }) }
          }
          return dispatcher
        },
      })
      return new BiDispatcher(downloadAgent, apiAgent)
    },
  })

  const apiDispatcher = new InteroperableDispatcher(
    [
      async (options) => {
        for (const interceptor of dispatchInterceptors) {
          await interceptor(options)
        }
        (options as any)[kUseDownload] = false
        const headers = buildHeaders(options.headers || {})
        if (!headers['user-agent']) {
          headers['user-agent'] = userAgent
        }
        options.headers = headers
      },
    ],
    new CacheDispatcher(proxy, new JsonCacheStorage(cache)),
  )
  setGlobalDispatcher(apiDispatcher)

  const downloadAgent = resolveAgent({
    rangePolicy: new DefaultRangePolicy(4 * 1024 * 1024, 4),
    dispatcher: new InteroperableDispatcher(
      [
        (options) => {
          (options as any)[kUseDownload] = true
          const headers = buildHeaders(options.headers || {})
          if (!headers['user-agent']) {
            headers['user-agent'] = userAgent
          }
          options.headers = headers
        },
      ],
      proxy,
    ),
    checkpointHandler: {
      lookup: async (url) => { return undefined },
      put: async (url, checkpoint) => { },
      delete: async (url) => { },
    },
  })

  app.registry.register(kNetworkInterface, {
    registerAPIFactoryInterceptor(interceptor: (origin: URL, options: Agent.Options) => Dispatcher | undefined) {
      apiClientFactories.unshift(interceptor)
      return apiDispatcher
    },
    registerDispatchInterceptor(interceptor: (opts: DispatchOptions) => void | Promise<void>): void {
      dispatchInterceptors.unshift(interceptor)
    },
  })

  app.registry.register(kDownloadOptions, {
    agent: downloadAgent,
    headers: {},
  })

  app.registryDisposer(async () => {
    await cache.close()
  })
}
