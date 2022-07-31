import { Resource } from '../entities/resource'
import { IssueKey } from '../entities/issue'
import { ServiceKey } from './Service'

export const MissingAuthLibInjectorIssue: IssueKey<void> = 'missingAuthlibInjector'

export interface ExternalAuthSkinService {
  downloadCustomSkinLoader(type?: 'forge' | 'fabric'): Promise<Resource>
  installAuthLibInjection(): Promise<string>
}

export const ExternalAuthSkinServiceKey: ServiceKey<ExternalAuthSkinService> = 'ExternalAuthSkinService'
