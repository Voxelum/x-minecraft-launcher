export interface FTBModpackManifest {
  synopsis: string
  description: string
  art: FTBArt[]
  authors: FTBAuthor[]
  versions: FTBVersion[]
  installs: number
  /**
   * number of play
   */
  plays: number
  featured: boolean
  refreshed: number
  status: string
  id: number
  name: string
  type: string
  updated: number
  tags: { id: number; name: string }[]
}

export interface FTBArt {
  width: number
  height: number
  url: string
  sha1: string
  size: number
  id: number
  type: string
  updated: number
}

export interface FTBAuthor {
  website: string
  id: number
  name: string
  type: string
  updated: number
}

export interface FTBVersion {
  specs: FTBSpecs
  id: number
  name: string
  type: string
  updated: number
}

export interface FTBSpecs {
  id: number
  minimum: number
  recommended: number
}

export interface FTBModpackVersionManifest {
  /**
   * The list of file in this modpack
   */
  files: FTBFile[]
  specs: FTBSpecs
  targets: FTBTarget[]
  installs: number
  plays: number
  refreshed: number
  status: string
  changelog: string
  parent: number
  id: number
  name: string
  type: string
  updated: number
}

export interface FTBFile {
  version: string
  /**
   * The file path relative to the instance root (without name)
   */
  path: string
  /**
   * Download url
   */
  url?: string
  sha1: string
  size: number
  tags: string[]
  clientonly: boolean
  serveronly: boolean
  optional: boolean
  id: number
  curseforge?: {project: number; file: number}
  /**
   * The file name
   */
  name: string
  type: string
  updated: number
}

/**
 * The target is like the required runtime.
 *
 * For example, name: "minecraft", version: "1.16.4", type: "game" is Minecraft 1.16.4
 * name: "forge", version: "31.1.30", type: "modloader" is Minecraft 1.16.4
 */
export interface FTBTarget {
  version: string
  id: number
  name: string
  type: string
  updated: number
}
