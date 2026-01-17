import { DefaultRangePolicy } from '@xmcl/file-transfer'
import { NetworkStatus } from '@xmcl/runtime-api'
import {
  Agent,
  Pool,
  buildConnector,
  interceptors
} from 'undici'
import { LauncherAppPlugin } from '~/app'
import { kSettings } from '~/settings'
import { NetworkAgent, ProxySettingController } from './NetworkAgent'
import { SpeedMonitor, TrackSpeedHandler } from './TrackSpeedHandler'
import { kDownloadOptions, kNetworkInterface } from './networkInterface'

export const pluginNetworkInterface: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('NetworkInterface')
  const userAgent = app.userAgent

  let maxConnection = 64
  const connectorOptions: buildConnector.BuildOptions = {
    timeout: 25_000,
    rejectUnauthorized: false,
    requestCert: false,
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 850,
  }

  const globalProxyHttps = process.env.HTTPS_PROXY || process.env.https_proxy

  const proxyControl = new ProxySettingController()
  app.registry.get(kSettings).then((state) => {
    maxConnection = state.maxSockets > 0 ? state.maxSockets : 64
    proxyControl.setProxyEnabled(state.httpProxyEnabled)
    const proxy = state.httpProxy || globalProxyHttps
    if (proxy) {
      try {
        proxyControl.setProxy(new URL(proxy))
        app.setProxy(proxy)
      } catch (e) {
        logger.warn(`Fail to set url as it's not a valid url ${proxy}`, e)
      }
    }

    state.subscribe('maxSocketsSet', (val) => {
      maxConnection = val > 0 ? val : 64
    })
    state.subscribe('httpProxySet', (p) => {
      app.setProxy(p)
      try {
        proxyControl.setProxy(new URL(p))
      } catch (e) {
        logger.warn(`Fail to set url as it's not a valid url ${p}`, e)
      }
    })
    state.subscribe('httpProxyEnabledSet', (e) => {
      proxyControl.setProxyEnabled(e)
      app.setProxy(e ? state.httpProxy || globalProxyHttps || '' : '')
    })
  })

  const patchPool = (origin: string, dispatcher: Pool) => {
    const keys = Reflect.ownKeys(dispatcher)
    const kConnections = keys.find((k) => typeof k === 'symbol' && k.description === 'connections')
    if (kConnections) {
      Object.defineProperty(dispatcher, kConnections, {
        get: () => {
          if (origin.endsWith('bmclapi2.bangbang93.com')) {
            return Math.max(32, maxConnection)
          }
          return maxConnection
        },
      })
    }
    return dispatcher
  }

  const speedMonitor = new SpeedMonitor()
  let onNetworkActivityChangeCallback = (v: boolean) => {}
  const agent = new NetworkAgent(
    {
      userAgent,
      factory: (connect) =>
        new Agent({
          headersTimeout: 25_000,
          bodyTimeout: 10_000,
          connect,
          factory: (origin, opts) => {
            if (origin.toString().endsWith('bmclapi2.bangbang93.com')) {
              return new Pool(origin, { ...opts, connections: 16 })
            }
            return patchPool(origin.toString(), new Pool(origin, opts))
          },
        }).compose(
          (dispatch) => {
            return function Intercept(opts, handler) {
              return dispatch(opts, new TrackSpeedHandler(handler, speedMonitor))
            }
          },
          interceptors.retry({
            errorCodes: [
              'UND_ERR_CONNECT_TIMEOUT',
              'UND_ERR_HEADERS_TIMEOUT',
              'UND_ERR_BODY_TIMEOUT',
              'ECONNRESET',
              'ECONNREFUSED',
              'ENOTFOUND',
              'ENETDOWN',
              'ETIMEDOUT',
              'ENETUNREACH',
              'EHOSTDOWN',
              'EHOSTUNREACH',
              'EPIPE',
              'UND_ERR_SOCKET',
            ],
            statusCodes: [567, 500, 502, 503, 504, 429],
            maxRetries: 3,
          }),
          interceptors.redirect({
            maxRedirections: 5,
          }),
        ) as Agent,
      proxyTls: connectorOptions,
      requestTls: connectorOptions,
    },
    (active) => {
      onNetworkActivityChangeCallback(active)
    },
  )

  proxyControl.add(agent)
  app.registry.register(kDownloadOptions, {
    dispatcher: agent,
    rangePolicy: new DefaultRangePolicy(
      1024 * 1024 * 5, // 5MB
      4,
    ),
  })

  const getNetworkStatus = () => {
    const nStatus: NetworkStatus = {
      pools: {},
      downloadSpeed: speedMonitor.sample(),
    }
    const clients = agent.getClients()
    for (const [k, v] of clients.entries()) {
      if (v.dispatcher instanceof Pool) {
        const d = v.dispatcher
        const connected = d.stats.connected
        const free = d.stats.free
        const pending = d.stats.pending
        const queued = d.stats.queued
        const running = d.stats.running
        const size = d.stats.size
        const status = { connected, free, pending, queued, running, size }
        nStatus.pools[k] = status
      }
    }
    return nStatus
  }

  app.registry.register(kNetworkInterface, {
    onNetworkActivityChange(callback: (active: boolean) => void): void {
      onNetworkActivityChangeCallback = callback
    },
    getNetworkStatus,
    destroyPool(origin) {
      return agent.destroyClient(origin)
    },
  })
}
