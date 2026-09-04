import type { LauncherAppPlugin } from '@xmcl/runtime/app'
import {
  kMultiplayerHostFactory,
  type MultiplayerHost,
} from '@xmcl/runtime/peer'
import { createTogetherMultiplayer } from '@xmcl/multiplayer-core/multiplayer'
import { createTogetherRoomApi } from '@xmcl/multiplayer-core/room'
import ElectronLauncherApp from './ElectronLauncherApp'
import { ElectronController } from './ElectronController'
import defaultApp from './defaultApp'
import { createMainLocalNetwork, createMainSharedFiles } from './mainMultiplayerAdapters'
import { createMultiplayerTelemetryReporter } from './multiplayerTelemetry'

export const pluginMultiplayer: LauncherAppPlugin = (rawApp) => {
  const app = rawApp as ElectronLauncherApp
  const hosts = new Set<MultiplayerHost>()
  const pending = new Set<Promise<MultiplayerHost>>()
  let cleanupNodeDataChannel: (() => Promise<void>) | undefined

  const createHost = async (options: Parameters<import('@xmcl/runtime/peer').MultiplayerHostFactory>[0]) => {
    const electronSession = app.session.getSession(defaultApp.url)
    const localNetwork = createMainLocalNetwork((family, error) => {
      options.log({
        level: 'warn',
        event: 'together.lan.family_start_failed',
        data: {
          family,
          error: error instanceof Error ? error.message : String(error),
        },
      })
    })
    const sharedFiles = createMainSharedFiles()
    const telemetry = createMultiplayerTelemetryReporter({
      baseUrl: options.init.signalingBaseUrl,
      deviceId: options.init.sessionId,
      launcherSessionId: options.init.launcherSessionId,
      getAccountId: options.getTelemetryAccountId,
      launcherVersion: app.version,
      launcherBuild: String(app.build),
      isEnabled: options.isTelemetryEnabled,
      fetch: (url, init) => electronSession.fetch(url, init),
      warn: (message) => app.getLogger('MultiplayerTelemetry').warn(message),
    })

    let providerClosed: Promise<void> | undefined
    const peerConnectionProvider = options.transport === 'node-datachannel'
      ? await import('@xmcl/wrtc-multiplayer').then(({
          cleanupNodeDataChannel: cleanup,
          createNodeDataChannelPeerConnectionProvider,
        }) => {
          cleanupNodeDataChannel = cleanup
          return createNodeDataChannelPeerConnectionProvider(options.init.appDataPath)
        })
      : await (app.controller as ElectronController).browserRtc.getProvider().then((provider) => {
          providerClosed = provider.closed
          return provider
        })
    const multiplayer = createTogetherMultiplayer({
      localNetwork,
      sharedFiles,
      peerConnectionProvider,
      waitForIceServersBeforePeer: options.transport === 'node-datachannel',
      logger: { emit: options.log },
      createTelemetryAttempt: telemetry.beginAttempt,
      setDownloadPort: async (port) => options.setDownloadPort(port),
      roomApi: createTogetherRoomApi({
        getBaseUrl: () => options.init.signalingBaseUrl,
        fetch: (url, init) => electronSession.fetch(url, init),
      }),
    })

    try {
      multiplayer.setState(options.state)
      await multiplayer.start(options.init.sessionId)
    } catch (error) {
      await multiplayer.dispose().catch(() => {})
      await localNetwork.dispose().catch(() => {})
      await telemetry.dispose()
      throw error
    }

    let disposePromise: Promise<void> | undefined
    const closed = Promise.withResolvers<void>()
    const host = {
      ...multiplayer,
      closed: closed.promise,
      dispose() {
        disposePromise ??= multiplayer.dispose().finally(async () => {
          try {
            await localNetwork.dispose()
          } finally {
            try {
              await telemetry.dispose()
            } finally {
              hosts.delete(host)
              closed.resolve()
            }
          }
        })
        return disposePromise
      },
    } satisfies MultiplayerHost
    hosts.add(host)
    void providerClosed?.then(() => host.dispose())
    return host
  }

  app.registry.register(kMultiplayerHostFactory, (options) => {
    const operation = createHost(options)
    pending.add(operation)
    void operation.finally(() => pending.delete(operation)).catch(() => {})
    return operation
  })

  app.registryDisposer(async () => {
    while (pending.size > 0) {
      await Promise.allSettled(Array.from(pending))
    }
    await Promise.allSettled(Array.from(hosts, (host) => host.dispose()))
    hosts.clear()
    await cleanupNodeDataChannel?.()
  })
}