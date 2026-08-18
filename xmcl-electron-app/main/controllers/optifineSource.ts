import type { OptifineVersion } from '@xmcl/runtime-api'

export type OptifineDownloadSource =
  | { type: 'mirror'; url: string }
  | { type: 'official'; fileName: string }

export function resolveOptifineDownloadSource(
  version: OptifineVersion,
  mirrorEnabled: boolean,
): OptifineDownloadSource {
  if (mirrorEnabled) {
    let minecraft = version.mcversion
    if (minecraft === '1.9' || minecraft === '1.8') minecraft += '.0'
    return {
      type: 'mirror',
      url: `https://bmclapi2.bangbang93.com/optifine/${minecraft}/${version.type}/${version.patch}`,
    }
  }
  return {
    type: 'official',
    fileName: version.patch.startsWith('pre')
      ? `preview_OptiFine_${version.mcversion}_${version.type}_${version.patch}.jar`
      : `OptiFine_${version.mcversion}_${version.type}_${version.patch}.jar`,
  }
}