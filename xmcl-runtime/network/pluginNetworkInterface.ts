import { DefaultRangePolicy } from '@xmcl/file-transfer'
import { NetworkStatus } from '@xmcl/runtime-api'
import { join } from 'path'
import {
  Agent,
  Pool,
  buildConnector,
  interceptors
} from 'undici'
import { LauncherAppPlugin } from '~/app'
import { IS_DEV } from '~/constant'
import { kFlights } from '~/infra'
import { kSettings } from '~/settings'
import { BmclDownloadController } from './BmclDownloadController'
import { NetworkAgent, ProxySettingController } from './NetworkAgent'
import { SpeedMonitor, TrackSpeedHandler } from './TrackSpeedHandler'
import { kDownloadController, kDownloadOptions, kNetworkInterface } from './networkInterface'

export const pluginNetworkInterface: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('NetworkInterface')
  const userAgent = app.userAgent

  const downloadController = new BmclDownloadController()
  app.registry.register(kDownloadController, downloadController)
  downloadController.load(join(app.appDataPath, 'download-reputation.json')).catch(() => {})
  app.registryDisposer(() => downloadController.save())

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

    const updateReassignableHosts = () => {
      const hosts: string[] = []
      for (const set of state.apiSets) {
        try {
          if (set.url) hosts.push(new URL(set.url).hostname)
        } catch {
          // ignore malformed api-set urls
        }
      }
      downloadController.setReassignableHosts(hosts)
    }
    updateReassignableHosts()
    state.subscribe('apiSetsSet', updateReassignableHosts)

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
  const speedMonitorSnapshot = new SpeedMonitor()
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
              // Feed both the UI speed monitor and the snapshot monitor
              // (each is sampled independently, so neither resets the
              // other).
              return dispatch(
                opts,
                new TrackSpeedHandler(
                  new TrackSpeedHandler(handler, speedMonitor),
                  speedMonitorSnapshot,
                ),
              )
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

  // Periodic download-distribution snapshot. Surfaces the "downloads
  // stuck with no speed" situation: the adaptive controller's per-host
  // throughput / stall / re-roll stats plus the live undici pool stats
  // (connected/running/pending/queued) per origin. Only logs while there
  // is activity, every few seconds.
  //
  // This is a diagnostic, so it is OFF in production by default: it runs
  // in dev builds, or when explicitly enabled via the `downloadSnapshot`
  // flight (see infra/flights.ts) for remote-controlled troubleshooting.
  const startSnapshotTimer = () => {
    const snapshotTimer = setInterval(() => {
      try {
        const controllerLine = downloadController.snapshot()
        const pools: string[] = []
        let totalPending = 0
        let totalQueued = 0
        let totalRunning = 0
        let totalConnected = 0
        const clients = agent.getClients()
        for (const [origin, v] of clients.entries()) {
          if (v.dispatcher instanceof Pool) {
            const s = v.dispatcher.stats
            totalPending += s.pending
            totalQueued += s.queued
            totalRunning += s.running
            totalConnected += s.connected
            if (s.connected || s.running || s.pending || s.queued) {
              let host = origin
              try {
                host = new URL(origin).host
              } catch {}
              pools.push(`${host}{c:${s.connected} r:${s.running} p:${s.pending} q:${s.queued}}`)
            }
          }
        }
        if (!controllerLine && pools.length === 0) return
        const aggSpeed = speedMonitorSnapshot.sample()
        logger.log(
          `[dl-snapshot] realAgg=${(aggSpeed / 1024 / 1024).toFixed(2)}MB/s ` +
            `conns{connected:${totalConnected} running:${totalRunning} pending:${totalPending} queued:${totalQueued}} ` +
            (controllerLine ? `| ${controllerLine} ` : '') +
            (pools.length ? `| pools: ${pools.slice(0, 8).join(' ')}` : ''),
        )
      } catch (e) {
        logger.warn('[dl-snapshot] failed')
        logger.warn(e as any)
      }
    }, 4000)
    snapshotTimer.unref?.()
    app.registryDisposer(() => clearInterval(snapshotTimer))
  }

  if (IS_DEV) {
    startSnapshotTimer()
  } else {
    app.registry
      .get(kFlights)
      .then((flights) => {
        if (flights.downloadSnapshot) startSnapshotTimer()
      })
      .catch(() => {})
  }
}

