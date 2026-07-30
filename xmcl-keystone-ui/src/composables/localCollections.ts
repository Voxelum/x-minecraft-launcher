import { CollectionContentType, CollectionEntry, CollectionServiceKey, LocalCollectionState } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export const kLocalCollections: InjectionKey<ReturnType<typeof useLocalCollections>> = Symbol('localCollections')

/**
 * The market collection selection value prefix that identifies a launcher-owned
 * local collection (as opposed to a Modrinth collection id or `followed`).
 */
export const LOCAL_COLLECTION_PREFIX = 'local:'

/** Build the market selection value for a local collection id. */
export function toLocalSelectionId(id: string) {
  return `${LOCAL_COLLECTION_PREFIX}${id}`
}

/** Return the local collection id if the selection value is a local one. */
export function parseLocalSelectionId(selection: string | undefined): string | undefined {
  if (selection && selection.startsWith(LOCAL_COLLECTION_PREFIX)) {
    return selection.slice(LOCAL_COLLECTION_PREFIX.length)
  }
  return undefined
}

/**
 * Access the launcher-owned local collections. This works fully offline and
 * never requires or mutates Modrinth authentication. Local collections are
 * always created explicitly by the user; there is no implicit favorites bucket.
 */
export function useLocalCollections() {
  const service = useService(CollectionServiceKey)
  const { state, isValidating, error } = useState(() => service.getLocalCollections(), LocalCollectionState)

  const collections = computed(() => state.value?.collections ?? [])
  const corrupted = computed(() => state.value?.corrupted ?? false)

  function getCollection(id: string) {
    return collections.value.find((c) => c.id === id)
  }

  function isInCollection(collectionId: string, contentType: CollectionContentType, entry: CollectionEntry) {
    const collection = getCollection(collectionId)
    if (!collection) return false
    return collection[contentType].some((e) => e.provider === entry.provider && e.projectId === entry.projectId)
  }

  return {
    state,
    isValidating,
    error,
    collections,
    corrupted,
    getCollection,
    isInCollection,
    createCollection: service.createCollection,
    updateCollection: service.updateCollection,
    deleteCollection: service.deleteCollection,
    addEntry: service.addEntry,
    removeEntry: service.removeEntry,
  }
}
