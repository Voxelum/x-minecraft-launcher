import type { ResolvedLibrary } from '@xmcl/core'
import { ServiceKey } from './Service'

export interface ElyByService {
  installAuthlib(minecraftVersion: string): Promise<ResolvedLibrary | undefined>
}

export const ElyByServiceKey: ServiceKey<ElyByService> = 'ElyByService'
