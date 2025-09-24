import { Database, ResourceContext, ResourceManager, getDomainedPath, migrate } from '@xmcl/resource'
import { Exception, InstanceServiceKey, InstanceState, ResourceState, SharedState } from '@xmcl/runtime-api'
import EventEmitter from 'events'
import { existsSync, rmSync } from 'fs'
import { rename } from 'fs-extra'
import { Kysely } from 'kysely'
import { Database as SQLDatabase } from 'node-sqlite3-wasm'
import { join } from 'path'
import { LauncherApp, LauncherAppPlugin, kGameDataPath } from '~/app'
import { ImageStorage, ZipManager, kFlights } from '~/infra'
import { ServiceStateManager } from '~/service'
import { kSettings } from '~/settings'
import { SqliteWASMDialectConfig, createDatabase } from '~/sql'
import { DatabaseWorker } from '~/sql/type'
import { AnyError } from '@xmcl/utils'
import createDbWorker from '../sql/sqlite.worker?worker'
import { createLazyWorker } from '../worker'
import { kResourceContext, kResourceManager } from './index'
import createResourceWorker from './resource.worker?worker'
import { ResourceWorker, kResourceWorker } from './worker'

function loadDatabaseConfig(app: LauncherApp, flights: any) {
  let config: SqliteWASMDialectConfig
  const dbPath = join(app.appDataPath, 'resources.sqlite')

  try {
    const lockPath = dbPath + '.lock'
    if (existsSync(lockPath)) {
      rmSync(lockPath, { recursive: true })
    }
  } catch { }

  const onError: SqliteWASMDialectConfig['onError'] = (e) => {
    if (e.name === 'SQLite3Error') {
      if (e.message === 'unable to open database file'
        || e.message.startsWith('no such table')
        || e.message.startsWith('out of memory')
      )
        app.registry.get(kSettings).then((settings) => settings.databaseReadySet(false))
    }
    // @ts-ignore
    e.source = 'ResourceDatabase'
  }
  if (flights.enableResourceDatabaseWorker) {
    const dbLogger = app.getLogger('ResourceDbWorker')
    const [dbWorker, dispose]: [DatabaseWorker, () => void] = createLazyWorker(createDbWorker, {
      methods: ['executeQuery', 'streamQuery', 'init', 'destroy'],
      asyncGenerators: ['streamQuery'],
    }, dbLogger, { workerData: { fileName: dbPath }, name: 'ResourceDBWorker' })
    config = {
      worker: dbWorker,
      databasePath: dbPath,
      onError,
    }
  } else {
    config = {
      databasePath: dbPath,
      database: () => new SQLDatabase(dbPath),
      onError,
    }
  }

  return config
}
class ParseException extends Exception<{ type: 'parseResourceException'; code: string }> {
}

export const pluginResourceWorker: LauncherAppPlugin = async (app) => {
  const workerLogger = app.getLogger('ResourceWorker')

  const [resourceWorker, dispose] = createLazyWorker<ResourceWorker>(createResourceWorker, {
    methods: ['checksum', 'hash', 'hashAndFileType', 'parse', 'fingerprint'],
  }, workerLogger, { name: 'CPUWorker' })
  app.registryDisposer(dispose)
  app.registry.register(kResourceWorker, resourceWorker)

  const logger = app.getLogger('ResourceContext')
  const flights = await app.registry.get(kFlights)

  let db: Kysely<Database> | undefined
  for (let i = 0; i < 3; i++) {
    if (db) {
      db.destroy()
      const dbPath = join(app.appDataPath, 'resources.sqlite')
      const bkPath = dbPath + +'.' + Date.now() + '.bk'
      await rename(dbPath, bkPath).catch(() => { })
    }
    const config = loadDatabaseConfig(app, flights)
    const [database, success] = await createDatabase<Database>(config, async (db, logger) => {
      try {
        const results = await migrate(db)
        if (results) {
          for (const result of results) {
            if (result.status === 'Error') {
              logger.error(new AnyError('ResourceDatabaseMigration', `Failed to migrate database: ${result.migrationName}`))
            }
          }
        }
        return true
      } catch (e) {
        logger.error(Object.assign(e as any, {
          cause: 'ResourceDatabaseMigration',
        }))
        return false
      }
    }, logger)
    db = database
    if (!success) {
      continue
    }
    app.registry.get(kSettings).then((settings) => settings.databaseReadySet(true))
    break
  }

  // Set database ready status to false if initialization failed after all attempts
  if (!db) {
    app.registry.get(kSettings).then((settings) => settings.databaseReadySet(false))
    logger.warn('Resource database initialization failed after 3 attempts. Some features may not work properly.')
  }

  const imageStorage = await app.registry.get(ImageStorage)
  const getPath = await app.registry.get(kGameDataPath)
  const eventBus = new EventEmitter()

  const context: ResourceContext = {
    root: getPath(),
    db: db!,
    cacheImage: (b) => imageStorage.addImage(b),
    event: eventBus,
    parse: resourceWorker.parse,
    hashAndFileType: resourceWorker.hashAndFileType,
    onError: (e) => {
      logger.error(e)
    },
    throwException: ({ type, code }) => {
      throw new ParseException({ type, code })
    },
    createResourceState: function (): ResourceState {
      return new ResourceState()
    }
  }
  app.registry.register(kResourceContext, context)
  app.registry.register(kResourceManager, new ResourceManager(context))

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
