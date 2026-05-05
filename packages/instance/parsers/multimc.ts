/**
 * MultiMC instance configuration interface
 */
export interface MultiMCConfig {
  JavaPath: string
  name: string
  JvmArgs: string
  MaxMemAlloc: string
  MinMemAlloc: string
  ShowConsole: string
  lastTimePlayed: string
  totalTimePlayed: string
  notes: string
  MinecraftWinWidth: string
  MinecraftWinHeight: string
  JoinServerOnLaunch: string
  JoinServerOnLaunchAddress: string
}

/**
 * MultiMC pack manifest (mmc-pack.json)
 */
export interface MultiMCManifest {
  formatVersion: number
  components: MultiMCManifestComponent[]
}

export interface MultiMCManifestComponent {
  cachedName: string
  cachedVersion: string
  cachedRequires: Array<{
    equals?: string
    uid: string
  }>
  important?: boolean
  uid: string
  version: string
}
