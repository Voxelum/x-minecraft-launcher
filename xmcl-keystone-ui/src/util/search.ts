import { Mod } from '@xmcl/curseforge'
import { SearchResultHit } from '@xmcl/modrinth'
import { ResourceSourceCurseforge, ResourceSourceModrinth } from '@xmcl/resource'
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
   * An optional content-type marker used when a single market list mixes
   * multiple content kinds (e.g. the save market shows both worlds and data
   * packs). Set by the search composable that produced the entry.
   */
  contentType?: string
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
