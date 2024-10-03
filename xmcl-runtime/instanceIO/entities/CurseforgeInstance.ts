import { CurseforgeModpackManifest } from '@xmcl/runtime-api'

export interface CurseforgeInstance {
  baseModLoader: {
    forgeVersion?: string
    name: string
    downloadUrl: string
    versionJson: string
    minecraftVersion: string
    installProfileJson?: string
  }
  gameVersion: string
  javaArgsOverride?: string
  name: string
  lastPlayed: string
  manifest: CurseforgeModpackManifest
  projectID: number
  fileID: number
  customAuthor?: string
  isMemoryOverride: boolean
  allocatedMemory: number
  instancePath: string
  installedAddons: Array<{
    addonID: number
    installedFile: {
      id: number
      fileName: string
      downloadUrl: string
      packageFingerprint: number
      projectId: number
      FileNameOnDisk: string
      Hashes: { value: string }[]
    }
  }>
}
