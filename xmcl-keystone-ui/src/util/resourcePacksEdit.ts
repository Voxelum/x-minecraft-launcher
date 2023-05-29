import { compareRelease, compareSnapshot, isReleaseVersion, isSnapshotPreview } from '@xmcl/runtime-api'

export function normalizeResourcePackEditOption(packs: string[], mcVersion: string): string[] {
  //  resourcePacks:["vanilla","file/§lDefault§r..§l3D§r..Low§0§o.zip"]
  let resourcePacks: string[]
  if ((isReleaseVersion(mcVersion) && compareRelease(mcVersion, '1.13.0') >= 0) ||
    (isSnapshotPreview(mcVersion) && compareSnapshot(mcVersion, '17w43a') >= 0)) {
    resourcePacks = packs
      .map(r => (r !== 'vanilla' && !r.startsWith('file/') ? `file/${r}` : r))
    if (resourcePacks.every((p) => p !== 'vanilla')) {
      resourcePacks.unshift('vanilla')
    }
  } else {
    resourcePacks = packs.filter(r => r !== 'vanilla')
      .map(r => (r.startsWith('file/') ? r.substring(5) : r))
  }
  return resourcePacks
}
