import { InstallMarketOptionWithInstance, MarketType } from '@xmcl/runtime-api'
import type { CollectionContentType, CollectionEntry } from '@xmcl/runtime-api'
import { dedupeCollectionEntries } from '@xmcl/runtime-api'
import type { InstanceFile } from '@xmcl/instance'
import type { ProjectEntry } from '@/util/search'
import { getInstanceFileFromModrinthVersion } from '@/util/modrinth'
import { getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import type { ResolveResult, ResolvedCandidate } from './collectionResolver'

export type BulkInstallStatus = 'installed' | 'already-installed' | 'skipped' | 'failed'

export interface BulkInstallEntryResult {
  entry: CollectionEntry
  status: BulkInstallStatus
  /** A user-readable reason for skipped/failed entries. */
  reason?: string
}

export interface BulkInstallResult {
  installed: BulkInstallEntryResult[]
  alreadyInstalled: BulkInstallEntryResult[]
  skipped: BulkInstallEntryResult[]
  failed: BulkInstallEntryResult[]
  /** True if the run was cancelled before processing every entry. */
  cancelled: boolean
}

export interface BulkInstallProgress {
  total: number
  completed: number
  current?: CollectionEntry
}

export interface BulkInstallDeps {
  /** Resolve a collection entry to a compatible install candidate. */
  resolve: (entry: CollectionEntry, signal?: AbortSignal) => Promise<ResolveResult>
  /** Whether the entry is already installed in the target instance. */
  isInstalled: (entry: CollectionEntry) => boolean
  /** Install a single resolved candidate. */
  install: (candidate: ResolvedCandidate, entry: CollectionEntry, signal?: AbortSignal) => Promise<void>
  signal?: AbortSignal
  onProgress?: (progress: BulkInstallProgress) => void
}

function reasonText(result: ResolveResult): string {
  switch (result.reason) {
    case 'incompatible':
      return 'No compatible version for the current Minecraft version/loader'
    case 'not-found':
      return 'Project not found'
    case 'error':
      return result.error instanceof Error ? result.error.message : 'Provider error'
    default:
      return 'Unknown reason'
  }
}

const CONTENT_FOLDER: Record<CollectionContentType, string> = {
  mods: 'mods',
  resourcepacks: 'resourcepacks',
  shaderpacks: 'shaderpacks',
}

/**
 * Build an {@link InstanceFile} for a resolved candidate, placing it in the
 * folder matching its content type (`mods` / `resourcepacks` / `shaderpacks`).
 */
export function candidateToInstanceFile(candidate: ResolvedCandidate, contentType: CollectionContentType): InstanceFile {
  const file = candidate.provider === 'modrinth'
    ? getInstanceFileFromModrinthVersion(candidate.version)
    : getInstanceFileFromCurseforgeFile(candidate.file)
  const folder = CONTENT_FOLDER[contentType]
  const filename = file.path.split('/').pop() || file.path
  file.path = `${folder}/${filename}`
  return file
}

export interface ResolvedCollectionFiles {
  /** Compatible files ready to feed into the instance-install dialog. */
  files: InstanceFile[]
  /** Entries with no compatible version / provider result, with reasons. */
  skipped: BulkInstallEntryResult[]
}

/**
 * Resolve a set of collection entries to installable {@link InstanceFile}s for
 * a given content type. Entries are deduplicated; incompatible/missing entries
 * are collected in `skipped` with a user-readable reason instead of being
 * silently dropped. This is the entry point for the instance-install dialog
 * (manifest preview → confirm) flow.
 */
export async function resolveCollectionFiles(
  entries: CollectionEntry[],
  contentType: CollectionContentType,
  resolve: (entry: CollectionEntry, signal?: AbortSignal) => Promise<ResolveResult>,
  signal?: AbortSignal,
): Promise<ResolvedCollectionFiles> {
  const deduped = dedupeCollectionEntries(entries)
  const files: InstanceFile[] = []
  const skipped: BulkInstallEntryResult[] = []
  for (const entry of deduped) {
    if (signal?.aborted) break
    const result = await resolve(entry, signal)
    if (result.candidate) {
      files.push(candidateToInstanceFile(result.candidate, contentType))
    } else {
      skipped.push({ entry, status: 'skipped', reason: reasonText(result) })
    }
  }
  return { files, skipped }
}

/**
 * Provider-neutral bulk-install coordinator. It:
 * - deduplicates entries by provider + projectId;
 * - resolves the best compatible file/version per entry;
 * - skips already-installed and incompatible/missing entries;
 * - continues after an individual failure;
 * - reports progress and a final result with installed/skipped/failed/
 *   already-installed counts;
 * - supports cancellation, leaving completed installs intact.
 */
export async function runBulkInstall(
  entries: CollectionEntry[],
  deps: BulkInstallDeps,
): Promise<BulkInstallResult> {
  const deduped = dedupeCollectionEntries(entries)
  const result: BulkInstallResult = {
    installed: [],
    alreadyInstalled: [],
    skipped: [],
    failed: [],
    cancelled: false,
  }

  let completed = 0
  const total = deduped.length

  for (const entry of deduped) {
    if (deps.signal?.aborted) {
      result.cancelled = true
      break
    }
    deps.onProgress?.({ total, completed, current: entry })

    if (deps.isInstalled(entry)) {
      result.alreadyInstalled.push({ entry, status: 'already-installed' })
      completed++
      deps.onProgress?.({ total, completed })
      continue
    }

    const resolved = await deps.resolve(entry, deps.signal)
    if (!resolved.candidate) {
      result.skipped.push({ entry, status: 'skipped', reason: reasonText(resolved) })
      completed++
      deps.onProgress?.({ total, completed })
      continue
    }

    try {
      await deps.install(resolved.candidate, entry, deps.signal)
      result.installed.push({ entry, status: 'installed' })
    } catch (e) {
      // Continue with the other entries after a single failure.
      result.failed.push({
        entry,
        status: 'failed',
        reason: e instanceof Error ? e.message : 'Install failed',
      })
    }
    completed++
    deps.onProgress?.({ total, completed })
  }

  deps.onProgress?.({ total, completed })
  return result
}

/**
 * Build the `installFromMarket` payload for a resolved candidate.
 */
export function candidateToMarketOption(
  candidate: ResolvedCandidate,
  instancePath: string,
): InstallMarketOptionWithInstance {
  if (candidate.provider === 'modrinth') {
    return {
      market: MarketType.Modrinth,
      version: [{ versionId: candidate.versionId, icon: candidate.icon }],
      instancePath,
    }
  }
  return {
    market: MarketType.CurseForge,
    file: [{ fileId: candidate.fileId, icon: candidate.icon }],
    instancePath,
  }
}

/**
 * Return only the entries that were not successfully installed, so the caller
 * can offer a retry of failed + skipped items.
 */
export function getRetryableEntries(result: BulkInstallResult): CollectionEntry[] {
  return [...result.failed, ...result.skipped].map((r) => r.entry)
}

/**
 * Convert the market project entries currently displayed for a collection
 * (local, Modrinth collection, or Modrinth follows) into provider-qualified
 * collection entries for bulk installation. Each displayed item is
 * single-provider, so we take whichever provider id is present.
 */
export function marketItemsToEntries(items: Array<Pick<ProjectEntry, 'modrinth' | 'modrinthProjectId' | 'curseforge' | 'curseforgeProjectId'>>): CollectionEntry[] {
  const entries: CollectionEntry[] = []
  for (const item of items) {
    const modrinthId = item.modrinthProjectId || item.modrinth?.project_id
    const curseforgeId = item.curseforgeProjectId || item.curseforge?.id
    if (modrinthId) {
      entries.push({ provider: 'modrinth', projectId: modrinthId })
    } else if (curseforgeId !== undefined) {
      entries.push({ provider: 'curseforge', projectId: String(curseforgeId) })
    }
  }
  return dedupeCollectionEntries(entries)
}
