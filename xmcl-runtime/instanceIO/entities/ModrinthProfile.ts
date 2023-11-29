import { Project, ProjectVersion } from '@xmcl/modrinth'

export interface ModrinthProfile {
  install_stage: 'installed' | string
  /**
   * like 'Aged' the relative path
   */
  path: string
  metadata: {
    name: string
    icon: string
    groups: string[]
    game_version: string
    /**
     * fabric or forge
     */
    loader: string
    loader_version: {
      /**
       * like 0.14.21
       */
      id: string
      /**
       * like https://meta.modrinth.com/fabric/v0/versions/0.14.21.json
       */
      url: string
      stable: boolean
    }
    linked_data: {
      project_id: string
      version_id: string
      locked: boolean
    }
    date_created: string
    date_modified: string
    last_played: string
    submitted_time_played: number
    recent_time_played: number
  }
  /**
   * The modrinth version id
   */
  modrinth_update_version: string

  /**
   * The key is the relative path to the project.
   * Splited by the path splitter.
   */
  projects: Record<string, {
    sha512: string
    disabled: boolean
    file_name: string
    metadata: {
      type: string
      project: Project
      version: ProjectVersion | string | null
      update_version: ProjectVersion | null
      incompatible: boolean
    }
  }>
}
