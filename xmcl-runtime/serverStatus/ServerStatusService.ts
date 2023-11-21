import { queryStatus } from '@xmcl/client'
import { createFailureServerStatus, PingServerOptions, protocolToMinecraft, ServerStatusService as IServerStatusService, ServerStatusServiceKey } from '@xmcl/runtime-api'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, Inject } from '~/app'
import { isSystemError } from '../util/error'
import { AbstractService, ExposeServiceKey } from '~/service'

@ExposeServiceKey(ServerStatusServiceKey)
export class ServerStatusService extends AbstractService implements IServerStatusService {
  private protocolToVersions: Record<number, string[]> = protocolToMinecraft

  private versionToProtocols: Record<string, number> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, async () => {
      // const protocolFile = this.getAppDataPath('protocol.json')
      // if (await exists(protocolFile)) {
      //   const buf = await readFile(protocolFile)
      //   const object = JSON.parse(buf.toString())
      //   if (object.eTag) {
      //     // request server for new one
      //   }
      //   const mcversionMapping: any = {}
      //   for (const [mc, prot] of Object.entries(object.protocol)) {
      //     if (!mcversionMapping[mc]) mcversionMapping[mc] = []
      //     mcversionMapping[mc].push(prot)
      //   }
      //   this.commit('protocolMapping', {
      //     protocol: object.protocol,
      //     mcversion: mcversionMapping,
      //   })
      // } else {
      //   const rev = await readJSON(protocolPath)
      //   const forward = await readJSON(mcProtocolPath)

      //   this.commit('protocolMapping', {
      //     protocol: forward,
      //     mcversion: rev,
      //   })
      // }

      for (const [protocol, versions] of Object.entries(protocolToMinecraft)) {
        for (const version of versions) {
          this.versionToProtocols[version] = Number.parseInt(protocol)
        }
      }
    })
  }

  getAcceptMinecraftVersion(protocol: number): string[] {
    return this.protocolToVersions[protocol]
  }

  getProtocolVersion(mcversion: string): number {
    return this.versionToProtocols[mcversion]
  }

  async pingServer(options: PingServerOptions) {
    const { host, port = 25565, protocol } = options
    this.log(`Ping server ${host}:${port} with protocol: ${protocol}`)
    try {
      const status = await queryStatus({ host, port }, { protocol })
      return status
    } catch (e) {
      if (e && e instanceof Error && e.message === 'Connection timeout.') {
        return createFailureServerStatus('serverStatus.timeout')
      }
      if (isSystemError(e)) {
        switch (e.code) {
          case 'ETIMEOUT':
            return createFailureServerStatus('serverStatus.timeout')
          case 'ENOTFOUND':
            return createFailureServerStatus('serverStatus.nohost')
          case 'ECONNREFUSED':
            return createFailureServerStatus('serverStatus.refuse')
          default:
        }
      }
      return createFailureServerStatus('serverStatus.refuse')
    }
  }

  // @Pure()
  // async pingServers() {
  //   const version = this.getters.instanceProtocolVersion
  //   if (this.state.instanceServerInfo.serverInfos.length > 0) {
  //     const results = await Promise.all(this.state.instanceServerInfo.serverInfos.map(s => queryStatus({ host: s.ip, port: 25565 }, { protocol: version })))
  //     return results.map((r, i) => ({ status: r, ...this.state.instanceServerInfo.serverInfos[i] }))
  //   }
  //   return []
  // }
}
