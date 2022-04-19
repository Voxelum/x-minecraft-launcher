import { IssueKey } from '../entities/issue'
import { AnyPersistedResource } from '../entities/resource'
import { ServiceKey } from './Service'

export const MissingAuthLibInjectorIssue: IssueKey<void> = 'missingAuthlibInjector'

export interface ExternalAuthSkinService {
  downloadCustomSkinLoader(type?: 'forge' | 'fabric'): Promise<AnyPersistedResource>
  installAuthLibInjection(): Promise<string>
}

export const ExternalAuthSkinServiceKey: ServiceKey<ExternalAuthSkinService> = 'ExternalAuthSkinService'
