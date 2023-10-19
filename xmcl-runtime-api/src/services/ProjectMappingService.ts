import { ServiceKey } from './Service'
export interface ProjectMappingService {
  lookupByModrinth(modrinth: string): Promise<number | undefined>
  lookupByCurseforge(curseforge: string): Promise<string | undefined>
}

export const ProjectMappingServiceKey: ServiceKey<ProjectMappingService> = 'ProjectMappingService'
