import { z } from 'zod'

/**
 * The current schema version of the persisted local collections file.
 *
 * Bump this whenever the on-disk shape changes in a non backward compatible
 * way and add a migration in the runtime CollectionService.
 */
export const CURRENT_COLLECTION_SCHEMA_VERSION = 1

/**
 * The market provider that owns a collection entry. A Modrinth project and a
 * CurseForge project are always distinct entries even when they represent the
 * same work.
 */
export const CollectionProviderSchema = z.enum(['modrinth', 'curseforge'])
export type CollectionProvider = z.infer<typeof CollectionProviderSchema>

/**
 * The three content types a local collection can group projects by. These map
 * one-to-one to the launcher resource domains of the same name.
 */
export const CollectionContentTypeSchema = z.enum(['mods', 'resourcepacks', 'shaderpacks'])
export type CollectionContentType = z.infer<typeof CollectionContentTypeSchema>

/**
 * A single collection entry. It stores only a provider-qualified project
 * identifier. The concrete downloadable file/version is resolved at install
 * time against the target Minecraft version and loader; it is never persisted
 * as the collection's source of truth.
 *
 * - Modrinth: {@link CollectionEntry.projectId} is the Modrinth project id.
 * - CurseForge: {@link CollectionEntry.projectId} is the CurseForge project id
 *   as a string.
 */
export const CollectionEntrySchema = z.object({
  provider: CollectionProviderSchema,
  projectId: z.string().min(1),
})
export type CollectionEntry = z.infer<typeof CollectionEntrySchema>

/**
 * A launcher-owned collection persisted on disk. It contains a user editable
 * name and optional description plus provider-qualified project id lists for
 * the three supported content types.
 */
export const LocalCollectionSchema = z.object({
  /** Stable, launcher generated id. Never changes for the collection lifetime. */
  id: z.string().min(1),
  /** User editable display name. */
  name: z.string(),
  /** Optional user editable description. */
  description: z.string().optional(),
  /** Creation timestamp in epoch milliseconds. */
  createdAt: z.number().catch(() => Date.now()),
  /** Last modification timestamp in epoch milliseconds. */
  updatedAt: z.number().catch(() => Date.now()),
  mods: z.array(CollectionEntrySchema).catch([]),
  resourcepacks: z.array(CollectionEntrySchema).catch([]),
  shaderpacks: z.array(CollectionEntrySchema).catch([]),
})
export type LocalCollection = z.infer<typeof LocalCollectionSchema>

/**
 * The versioned, schema-validated on-disk representation of all local
 * collections.
 */
export const CollectionsFileSchema = z.object({
  schemaVersion: z.number(),
  collections: z.array(LocalCollectionSchema).catch([]),
})
export type CollectionsFile = z.infer<typeof CollectionsFileSchema>

/**
 * Deduplicate a list of collection entries by provider + projectId. The order
 * of first occurrence is preserved.
 */
export function dedupeCollectionEntries(entries: CollectionEntry[]): CollectionEntry[] {
  const seen = new Set<string>()
  const result: CollectionEntry[] = []
  for (const entry of entries) {
    const key = `${entry.provider}:${entry.projectId}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ provider: entry.provider, projectId: entry.projectId })
  }
  return result
}

/**
 * Whether two collection entries refer to the same provider-qualified project.
 */
export function isSameCollectionEntry(a: CollectionEntry, b: CollectionEntry): boolean {
  return a.provider === b.provider && a.projectId === b.projectId
}
