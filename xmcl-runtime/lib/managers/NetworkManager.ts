import { createInMemoryCheckpointHandler, DefaultSegmentPolicy, DownloadAgent, DownloadBaseOptions, resolveAgent } from '@xmcl/installer'
import { ClassicLevel } from 'classic-level'
import { join } from 'path'
import { Agent, Client, Dispatcher, Pool, setGlobalDispatcher, DiagnosticsChannel } from 'undici'
import { channel } from 'diagnostics_channel'
import { DispatchOptions } from 'undici/types/agent'
import { URL } from 'url'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { InteroperableDispatcher, ProxyDispatcher } from '../dispatchers'
import { BiDispatcher, kUseDownload } from '../dispatchers/biDispatcher'
import { CacheDispatcher, JsonCacheStorage } from '../dispatchers/cacheDispatcher'
import { BaseService } from '../services/BaseService'
import ServiceManager from './ServiceManager'
import ServiceStateManager from './ServiceStateManager'
import { buildHeaders } from '../dispatchers/utils'
import { IS_DEV } from '../constant'

export default class NetworkManager extends Manager {
  private inGFW = false

  private headers: Record<string, string> = {}

  private logger = this.app.logManager.getLogger('NetworkManager')

  private apiDispatcher: Dispatcher
  private downloadDispatcher: Dispatcher
  private downloadAgent: DownloadAgent

  private dispatchInterceptors: Array<(opts: DispatchOptions) => void> = []

  private apiClientFactories: Array<(origin: URL, options: Agent.Options) => Dispatcher | undefined>
  private downloadClientFactories: Array<(origin: URL, options: Agent.Options) => Dispatcher | undefined>

  private userAgent: string

  constructor(app: LauncherApp, serviceManager: ServiceManager, stateManager: ServiceStateManager) {
    super(app)
    const cache = new ClassicLevel(join(app.appDataPath, 'undici-cache'), {
      valueEncoding: 'json',
    })

    let maxConnection = 16

    const service = serviceManager.get(BaseService)
    service.initialize().then(() => {
      maxConnection = service.state.maxSockets > 0 ? service.state.maxSockets : Number.POSITIVE_INFINITY
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
            if (sym) { Object.defineProperty(dispatcher, sym, { get: () => maxConnection }) }
            return dispatcher
          },
        })
        const apiAgent = new Agent({
          pipelining: 1,
          bodyTimeout: 10_000,
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
          (options) => {
            for (const interceptor of this.dispatchInterceptors) {
              interceptor(options)
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

    const downloadClientFactories = [] as Array<(origin: URL, options: Agent.Options) => Dispatcher | undefined>

    this.downloadAgent = resolveAgent({
      segmentPolicy: new DefaultSegmentPolicy(4 * 1024 * 1024, 4),
      dispatcher: downloadDispatcher,
      checkpointHandler: createInMemoryCheckpointHandler(),
    })

    this.apiClientFactories = apiClientFactories
    this.downloadClientFactories = downloadClientFactories

    this.apiDispatcher = apiDispatcher
    this.downloadDispatcher = downloadDispatcher

    const undici = this.app.logManager.getLogger('Undici')

    channel('undici:request:create').subscribe((m, name) => {
      const msg: DiagnosticsChannel.RequestCreateMessage = m as any
      undici.log(`request:create ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.request.headers}`)
    })
    channel('undici:request:bodySent').subscribe((m, name) => {
      const msg: DiagnosticsChannel.RequestBodySentMessage = m as any
      undici.log(`request:bodySent ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.request.headers}`)
    })
    channel('undici:request:headers').subscribe((m, name) => {
      const msg: DiagnosticsChannel.RequestHeadersMessage = m as any
      undici.log(`request:headers ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.request.headers} ${msg.response.statusCode} ${msg.response.headers}`)
    })
    channel('undici:request:trailers').subscribe((m, name) => {
      const msg = m as DiagnosticsChannel.RequestTrailersMessage
      undici.log(`request:trailers ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.request.headers} ${msg.trailers}`)
    })
    channel('undici:request:error').subscribe((m, name) => {
      const msg = m as DiagnosticsChannel.RequestErrorMessage
      undici.error(`request:error ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.request.headers}: %O`, msg.error)
    })
    channel('undici:client:sendHeaders').subscribe((m, name) => {
      const msg: DiagnosticsChannel.ClientSendHeadersMessage = m as any
      undici.log(`client:sendHeaders ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.request.headers} ${msg.socket.remoteAddress}`)
    })
    channel('undici:client:beforeConnect').subscribe((msg, name) => {
      const m = msg as DiagnosticsChannel.ClientBeforeConnectMessage
      undici.log(`client:beforeConnect ${m.connectParams.protocol}${m.connectParams.hostname}:${m.connectParams.port} ${m.connectParams.servername}`)
    })
    channel('undici:client:connectError').subscribe((msg, name) => {
      const m: DiagnosticsChannel.ClientConnectErrorMessage = msg as any
      undici.error(`client:connectError ${m.connectParams.protocol}${m.connectParams.hostname}:${m.connectParams.port} ${m.connectParams.servername} %O`, m.error)
    })
    channel('undici:client:connected').subscribe((msg, name) => {
      const m: DiagnosticsChannel.ClientConnectedMessage = msg as any
      undici.log(`client:connected ${m.connectParams.protocol}//${m.connectParams.hostname}:${m.connectParams.port} ${m.connectParams.servername} -> ${m.socket.remoteAddress}`)
    })
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

  registerDownloadFactoryInterceptor(interceptor: (origin: URL, options: Agent.Options) => Dispatcher | undefined) {
    this.downloadClientFactories.unshift(interceptor)
    return this.downloadDispatcher
  }

  registerDispatchInterceptor(interceptor: (opts: DispatchOptions) => void) {
    this.dispatchInterceptors.unshift(interceptor)
  }

  getDispatcher() {
    return this.apiDispatcher
  }

  getDownloadDispatcher() {
    return this.downloadDispatcher
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
        headersTimeout: 5000,
      }).then(() => true, () => false),
      google.request({
        method: 'HEAD',
        path: '/',
        headersTimeout: 5000,
      }).then(() => false, () => true),
    ])
    this.logger.log(this.inGFW ? 'Detected current in China mainland.' : 'Detected current NOT in China mainland.')
    taobao.close()
    google.close()
  }

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
