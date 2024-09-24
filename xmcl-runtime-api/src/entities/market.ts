import { File } from '@xmcl/curseforge'
import { ModVersionFile, ProjectVersion } from '@xmcl/modrinth'

export type InstallMarketOptionsModrinth = {
  market: MarketType.Modrinth
  /**
   * The modrinth version
   */
  version: ProjectVersion

  file?: ModVersionFile
}

export type InstallMarketOptionsCurseforge = {
  market: MarketType.CurseForge
  /**
   * The curseforge file
   */
  file: File
}

export type InstallMarketOptions = (InstallMarketOptionsModrinth | InstallMarketOptionsCurseforge) & {
  /**
   * The icon of the file
   */
  icon?: string
}

export type InstallMarketOptionWithInstance = InstallMarketOptions & {
  instancePath: string
}

export enum MarketType {
  Modrinth,
  CurseForge,
}
