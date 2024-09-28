import { InstanceManifest } from '../entities/instanceManifest.schema'
import { GenericEventEmitter } from '../events'
import { ConnectionState, ConnectionUserInfo, IceGatheringState, Peer, SelectedCandidateInfo, SignalingState } from '../multiplayer'
import { MutableState } from '../util/MutableState'
import { ServiceKey } from './Service'

export type NatType = 'Blocked'| 'Open Internet'| 'Full Cone'| 'Symmetric UDP Firewall'| 'Restrict NAT'| 'Restrict Port NAT'| 'Symmetric NAT' | 'Unknown'

export interface NatDeviceInfo {
  deviceType: string
  friendlyName: string
  manufacturer: string
  manufacturerURL: string
  modelDescription: string
  modelName: string
  modelURL: string
  serialNumber: string
  UDN: string
}
export class PeerState {
  connections = [] as Peer[]
  validIceServers = [] as string[]
  ips = [] as string[]
  turnservers = {} as Record<string, string>
  group = ''
  groupState: 'connecting' | 'connected' | 'closing' | 'closed' = 'closed'
  groupError?: Error

  natDeviceInfo?: NatDeviceInfo
  natType: NatType = 'Unknown'

  exposedPorts: [number, number][] = []

  natDeviceSet(device: NatDeviceInfo) {
    this.natDeviceInfo = device
  }

  natTypeSet(type: NatType) {
    this.natType = type
  }

  groupSet({ group, state }: { group: string; state: 'connecting' | 'connected' | 'closing' | 'closed' }) {
    this.group = group
    this.groupState = state
  }

  groupStateSet(state: 'connecting' | 'connected' | 'closing' | 'closed') {
    this.groupState = state
  }

  groupErrorSet(error: Error) {
    this.groupError = error
  }

  connectionClear() {
    this.connections = []
  }

  connectionUserInfo({ id, info }: { id: string; info: ConnectionUserInfo }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.userInfo = info
    }
  }

  connectionShareManifest({ id, manifest }: { id: string; manifest?: InstanceManifest }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.sharing = manifest
    }
  }

  connectionRemoteSet({ id, remoteId }: { id: string; remoteId: string }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.remoteId = remoteId
    }
  }

  connectionAdd(connection: Peer) {
    if (this.connections.find(c => c.id === connection.id)) {
      return
    }
    this.connections.push(connection)
  }

  connectionDrop(connectionId: string) {
    this.connections = this.connections.filter(c => c.id !== connectionId)
  }

  connectionIceServerSet({ id, iceServer }: { id: string; iceServer: RTCIceServer }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      if (conn.iceServer) {
        conn.triedIceServers.push(conn.iceServer)
      }
      conn.iceServer = iceServer
    }
  }

  connectionLocalDescription(update: { id: string; description: string }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.localDescriptionSDP = update.description
    }
  }

  connectionStateChange(update: { id: string; connectionState: ConnectionState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.connectionState = update.connectionState
    }
  }

  connectionSelectedCandidate({ id, local, remote }: {
    id: string
    local: SelectedCandidateInfo
    remote: SelectedCandidateInfo
  }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.selectedCandidate = {
        local,
        remote,
      }
    }
  }

  connectionPing(update: { id: string; ping: number }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.ping = update.ping
    }
  }

  connectionPreferredIceServers({ id, servers }: { id: string; servers: RTCIceServer[] }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.preferredIceServers = servers
    }
  }

  iceGatheringStateChange(update: { id: string; iceGatheringState: IceGatheringState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.iceGatheringState = update.iceGatheringState
    }
  }

  signalingStateChange(update: { id: string; signalingState: SignalingState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.signalingState = update.signalingState
    }
  }

  connectionIceServersSet({ id, iceServer }: { id: string; iceServer: RTCIceServer }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.iceServer = iceServer
      conn.triedIceServers = [...conn.triedIceServers, conn.iceServer]
    }
  }

  validIceServerSet(servers: string[]) {
    this.validIceServers = servers
  }

  ipsSet(ips: string[]) {
    this.ips = ips
  }

  turnserversSet(meta: Record<string, string>) {
    this.turnservers = meta
  }

  exposedPortsSet(ports: [number, number][]) {
    this.exposedPorts = ports
  }
}

export interface ShareInstanceOptions {
  instancePath: string
  manifest?: InstanceManifest
}

interface PeerServiceEvents {
  share: { id: string; manifest?: InstanceManifest }
}

export interface PeerService extends GenericEventEmitter<PeerServiceEvents> {
  getPeerState(): Promise<MutableState<PeerState>>
  /**
    * Share the instance to other peers
    */
  shareInstance(options: ShareInstanceOptions): Promise<void>

  exposePort(port: number, protocol: number): Promise<void>

  unexposePort(port: number): Promise<void>
}

export const PeerServiceKey: ServiceKey<PeerService> = 'PeerServiceKey'
