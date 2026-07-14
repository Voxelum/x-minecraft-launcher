import { File, FileModLoaderType } from '@xmcl/curseforge'
import type { ProjectVersion } from '@xmcl/modrinth'
import type { CollectionContentType, CollectionEntry } from '@xmcl/runtime-api'

/**
 * The target runtime a collection entry must be resolved against. Project ids
 * are the stable input; the concrete downloadable file/version is resolved
 * here at install time.
 */
export interface CollectionResolveTarget {
  /** The instance Minecraft version, e.g. `1.20.1`. */
  minecraft: string
  /**
   * The active mod loaders (e.g. `['fabric']`). Only relevant for `mods`;
   * resource packs and shader packs ignore it.
   */
  loaders: string[]
  contentType: CollectionContentType
}

/**
 * A resolved, directly installable candidate for a collection entry. It carries
 * both the identifier (for `installFromMarket`) and the full version/file
 * object (for building an `InstanceFile` in the instance-install dialog flow).
 */
export type ResolvedCandidate =
  | { provider: 'modrinth'; versionId: string; version: ProjectVersion; icon?: string }
  | { provider: 'curseforge'; fileId: number; file: File; icon?: string }

export type ResolveFailureReason = 'incompatible' | 'not-found' | 'error'

export interface ResolveResult {
  entry: CollectionEntry
  candidate?: ResolvedCandidate
  reason?: ResolveFailureReason
  error?: unknown
}

/** Minimal Modrinth client surface required by the resolver (for testability). */
export interface ModrinthResolveClient {
  getProjectVersions(
    projectId: string,
    options: { loaders?: string[]; gameVersions?: string[] },
    signal?: AbortSignal,
  ): Promise<ProjectVersion[]>
}

/** Minimal CurseForge client surface required by the resolver (for testability). */
export interface CurseforgeResolveClient {
  getModFiles(
    options: { modId: number; gameVersion?: string; modLoaderType?: FileModLoaderType; index?: number },
    signal?: AbortSignal,
  ): Promise<{ data: File[] }>
}

const CURSEFORGE_LOADER_TYPE: Record<string, FileModLoaderType> = {
  forge: FileModLoaderType.Forge,
  fabric: FileModLoaderType.Fabric,
  quilt: FileModLoaderType.Quilt,
  neoforge: FileModLoaderType.NeoForge,
  liteloader: FileModLoaderType.LiteLoader,
}

function curseforgeModLoaderType(target: CollectionResolveTarget): FileModLoaderType {
  if (target.contentType !== 'mods') return FileModLoaderType.Any
  const first = target.loaders.find((l) => CURSEFORGE_LOADER_TYPE[l] !== undefined)
  return first ? CURSEFORGE_LOADER_TYPE[first] : FileModLoaderType.Any
}

/**
 * Resolve a single Modrinth collection entry to its best compatible version
 * for the target Minecraft version + loader.
 */
export async function resolveModrinthEntry(
  entry: CollectionEntry,
  target: CollectionResolveTarget,
  client: ModrinthResolveClient,
  signal?: AbortSignal,
): Promise<ResolveResult> {
  try {
    const versions = await client.getProjectVersions(entry.projectId, {
      gameVersions: target.minecraft ? [target.minecraft] : undefined,
      // Only mods are loader specific. Resource/shader packs must not be
      // filtered by the instance mod loader or they would never resolve.
      loaders: target.contentType === 'mods' && target.loaders.length ? target.loaders : undefined,
    }, signal)
    if (!versions || versions.length === 0) {
      return { entry, reason: 'incompatible' }
    }
    // Modrinth returns versions newest-first.
    return { entry, candidate: { provider: 'modrinth', versionId: versions[0].id, version: versions[0] } }
  } catch (error) {
    return { entry, reason: 'error', error }
  }
}

/**
 * Resolve a single CurseForge collection entry to its best compatible file for
 * the target Minecraft version + loader.
 */
export async function resolveCurseforgeEntry(
  entry: CollectionEntry,
  target: CollectionResolveTarget,
  client: CurseforgeResolveClient,
  signal?: AbortSignal,
): Promise<ResolveResult> {
  const modId = Number(entry.projectId)
  if (!Number.isInteger(modId)) {
    return { entry, reason: 'not-found' }
  }
  try {
    const { data } = await client.getModFiles({
      modId,
      gameVersion: target.minecraft || undefined,
      modLoaderType: curseforgeModLoaderType(target),
      index: 0,
    }, signal)
    if (!data || data.length === 0) {
      return { entry, reason: 'incompatible' }
    }
    // CurseForge returns files newest-first.
    return { entry, candidate: { provider: 'curseforge', fileId: data[0].id, file: data[0] } }
  } catch (error) {
    return { entry, reason: 'error', error }
  }
}

/**
 * Provider-neutral entry resolver. Dispatches to the correct provider client
 * based on the entry's provider.
 */
export async function resolveCollectionEntry(
  entry: CollectionEntry,
  target: CollectionResolveTarget,
  clients: { modrinth: ModrinthResolveClient; curseforge: CurseforgeResolveClient },
  signal?: AbortSignal,
): Promise<ResolveResult> {
  if (entry.provider === 'modrinth') {
    return resolveModrinthEntry(entry, target, clients.modrinth, signal)
  }
  return resolveCurseforgeEntry(entry, target, clients.curseforge, signal)
}
