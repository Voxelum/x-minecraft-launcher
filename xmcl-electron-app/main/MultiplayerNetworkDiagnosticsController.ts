import { type IpcMain, type WebContents } from 'electron'
import { multiplayerNetworkDiagnosticsChannels } from '../multiplayerNetworkDiagnostics'
import { detectNatType, getDeviceInfo } from './networkDiagnostics'

export class MultiplayerNetworkDiagnosticsController {
  private readonly owners = new Set<number>()

  constructor(ipc: IpcMain) {
    ipc.handle(multiplayerNetworkDiagnosticsChannels.refresh, async ({ sender }, iceServers) => {
      if (!this.owners.has(sender.id)) throw new Error('multiplayer_network_diagnostics_forbidden')
      const [result, device] = await Promise.all([
        detectNatType(Array.isArray(iceServers) ? iceServers : []),
        getDeviceInfo(),
      ])
      return { ...result, device }
    })
  }

  attach(sender: WebContents) {
    this.owners.add(sender.id)
  }

  detach(senderId: number) {
    this.owners.delete(senderId)
  }
}
