import { DefaultRangePolicy, DownloadAgent, DownloadBaseOptions, resolveAgent } from '@xmcl/file-transfer'
import { ClassicLevel } from 'classic-level'
import { join } from 'path'
import { Agent, Client, Dispatcher, Pool, setGlobalDispatcher } from 'undici'
import { URL } from 'url'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { InteroperableDispatcher, ProxyDispatcher } from '../dispatchers'
import { BiDispatcher, kUseDownload } from '../dispatchers/biDispatcher'
import { CacheDispatcher, JsonCacheStorage } from '../dispatchers/cacheDispatcher'
import { buildHeaders } from '../dispatchers/utils'
import { BaseService } from '../services/BaseService'
import { createPromiseSignal } from '../util/promiseSignal'
import ServiceManager from './ServiceManager'
import ServiceStateManager from './ServiceStateManager'

type DispatchOptions = Dispatcher.DispatchOptions

export default class NetworkManager extends Manager {
  private inGFW = false

  private headers: Record<string, string> = {}

  private logger = this.app.logManager.getLogger('NetworkManager')

  private apiDispatcher: Dispatcher
  private downloadAgent: DownloadAgent

  private dispatchInterceptors: Array<(opts: DispatchOptions) => void | Promise<void>> = []

  private apiClientFactories: Array<(origin: URL, options: Agent.Options) => Dispatcher | undefined>

  private userAgent: string

  constructor(app: LauncherApp, serviceManager: ServiceManager, stateManager: ServiceStateManager) {
    super(app)
    const cachePath = join(app.appDataPath, 'undici-cache')
    const cache = new ClassicLevel(cachePath, {
      valueEncoding: 'json',
    })

    cache.open().catch((e) => {
      this.app.error('Fail to open undici cache. Try to fix the error', e)
      return ClassicLevel.repair(cachePath)
    })

    let maxConnection = 16

    const service = serviceManager.get(BaseService)
    service.initialize().then(() => {
      maxConnection = service.state.maxSockets > 0 ? service.state.maxSockets : Number.POSITIVE_INFINITY
      proxy.setProxyEnabled(service.state.httpProxyEnabled)
      if (service.state.httpProxy) {
        try {
          proxy.setProxy(new URL(service.state.httpProxy))
        } catch (e) {
          app.warn(`Fail to set url as it's not a valid url ${service.state.httpProxy}`, e)
        }
      }
    })
    stateManager.subscribe('maxSocketsSet', (val) => {
      maxConnection = val > 0 ? val : Number.POSITIVE_INFINITY
    })

    const apiClientFactories = [] as Array<(origin: URL, options: Agent.Options) => Dispatcher | undefined>

    this.app.serviceStateManager.subscribe('httpProxySet', (p) => {
      proxy.setProxy(new URL(p))
    })
    this.app.serviceStateManager.subscribe('httpProxyEnabledSet', (e) => {
      proxy.setProxyEnabled(e)
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

    const version = IS_DEV ? '0.0.0' : app.version
    const userAgent = `voxelum/x_minecraft_launcher/${version} (xmcl.app)`
    this.userAgent = userAgent

    const downloadDispatcher =
      new InteroperableDispatcher(
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
      )

    const apiDispatcher =
      new InteroperableDispatcher(
        [
          async (options) => {
            for (const interceptor of this.dispatchInterceptors) {
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

    this.downloadAgent = resolveAgent({
      rangePolicy: new DefaultRangePolicy(4 * 1024 * 1024, 4),
      dispatcher: downloadDispatcher,
      // checkpointHandler: createInMemoryCheckpointHandler(),
    })

    this.apiClientFactories = apiClientFactories

    this.apiDispatcher = apiDispatcher
  }

  getUserAgent() {
    return this.userAgent
  }

  getDownloadBaseOptions(): DownloadBaseOptions {
    return {
      agent: this.downloadAgent,
      headers: this.headers,
    }
  }

  registerAPIFactoryInterceptor(interceptor: (origin: URL, options: Agent.Options) => Dispatcher | undefined) {
    this.apiClientFactories.unshift(interceptor)
    return this.apiDispatcher
  }

  registerDispatchInterceptor(interceptor: (opts: DispatchOptions) => void | Promise<void>) {
    this.dispatchInterceptors.unshift(interceptor)
  }

  /**
   * Update the status of GFW
   */
  async updateGFW() {
    const taobao = new Client('https://npm.taobao.org')
    const google = new Client('https://www.google.com')
    this.inGFW = await Promise.race([
      taobao.request({
        method: 'HEAD',
        path: '/',
        connectTimeout: 5000,
        headersTimeout: 5000,
      }).then(() => true, () => false),
      google.request({
        method: 'HEAD',
        path: '/',
        connectTimeout: 5000,
        headersTimeout: 5000,
      }).then(() => false, () => true),
    ])
    this.gfwReady.resolve()
    this.logger.log(this.inGFW ? 'Detected current in China mainland.' : 'Detected current NOT in China mainland.')
    taobao.close()
    google.close()
  }

  readonly gfwReady = createPromiseSignal()

  /**
   * Return if current environment is in GFW.
   */
  get isInGFW() {
    return this.inGFW
  }

  // setup code
  setup() {
    this.updateGFW()
  }
}
