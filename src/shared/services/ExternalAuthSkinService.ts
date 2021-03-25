import { AnyPersistedResource } from '../entities/resource'
import { ServiceKey } from './Service'
export interface ExternalAuthSkinService {
  downloadCustomSkinLoader(type?: 'forge' | 'fabric'): Promise<AnyPersistedResource>
  installAuthlibInjection(): Promise<string>
}

export const ExternalAuthSkinServiceKey: ServiceKey<ExternalAuthSkinService> = 'ExternalAuthSkinService'
