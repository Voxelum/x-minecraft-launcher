import {
  CURRENT_COLLECTION_SCHEMA_VERSION,
  CollectionService as ICollectionService,
  CollectionServiceKey,
  CollectionsFileSchema,
  CreateLocalCollectionOptions,
  LocalCollection,
  LocalCollectionState,
  MutateCollectionEntryOptions,
  SharedState,
  UpdateLocalCollectionOptions,
  dedupeCollectionEntries,
  isSameCollectionEntry,
} from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import { writeFile } from 'atomically'
import { randomUUID } from 'crypto'
import { readFile, rename } from 'fs-extra'
import debounce from 'lodash.debounce'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { ExposeServiceKey, ServiceStateManager, StatefulService } from '~/service'

const CollectionLoadError = AnyError.make('CollectionLoadError')

/**
 * A launcher-owned collection service. It persists collections on disk under
 * the launcher data root using a versioned, schema-validated format with
 * atomic writes. It never requires or mutates Modrinth authentication.
 */
@ExposeServiceKey(CollectionServiceKey)
export class CollectionService extends StatefulService<LocalCollectionState> implements ICollectionService {
  private collectionsJsonPath: string

  private save = debounce(async () => {
    try {
      const data = CollectionsFileSchema.parse({
        schemaVersion: CURRENT_COLLECTION_SCHEMA_VERSION,
        collections: this.state.collections,
      })
      // atomically.writeFile writes to a temp file then renames, giving us the
      // "either the old valid file or the new valid file" guarantee. It never
      // leaves a half-written collections.json behind.
      await writeFile(this.collectionsJsonPath, JSON.stringify(data, null, 2))
    } catch (e) {
      // Best-effort: never turn a persistence hiccup (locked file, read-only
      // mount) into an unhandled rejection. The next mutation retries.
      this.warn(`Fail to save ${this.collectionsJsonPath}`)
      this.warn(e as Error)
    }
  }, 500)

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
  ) {
    super(app, () => store.registerStatic(new LocalCollectionState(), CollectionServiceKey), async () => {
      await this.load()
    })

    this.collectionsJsonPath = this.getAppDataPath('collections.json')
  }

  private async load() {
    let raw: unknown
    try {
      raw = JSON.parse(await readFile(this.collectionsJsonPath, 'utf-8'))
    } catch (e) {
      if ((e as any)?.code === 'ENOENT') {
        // No file yet: start from a clean, empty state. Local collections are
        // only ever created explicitly by the user.
        this.state.collectionsState([])
        return
      }
      // Malformed JSON: move the bad file aside and recover.
      await this.recoverCorruptFile(e)
      return
    }

    // Reject a file written by a newer launcher schema instead of silently
    // truncating unknown data. Treat it as corrupt-but-recoverable.
    if (raw && typeof raw === 'object' && typeof (raw as any).schemaVersion === 'number' &&
      (raw as any).schemaVersion > CURRENT_COLLECTION_SCHEMA_VERSION) {
      await this.recoverCorruptFile(new CollectionLoadError(
        `Collections file schema version ${(raw as any).schemaVersion} is newer than supported ${CURRENT_COLLECTION_SCHEMA_VERSION}`))
      return
    }

    const parsed = CollectionsFileSchema.safeParse(raw)
    if (!parsed.success) {
      await this.recoverCorruptFile(parsed.error)
      return
    }

    const migrated = migrateCollections(parsed.data.schemaVersion, parsed.data.collections)
    this.state.collectionsState(migrated)
  }

  private async recoverCorruptFile(cause: unknown) {
    this.error(new CollectionLoadError('Fail to load collections; recovering', { cause }))
    try {
      await rename(this.collectionsJsonPath, `${this.collectionsJsonPath}.corrupted`)
    } catch {
      // ignore: best-effort backup
    }
    this.state.collectionsState([])
    this.state.collectionCorrupted(true)
  }

  async getLocalCollections(): Promise<SharedState<LocalCollectionState>> {
    await this.initialize()
    return this.state
  }

  async createCollection(options: CreateLocalCollectionOptions): Promise<LocalCollection> {
    await this.initialize()
    const now = Date.now()
    const collection: LocalCollection = {
      id: randomUUID(),
      name: options.name ?? '',
      description: options.description,
      createdAt: now,
      updatedAt: now,
      mods: [],
      resourcepacks: [],
      shaderpacks: [],
    }
    this.state.collectionUpsert(collection)
    this.save()
    return collection
  }

  async updateCollection(id: string, options: UpdateLocalCollectionOptions): Promise<void> {
    await this.initialize()
    const collection = this.state.collections.find((c) => c.id === id)
    if (!collection) {
      throw new CollectionLoadError(`Collection ${id} not found`)
    }
    const next: LocalCollection = {
      ...collection,
      name: options.name ?? collection.name,
      description: options.description ?? collection.description,
      updatedAt: Date.now(),
    }
    this.state.collectionUpsert(next)
    this.save()
  }

  async deleteCollection(id: string): Promise<void> {
    await this.initialize()
    // Purely local mutation. This never calls the Modrinth API.
    this.state.collectionRemove(id)
    this.save()
  }

  async addEntry({ collectionId, contentType, entry }: MutateCollectionEntryOptions): Promise<void> {
    await this.initialize()
    const collection = this.state.collections.find((c) => c.id === collectionId)
    if (!collection) {
      throw new CollectionLoadError(`Collection ${collectionId} not found`)
    }
    const next: LocalCollection = {
      ...collection,
      [contentType]: dedupeCollectionEntries([...collection[contentType], {
        provider: entry.provider,
        projectId: entry.projectId,
      }]),
      updatedAt: Date.now(),
    }
    this.state.collectionUpsert(next)
    this.save()
  }

  async removeEntry({ collectionId, contentType, entry }: MutateCollectionEntryOptions): Promise<void> {
    await this.initialize()
    const collection = this.state.collections.find((c) => c.id === collectionId)
    if (!collection) {
      throw new CollectionLoadError(`Collection ${collectionId} not found`)
    }
    const next: LocalCollection = {
      ...collection,
      [contentType]: collection[contentType].filter((e) => !isSameCollectionEntry(e, entry)),
      updatedAt: Date.now(),
    }
    this.state.collectionUpsert(next)
    this.save()
  }
}

/**
 * Migrate persisted collections to the current schema version. Only additive
 * migrations are supported for now; version 1 is the initial format.
 */
function migrateCollections(fromVersion: number, collections: LocalCollection[]): LocalCollection[] {
  // No structural migration required yet. Future versions add cases here.
  return collections
}
