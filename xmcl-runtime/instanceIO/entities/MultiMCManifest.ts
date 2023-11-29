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
