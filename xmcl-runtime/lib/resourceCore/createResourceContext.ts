import { ResourceDomain } from '@xmcl/runtime-api'
import { ClassicLevel } from 'classic-level'
import EventEmitter from 'events'
import { ImageStorage } from '../util/imageStore'
import { Logger } from '../util/log'
import { ResourceContext, ResourceEntryCache, ResourceFileNameSnapshotDatabase, ResourceInoSnapshotDatabase, ResourceMetaDatabase, ResourceSha1SnapshotDatabase, ResourceSnapshotDatabase, ResourceUriDatabase } from './ResourceContext'

export function createResourceContext(root: string, imageStore: ImageStorage, eventBus: EventEmitter, logger: Logger, delegates: Pick<ResourceContext, 'hash' | 'parse' | 'hashAndFileType'>) {
  const level = new ClassicLevel(root)

  const snapshot = level.sublevel('snapshot', { valueEncoding: 'json' }) as ResourceSnapshotDatabase
  const inoSnapshot = snapshot.sublevel<string, ResourceEntryCache>('ino', { valueEncoding: 'json' }) as ResourceInoSnapshotDatabase
  const sha1Snapshot = snapshot.sublevel<string, ResourceEntryCache>('sha1', { valueEncoding: 'json' }) as ResourceSha1SnapshotDatabase
  const domainSnapshots = {
    [ResourceDomain.Mods]: snapshot.sublevel(ResourceDomain.Mods, { valueEncoding: 'json' }) as ResourceFileNameSnapshotDatabase,
    [ResourceDomain.Saves]: snapshot.sublevel(ResourceDomain.Saves, { valueEncoding: 'json' }) as ResourceFileNameSnapshotDatabase,
    [ResourceDomain.ResourcePacks]: snapshot.sublevel(ResourceDomain.ResourcePacks, { valueEncoding: 'json' }) as ResourceFileNameSnapshotDatabase,
    [ResourceDomain.ShaderPacks]: snapshot.sublevel(ResourceDomain.ShaderPacks, { valueEncoding: 'json' }) as ResourceFileNameSnapshotDatabase,
    [ResourceDomain.Modpacks]: snapshot.sublevel(ResourceDomain.Modpacks, { valueEncoding: 'json' }) as ResourceFileNameSnapshotDatabase,
    [ResourceDomain.Unclassified]: snapshot.sublevel(ResourceDomain.Unclassified, { valueEncoding: 'json' }) as ResourceFileNameSnapshotDatabase,
  }

  const metadata = level.sublevel('metadata', { valueEncoding: 'json' }) as ResourceMetaDatabase
  const uri = level.sublevel('uri', { valueEncoding: 'utf8' }) as ResourceUriDatabase

  const context: ResourceContext = {
    level,
    fileNameSnapshots: domainSnapshots,
    inoSnapshot,
    snapshot,
    sha1Snapshot,
    uri,
    metadata,
    image: imageStore,
    hash: delegates.hash,
    hashAndFileType: delegates.hashAndFileType,
    parse: delegates.parse,
    eventBus,
    logger,
  }

  return context
}
