import { ServiceKey, StatefulService } from './Service'

export type NatType = 'Blocked'| 'Open Internet'| 'Full Cone'| 'Symmetric UDP Firewall'| 'Restrict NAT'| 'Restrict Port NAT'| 'Symmetric NAT' | 'Unknown'

export class NatState {
  natType: NatType = 'Unknown'

  externalIp = ''
  externalPort = 0

  localIp = ''

  natDevice: NatDeviceInfo | undefined = undefined

  natDeviceSet(device: NatDeviceInfo) {
    this.natDevice = device
  }

  natAddressSet(address: string) {
    this.localIp = address
  }

  natTypeSet(type: NatType) {
    this.natType = type
  }

  natInfoSet(externalIp: string, externalPort: number) {
    this.externalIp = externalIp
    this.externalPort = externalPort
  }
}

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

interface Address {
  host?: string
  port: number
}

export interface MappingInfo {
  public: Address
  private: Required<Address>
  protocol: 'tcp' | 'udp'
  enabled: boolean
  description: string
  ttl: number
  local: boolean
}

export interface UpnpMapOptions {
  description?: string
  protocol?: 'tcp' | 'udp'
  public: Address | number | string
  private?: Address | number | string
  /**
   * Time to live in seconds
   */
  ttl?: number
}

export interface UpnpUnmapOptions {
  protocol?: 'tcp' | 'udp'
  public: Address | number | string
}

export interface NatService extends StatefulService<NatState> {
  refreshNatType(): Promise<void>
  isSupported(): Promise<boolean>
  getMappings(): Promise<MappingInfo[]>
  map(options?: UpnpMapOptions): Promise<void>
  unmap(options?: UpnpUnmapOptions): Promise<void>
}

export const NatServiceKey: ServiceKey<NatService> = 'NatService'
