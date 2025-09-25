import { BoreClient } from '@xmcl/bore'
import { protocolToMinecraft } from '@xmcl/runtime-api'
import { LauncherAppPlugin } from '~/app'
import { InstanceOptionsService } from '~/instance'
import { LaunchService } from '~/launch'
import { PeerService } from '~/peer'

export const pluginExposeServer: LauncherAppPlugin = async (app) => {
  const launchService = await app.registry.get(LaunchService)
  const opsService = await app.registry.get(InstanceOptionsService)
  const logger = app.getLogger('ExposeServer')

  const clients = {} as Record<string, BoreClient | undefined>
  // Expose server
  launchService.registerMiddleware({
    name: 'expose-server',
    async onBeforeLaunch(input, payload, ctx) {
      if (payload.side === 'client') return

      const bore = input.bore
      const ops = await opsService.getServerProperties(input.gameDirectory)
      const localPort = Number(ops.port) || 25565
      ctx.port = localPort

      if (bore) {
        if (clients[localPort]) {
          // error
          return
        }
        const client = new BoreClient({
          ...bore, localPort: localPort,
          logger: {
            log: (message: string) => logger.log(message),
            warn: (message: string) => logger.warn(message),
            error: (message: string, error?: any) => {
              if (error instanceof Error) {
                logger.error(error)
              } else {
                logger.log(`Error: ${message}`, error)
              }
            }
          }
        })
        client.start().then((remote) => {
          ctx.remotePort = remote
          logger.log(`Bore tunnel established on port ${remote}`)
        })
        clients[localPort] = client
      }

      const peer = await app.registry.getIfPresent(PeerService)
      if (peer) {
        const ver = payload.version.minecraftVersion
        const minecraftToProtocol: Record<string, number> = {}
        for (const [protocol, vers] of Object.entries(protocolToMinecraft)) {
          for (const v of vers) {
            minecraftToProtocol[v] = parseInt(protocol)
          }
        }
        peer.exposePort(localPort, minecraftToProtocol[ver] ?? 765)
      }
    },
    async onExit(result, input, payload, context) {
      if (payload.side === 'client') return
      const localPort = context.port

      if (localPort) {
        const client = clients[localPort]
        client?.stop()
        delete clients[localPort]

        const peer = await app.registry.getIfPresent(PeerService)
        if (peer) {
          peer.unexposePort(localPort)
        }
      }
    },
  })
}
