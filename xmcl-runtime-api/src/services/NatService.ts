import { ServiceKey, StatefulService } from './Service'

export type NatType = 'Blocked'| 'Open Internet'| 'Full Cone'| 'Symmetric UDP Firewall'| 'Restrict NAT'| 'Restrict Port NAT'| 'Symmetric NAT' | 'Unknown'

export class NatState {
  natType: NatType = 'Unknown'

  externalIp = ''
  externalPort = 0

  natTypeSet(type: NatType) {
    this.natType = type
  }

  natInfoSet(externalIp: string, externalPort: number) {
    this.externalIp = externalIp
    this.externalPort = externalPort
  }
}

export interface NatService extends StatefulService<NatState> {
  refreshNatType(): Promise<void>
}

export const NatServiceKey: ServiceKey<NatService> = 'NatService'
