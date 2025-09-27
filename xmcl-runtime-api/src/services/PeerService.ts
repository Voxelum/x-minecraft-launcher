import type { InstanceManifest } from '../entities/instanceManifest.schema'
import type { GenericEventEmitter } from '../events'
import type { ConnectionState, ConnectionUserInfo, IceGatheringState, Peer, SelectedCandidateInfo, SignalingState } from '../multiplayer'
import type { SharedState } from '../util/SharedState'
import type { ServiceKey } from './Service'

export type NatType = 'Blocked' | 'Open Internet' | 'Full Cone' | 'Symmetric UDP Firewall' | 'Restrict NAT' | 'Restrict Port NAT' | 'Symmetric NAT' | 'Unknown'

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
  icsServersPings = {} as Record<string, number | 'timeout'>
  ips = [] as string[]
  turnservers = {} as Record<string, string>
  group = ''
  groupState: 'connecting' | 'connected' | 'closing' | 'closed' = 'closed'
  groupError?: Error

  natDeviceInfo?: NatDeviceInfo
  natType: NatType = 'Unknown'

  exposedPorts: [number, number][] = []

  ping = 0
  timestamp = 0

  pingSet({ ping, timestamp }: { ping: number, timestamp: number }) {
    this.ping = ping
    this.timestamp = timestamp
  }

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

  validIceServerSet(servers: string[]) {
    this.validIceServers = servers
  }

  iceServerPingSet({ server, ping }: { server: string; ping: number | 'timeout' }) {
    this.icsServersPings = {
      ...this.icsServersPings,
      [server]: ping,
    }
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
  getPeerState(): Promise<SharedState<PeerState>>
  /**
    * Share the instance to other peers
    */
  shareInstance(options: ShareInstanceOptions): Promise<void>

  exposePort(port: number, protocol: number): Promise<void>

  unexposePort(port: number): Promise<void>
}

export const PeerServiceKey: ServiceKey<PeerService> = 'PeerServiceKey'
