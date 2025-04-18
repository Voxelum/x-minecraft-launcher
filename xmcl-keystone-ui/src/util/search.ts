import { Mod } from '@xmcl/curseforge'
import { SearchResultHit } from '@xmcl/modrinth'
import { ResourceSourceCurseforge, ResourceSourceModrinth } from '@xmcl/runtime-api'
import { TextComponent } from '@xmcl/text-component'

/**
 * Represent a project
 */
export interface ProjectEntry<T extends ProjectFile = ProjectFile> {
  /**
   * The id is representing the id of the project
   */
  id: string
  icon: string
  title: string
  localizedTitle?: string
  description: string
  localizedDescription?: string
  descriptionTextComponent?: TextComponent
  author: string

  unsupported?: boolean

  disabled?: boolean

  downloadCount?: number
  followerCount?: number

  /**
   * The installed file
   */
  installed: T[]
  /**
   * The curseforge search result
   */
  curseforge?: Mod
  curseforgeProjectId?: number
  /**
   * The modrinth search result
   */
  modrinth?: SearchResultHit
  modrinthProjectId?: string
  /**
   * The files under resources storage
   */
  files?: T[]
}

export interface ProjectFile {
  path: string
  version: string
  mtime: number
  enabled: boolean
  modrinth?: ResourceSourceModrinth
  curseforge?: ResourceSourceCurseforge
}
