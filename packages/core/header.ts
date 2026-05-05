import { LibraryInfo, ResolvedVersion } from './version'

export interface VersionHeader {
  path: string
  id: string
  inheritances: string[]
  /**
   * Minecraft version of this version. e.g. 1.7.10
   * @default ""
   */
  minecraft: string
  /**
   * Forge version of this version. e.g. 14.23.5.2838
   * @default ""
   */
  forge: string
  /**
   * Fabric loader version, e.g. 0.7.2+build.175
   * @default ""
   */
  fabric: string
  /**
   * Optifine version e.g. HD_U_F1_pre6 or HD_U_E6
   * @default ""
   */
  optifine: string
  /**
   * Neoforge version of this version. e.g. 47.0.1
   */
  neoforge: string
  /**
   * Quilt loader version, e.g. 0.17.5
   */
  quilt: string

  labyMod: string
}

export function findNeoforgeVersion(
  minecraft: string,
  resolvedVersion: { libraries: LibraryInfo[]; arguments: ResolvedVersion['arguments'] },
) {
  const neoForgeIndex = resolvedVersion.arguments.game.indexOf('--fml.neoForgeVersion')
  if (neoForgeIndex !== -1) {
    const version = resolvedVersion.arguments.game[neoForgeIndex + 1]
    return version as string
  }
  const hasNeoForged = resolvedVersion.libraries.some(
    (lib) => lib.groupId === 'net.neoforged.fancymodloader',
  )
  if (!hasNeoForged) return ''
  const forgeIndex = resolvedVersion.arguments.game.indexOf('--fml.forgeVersion')
  if (forgeIndex !== -1) {
    const version = resolvedVersion.arguments.game[forgeIndex + 1]
    return `${minecraft}-${version}` as string
  }
  return ''
}

export function parseForgeVersion(forgeVersion: string) {
  if (!forgeVersion) return forgeVersion
  const idx = forgeVersion.indexOf('-')
  return forgeVersion.substring(idx + 1)
}
export function parseOptifineVersion(optifineVersion: string) {
  if (!optifineVersion) return optifineVersion
  const idx = optifineVersion.indexOf('_')
  return optifineVersion.substring(idx + 1)
}
export function isForgeLibrary(lib: LibraryInfo) {
  return (
    lib.groupId === 'net.minecraftforge' &&
    (lib.artifactId === 'forge' ||
      lib.artifactId === 'fmlloader' ||
      lib.artifactId === 'minecraftforge')
  )
}
export function isFabricLoaderLibrary(lib: LibraryInfo) {
  return lib.groupId === 'net.fabricmc' && lib.artifactId === 'fabric-loader'
}
export function isOptifineLibrary(lib: LibraryInfo) {
  return (
    lib.groupId === 'optifine' && (lib.artifactId === 'Optifine' || lib.artifactId === 'OptiFine')
  )
}
export function isQuiltLibrary(lib: LibraryInfo) {
  return lib.groupId === 'org.quiltmc' && lib.artifactId === 'quilt-loader'
}
export function findLabyModVersion(resolvedVersion: ResolvedVersion) {
  return (
    resolvedVersion.libraries.find((l) => l.groupId === 'net.labymod' && l.artifactId === 'LabyMod')
      ?.version || ''
  )
}

export function getResolvedVersionHeader(ver: ResolvedVersion): VersionHeader {
  return {
    id: ver.id,
    path: ver.pathChain[0],
    inheritances: ver.inheritances,
    minecraft: ver.minecraftVersion,
    neoforge: findNeoforgeVersion(ver.minecraftVersion, ver),
    forge: parseForgeVersion(ver.libraries.find(isForgeLibrary)?.version ?? ''),
    fabric: ver.libraries.find(isFabricLoaderLibrary)?.version ?? '',
    optifine: parseOptifineVersion(ver.libraries.find(isOptifineLibrary)?.version ?? ''),
    quilt: ver.libraries.find(isQuiltLibrary)?.version ?? '',
    labyMod: findLabyModVersion(ver),
  }
}

export function isSameForgeVersion(forgeVersion: string, version: string, minecraft: string) {
  if (version.startsWith(`${minecraft}-`)) version = version.substring(`${minecraft}-`.length)
  if (version.endsWith(`-${minecraft}`))
    version = version.substring(0, version.length - `-${minecraft}`.length)
  const i = version.indexOf('-')
  if (i === -1) {
    return forgeVersion === version
  }
  return forgeVersion === version.substring(i + 1) || forgeVersion === version.substring(0, i)
}

export interface VersionDirective {
  minecraft: string
  forge?: string
  neoforge?: string
  fabric?: string
  optifine?: string
  quilt?: string
  labyMod?: string
}

export function matchVersion(
  versions: VersionHeader[],
  id: string,
  runtime: VersionDirective,
): VersionHeader | undefined {
  return versions.find((v) => v.id === id) || versions.find((ver) => isVersionMatched(ver, runtime))
}

function isVersionMatched(
  version: VersionHeader,
  {
    minecraft,
    forge,
    neoforge,
    fabric: fabricLoader,
    optifine,
    quilt: quiltLoader,
    labyMod,
  }: VersionDirective,
) {
  // compute version
  if (version.minecraft !== minecraft) {
    return false
  }
  if (forge) {
    // require forge
    if (!version.forge || !isSameForgeVersion(forge, version.forge, minecraft)) {
      // require forge but not forge
      return false
    }
  } else if (version.forge) {
    return false
  }

  if (neoforge) {
    // require neoforge
    if (!version.neoforge || version.neoforge !== neoforge) {
      // require neoforge but not neoforge
      return false
    }
  } else if (version.neoforge) {
    return false
  }

  if (labyMod) {
    // require labyMod
    if (!version.labyMod || version.labyMod !== labyMod) {
      return false
    }
  } else if (version.labyMod) {
    return false
  }

  if (fabricLoader) {
    // require fabric
    if (!version.fabric || version.fabric !== fabricLoader) {
      return false
    }
  } else if (version.fabric) {
    return false
  }

  if (optifine) {
    // require optifine
    if (!version.optifine || optifine !== version.optifine) {
      return false
    }
  } else if (version.optifine) {
    return false
  }

  if (quiltLoader) {
    // require quilt
    if (!version.quilt || version.quilt !== quiltLoader) {
      return false
    }
  } else if (version.quilt) {
    return false
  }

  return true
}
