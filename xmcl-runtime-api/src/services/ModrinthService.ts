import type { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult, TeamMember } from '@xmcl/modrinth'
import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'

export interface InstallProjectVersionOptions {
  version: ProjectVersion

  project?: Project
  /**
   * Ignore the dependencies of the version.
   *
   * This option will be ignore if this is a modpack.
   *
   * @default false
   */
  ignoreDependencies?: boolean
  /**
   * The instance to install to.
   *
   * - If this is a mod, it will enable it.
   * - If this is a modpack, this option will be ignored.
   */
  instancePath?: string
}

export interface InstallModrinthVersionResult {
  version: ProjectVersion
  resources: Resource[]
  dependencies: InstallModrinthVersionResult[]
}

export interface GetProjectVersionsOptions {
  projectId: string
  featured?: boolean
  gameVersions?: string[]
  loaders?: string[]
}

export interface ModrinthService {
  searchProjects(options: SearchProjectOptions): Promise<SearchResult>

  getProject(projectId: string): Promise<Project>

  getLocaledProject(projectId: string): Promise<Project>

  getProjectVersions(options: GetProjectVersionsOptions): Promise<ProjectVersion[]>

  getProjectVersion(versionId: string): Promise<ProjectVersion>

  getLatestProjectVersion(hash: string): Promise<ProjectVersion>

  getProjectTeamMembers(projectId: string): Promise<TeamMember[]>

  getTags(): Promise<{ licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }>

  installVersion(options: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult>

  resolveDependencies(version: ProjectVersion): Promise<ProjectVersion[]>
}

export const ModrinthServiceKey: ServiceKey<ModrinthService> = 'ModrinthService'
