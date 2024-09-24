import EventEmitter from 'events'
import { existsSync, rmSync } from 'fs'
import { Database } from 'node-sqlite3-wasm'
import { join } from 'path'
import { kGameDataPath, LauncherAppPlugin } from '~/app'
import { kFlights } from '~/flights'
import { ImageStorage } from '~/imageStore'
import { SqliteWASMDialectConfig } from '~/sql'
import { DatabaseWorker } from '~/sql/type'
import { ZipManager } from '~/zipManager/ZipManager'
import createDbWorker from '../sql/sqlite.worker?worker'
import { createLazyWorker } from '../worker'
import { createResourceContext } from './core/createResourceContext'
import { migrate } from './core/migrateResources'
import createResourceWorker from './resource.worker?worker'
import { kResourceContext } from './ResourceManager'
import { kResourceWorker, ResourceWorker } from './worker'
import { ServiceStateManager } from '~/service'
import { InstanceServiceKey, InstanceState, MutableState } from '@xmcl/runtime-api'
import { getDomainedPath } from './core/snapshot'

export const pluginResourceWorker: LauncherAppPlugin = async (app) => {
  const workerLogger = app.getLogger('ResourceWorker')
  const resourceWorker: ResourceWorker = createLazyWorker(createResourceWorker, {
    methods: ['checksum', 'hash', 'hashAndFileType', 'parse', 'fingerprint'],
  }, workerLogger, { name: 'CPUWorker' })
  app.registry.register(kResourceWorker, resourceWorker)

  const flights = await app.registry.get(kFlights)
  let config: SqliteWASMDialectConfig
  const dbPath = join(app.appDataPath, 'resources.sqlite')

  try {
    const lockPath = dbPath + '.lock'
    if (existsSync(lockPath)) {
      rmSync(lockPath, { recursive: true })
    }
  } catch { }

  if (flights.enableResourceDatabaseWorker) {
    const dbLogger = app.getLogger('ResourceDbWorker')
    const dbWorker: DatabaseWorker = createLazyWorker(createDbWorker, {
      methods: ['executeQuery', 'streamQuery', 'init', 'destroy'],
      asyncGenerators: ['streamQuery'],
    }, dbLogger, { workerData: { fileName: dbPath }, name: 'ResourceDBWorker' })
    config = {
      worker: dbWorker,
    }
  } else {
    config = {
      database: new Database(dbPath),
    }
  }

  const logger = app.getLogger('ResourceContext')
  const imageStorage = await app.registry.get(ImageStorage)
  const getPath = await app.registry.get(kGameDataPath)
  const eventBus = new EventEmitter()
  const context = createResourceContext(getPath(), imageStorage, eventBus, logger, resourceWorker, config)
  await migrate(context.db)
  app.registry.register(kResourceContext, context)

  app.registryDisposer(async () => {
    await context.db.destroy()
  })

  app.registryDisposer(async () => {
    app.registry.getIfPresent(ZipManager).then((man) => man?.close())
  })

  app.registry.get(ServiceStateManager).then((manager) => manager.get(InstanceServiceKey.toString()))
    .then((state) => {
      (state as unknown as MutableState<InstanceState>)?.subscribe('instanceRemove', (path) => {
        context.db.deleteFrom('snapshots')
          .where('domainedPath', 'like', `${getDomainedPath(path, context.root)}%`)
          .execute()
      })
    })
}
