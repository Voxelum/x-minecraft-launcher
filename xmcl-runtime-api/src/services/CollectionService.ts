import type { CollectionContentType, CollectionEntry, LocalCollection } from '../entities/collection.schema'
import type { SharedState } from '../util/SharedState'
import type { ServiceKey } from './Service'

/**
 * Reactive state exposing all launcher-owned local collections plus a flag
 * indicating the persisted file could not be read (corrupt data recovery UI).
 */
export class LocalCollectionState {
  /**
   * All launcher-owned local collections. Always created explicitly by the
   * user; there is no implicit favorites bucket.
   */
  collections: LocalCollection[] = []
  /**
   * True when the persisted collections file was present but could not be
   * parsed. The launcher recovered to an empty/valid state and moved the bad
   * file aside; the UI should surface a recoverable notice.
   */
  corrupted = false

  collectionsState(collections: LocalCollection[]) {
    this.collections = collections
  }

  collectionUpsert(collection: LocalCollection) {
    // Always reassign a NEW array reference. Renderer computeds compare by
    // value (Vue 3.4+), so an in-place push/splice on the same array would not
    // propagate the change to the UI.
    const index = this.collections.findIndex((c) => c.id === collection.id)
    if (index === -1) {
      this.collections = [...this.collections, collection]
    } else {
      const next = this.collections.slice()
      next.splice(index, 1, collection)
      this.collections = next
    }
  }

  collectionRemove(id: string) {
    this.collections = this.collections.filter((c) => c.id !== id)
  }

  collectionCorrupted(corrupted: boolean) {
    this.corrupted = corrupted
  }
}

export interface CreateLocalCollectionOptions {
  name: string
  description?: string
}

export interface UpdateLocalCollectionOptions {
  name?: string
  description?: string
}

export interface MutateCollectionEntryOptions {
  collectionId: string
  contentType: CollectionContentType
  entry: CollectionEntry
}

/**
 * A launcher-owned collection service. It persists collections on disk under
 * the launcher data root using a versioned, schema-validated format with
 * atomic writes. It never requires or mutates Modrinth authentication.
 */
export interface CollectionService {
  /**
   * Get the reactive state of all local collections. The state is loaded from
   * disk on first access and kept in sync with subsequent mutations.
   */
  getLocalCollections(): Promise<SharedState<LocalCollectionState>>

  /**
   * Create a new local collection and return it.
   */
  createCollection(options: CreateLocalCollectionOptions): Promise<LocalCollection>

  /**
   * Rename or re-describe an existing local collection.
   */
  updateCollection(id: string, options: UpdateLocalCollectionOptions): Promise<void>

  /**
   * Delete a local collection. This never calls any remote provider API.
   */
  deleteCollection(id: string): Promise<void>

  /**
   * Add a provider-qualified project entry to a collection's content list.
   * Entries are deduplicated by provider + projectId within a content type.
   */
  addEntry(options: MutateCollectionEntryOptions): Promise<void>

  /**
   * Remove a provider-qualified project entry from a collection's content list.
   */
  removeEntry(options: MutateCollectionEntryOptions): Promise<void>
}

export const CollectionServiceKey: ServiceKey<CollectionService> = 'CollectionService'
