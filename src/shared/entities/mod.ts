import type { ForgeModMetadata } from '@xmcl/mod-parser'

export interface ForgeModCommonMetadata extends ForgeModMetadata {
  modid: string
  /**
     * Display name
     */
  name: string
  /**
     * Logo file path
     */
  logoFile: string

  /**
     * Description of the mod
     */
  description: string

  authors: string[]

  version: string
  /**
     * Accept minecraft version range
     */
  acceptMinecraft: string
  /**
     * Accept forge version range
     */
  acceptForge: string
}

export function normalizeForgeModMetadata (metadata: ForgeModMetadata): ForgeModCommonMetadata {
  const result: ForgeModCommonMetadata = {
    modid: '',
    name: '',
    version: '',
    acceptForge: '',
    acceptMinecraft: '',
    authors: [],
    logoFile: '',
    description: '',
    ...metadata,
  }
  if (metadata.modsToml.length > 0) {
    const modInfo = metadata.modsToml[0]
    const annotation = metadata.modAnnotations[0]

    result.modid = modInfo.modid
    result.name = modInfo.displayName
    result.version = modInfo.version
    result.description = modInfo.description ?? ''
    result.acceptMinecraft = modInfo.dependencies.find((d) => d.modId === 'minecraft')?.versionRange || annotation?.acceptedMinecraftVersions || ''
    result.acceptForge = modInfo.dependencies.find((d) => d.modId === 'forge')?.versionRange ?? '[*]'
    result.authors = modInfo.authors ? [modInfo.authors] : []
    result.logoFile = modInfo.logoFile
  } else if (metadata.mcmodInfo.length > 0) {
    const modInfo = metadata.mcmodInfo[0]
    const annotation = metadata.modAnnotations[0]

    result.modid = annotation?.modid || modInfo.modid
    result.name = annotation?.name || modInfo.name || modInfo.modid
    result.version = annotation?.version || modInfo.version
    result.description = modInfo.description ?? ''
    result.acceptMinecraft = annotation?.acceptedMinecraftVersions || (modInfo.mcversion ? `[${modInfo.mcversion}]` : '')
    result.acceptForge = '[*]'
    result.authors = modInfo.authorList
    result.logoFile = modInfo.logoFile
  } else if (metadata.modAnnotations.length > 0) {
    const annotation = metadata.modAnnotations[0]

    result.modid = annotation.modid
    result.name = annotation.name
    result.version = annotation.version
    result.description = ''
    result.acceptMinecraft = annotation.acceptedMinecraftVersions || ''
  } else if (metadata.manifestMetadata) {
    const man = metadata.manifestMetadata
    result.modid = man.modid
    result.name = man.name
    result.version = man.version
    result.description = man.description
    result.acceptMinecraft = ''
    result.authors = man.authors
  }
  return result
}
