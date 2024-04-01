import { ResourceDomain } from '../entities/resource'
import { ServiceKey } from './Service'

export interface ModMetadata {
  sha1: string
  name: string
  domain: ResourceDomain
  forge?: { id: string; version: string }
  fabric?: { id: string; version: string }
  modrinth?: { id: string; version: string }
  curseforge?: { id: number; file: number }
}

export interface ModMetadataService {
  getMetadataFromSha1(sha1: string): Promise<ModMetadata | undefined>
  getMetadataFromSha1s(sha1: string[]): Promise<ModMetadata[]>

  lookupModrinthId(projectId: number): Promise<string | undefined>
  lookupCurseforgeId(projectId: string): Promise<number | undefined>
  lookupMapping(lookup: {
    curseforge: number[]
    modrinth: string[]
  }): Promise<{
    curseforge?: Record<number, string>
    modrinth?: Record<string, number>
  }>
}

export const ModMetadataServiceKey: ServiceKey<ModMetadataService> = 'ModMetadataService'
