import { queryStatus } from '@xmcl/client'
import { createFailureServerStatus, PingServerOptions, protocolToMinecraft, ServerStatusService as IServerStatusService, ServerStatusServiceKey } from '@xmcl/runtime-api'
import { isSystemError } from '@xmcl/utils'
import { resolveSrv } from 'dns/promises'
import { isIP } from 'net'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, Inject } from '~/app'
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

  /**
   * Resolve the real connection target for a Minecraft server address.
   *
   * When the user did not provide an explicit port and the host is a domain
   * name (not an IP literal), look up the `_minecraft._tcp.<host>` SRV record,
   * mirroring the vanilla client. Many servers — especially those behind a
   * proxy like `je.czumc.cn` — only publish an SRV record and have no A record
   * on the bare host, so a direct connect would fail with `ENOTFOUND`.
   *
   * Falls back to `host:25565` when there is no SRV record or the lookup fails.
   */
  private async resolveServerAddress(host: string, port: number | undefined): Promise<{ host: string; port: number }> {
    if (port === undefined && isIP(host) === 0) {
      try {
        const records = await resolveSrv(`_minecraft._tcp.${host}`)
        if (records.length > 0) {
          // Prefer the lowest priority, then the highest weight, matching the
          // SRV record selection rules from RFC 2782.
          const best = records.reduce((a, b) =>
            (b.priority < a.priority || (b.priority === a.priority && b.weight > a.weight)) ? b : a)
          this.log(`Resolved SRV record for ${host}: ${best.name}:${best.port}`)
          return { host: best.name, port: best.port }
        }
      } catch (e) {
        // No SRV record (ENODATA/ENOTFOUND) or lookup failure — fall back to the
        // bare host on the default port below.
      }
    }
    return { host, port: port ?? 25565 }
  }

  async pingServer(options: PingServerOptions) {
    const { protocol } = options
    const { host, port } = await this.resolveServerAddress(options.host, options.port)
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
