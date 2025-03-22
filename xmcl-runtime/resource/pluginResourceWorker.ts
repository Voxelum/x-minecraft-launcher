import { InstanceServiceKey, InstanceState, SharedState } from '@xmcl/runtime-api'
import EventEmitter from 'events'
import { existsSync, rmSync } from 'fs'
import { Database } from 'node-sqlite3-wasm'
import { join } from 'path'
import { LauncherAppPlugin, kGameDataPath } from '~/app'
import { kFlights } from '~/flights'
import { ImageStorage } from '~/imageStore'
import { ServiceStateManager } from '~/service'
import { kSettings } from '~/settings'
import { SqliteWASMDialectConfig } from '~/sql'
import { DatabaseWorker } from '~/sql/type'
import { ZipManager } from '~/zipManager/ZipManager'
import createDbWorker from '../sql/sqlite.worker?worker'
import { createLazyWorker } from '../worker'
import { kResourceContext } from './ResourceManager'
import { createResourceContext } from './core/createResourceContext'
import { migrate } from './core/migrateResources'
import { getDomainedPath } from './core/snapshot'
import createResourceWorker from './resource.worker?worker'
import { ResourceWorker, kResourceWorker } from './worker'

export const pluginResourceWorker: LauncherAppPlugin = async (app) => {
  const workerLogger = app.getLogger('ResourceWorker')
  const [resourceWorker, dispose] = createLazyWorker<ResourceWorker>(createResourceWorker, {
    methods: ['checksum', 'hash', 'hashAndFileType', 'parse', 'fingerprint'],
  }, workerLogger, { name: 'CPUWorker' })
  app.registryDisposer(dispose)
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
    const [dbWorker, dispose]: [DatabaseWorker, () => void] = createLazyWorker(createDbWorker, {
      methods: ['executeQuery', 'streamQuery', 'init', 'destroy'],
      asyncGenerators: ['streamQuery'],
    }, dbLogger, { workerData: { fileName: dbPath }, name: 'ResourceDBWorker' })
    app.registryDisposer(dispose)
    config = {
      worker: dbWorker,
    }
  } else {
    config = {
      database: new Database(dbPath),
      onError: (e) => {
        if (e.name === 'SQLite3Error' && e.message === 'unable to open database file') {
          app.registry.get(kSettings).then((settings) => settings.databaseReadySet(false))
        }
      }
    }
  }

  const logger = app.getLogger('ResourceContext')
  const imageStorage = await app.registry.get(ImageStorage)
  const getPath = await app.registry.get(kGameDataPath)
  const eventBus = new EventEmitter()
  const context = createResourceContext(getPath(), imageStorage, eventBus, logger, resourceWorker, config)
  try {
    await migrate(context.db)
  } catch (e) {
    logger.error(Object.assign(e as any, {
      cause: 'ResourceDatabaseMigration',
    }))
  }
  app.registry.register(kResourceContext, context)

  if ('database' in config) {
    app.registry.get(kSettings).then((settings) => settings.databaseReadySet(config.database.isOpen))
  }

  app.registryDisposer(async () => {
    await context.db.destroy()
  })

  app.registryDisposer(async () => {
    app.registry.getIfPresent(ZipManager).then((man) => man?.close())
  })

  app.registry.get(ServiceStateManager).then((manager) => manager.get(InstanceServiceKey.toString()))
    .then((state) => {
      (state as unknown as SharedState<InstanceState>)?.subscribe('instanceRemove', (path) => {
        context.db.deleteFrom('snapshots')
          .where('domainedPath', 'like', `${getDomainedPath(path, context.root)}%`)
          .execute()
      })
    })
}
