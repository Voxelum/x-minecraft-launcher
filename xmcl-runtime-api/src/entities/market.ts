type ModrinthVersionIdentifier = {
  versionId: string
  filename?: string
  icon?: string
}

export type InstallMarketOptionsModrinth = {
  market: MarketType.Modrinth

  version: ModrinthVersionIdentifier | ModrinthVersionIdentifier[]
}

type CurseforgeFileIdentifier = {
  fileId: number
  icon?: string
}

export type InstallMarketOptionsCurseforge = {
  market: MarketType.CurseForge

  file: CurseforgeFileIdentifier | CurseforgeFileIdentifier[]
}

export type InstallMarketOptions = InstallMarketOptionsModrinth | InstallMarketOptionsCurseforge

export type InstallMarketOptionWithInstance = InstallMarketOptions & {
  instancePath: string
}

export enum MarketType {
  Modrinth,
  CurseForge,
}
