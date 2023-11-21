/**
 * mmc-pack.json
 */
export interface MultiMCManifest {
  formatVersion: number
  components: MuultiMCManifestComponent[]
}

export interface MuultiMCManifestComponent {
  cachedName: string
  cachedVersion: string
  cachedRequires: [
    {
      equals?: string
      uid: string
    },
  ]
  important?: boolean
  uid: string
  version: string
}

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
