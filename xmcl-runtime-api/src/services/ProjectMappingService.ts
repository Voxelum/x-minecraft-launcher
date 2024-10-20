import { ServiceKey } from './Service'

export interface ProjectMapping {
  modrinthId: string
  curseforgeId: number
  name: string
  description: string
}

export interface ProjectMappingService {
  lookupByModrinth(modrinth: string): Promise<ProjectMapping | undefined>
  lookupByCurseforge(curseforge: number): Promise<ProjectMapping | undefined>

  lookupBatch(modrinth: string[], curseforge: number[]): Promise<ProjectMapping[]>
}

export const ProjectMappingServiceKey: ServiceKey<ProjectMappingService> = 'ProjectMappingService'
