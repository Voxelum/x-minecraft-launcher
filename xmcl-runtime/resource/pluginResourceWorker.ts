import { InstanceServiceKey, InstanceState, SharedState } from '@xmcl/runtime-api'
import EventEmitter from 'events'
import { existsSync, rmSync } from 'fs'
import { Database as SQLDatabase } from 'node-sqlite3-wasm'
import { join } from 'path'
import { LauncherApp, LauncherAppPlugin, kGameDataPath } from '~/app'
import { kFlights } from '~/flights'
import { ImageStorage } from '~/imageStore'
import { ServiceStateManager } from '~/service'
import { kSettings } from '~/settings'
import { SqliteWASMDialectConfig, createDatabase } from '~/sql'
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
import { Database } from './core/schema'
import { Kysely } from 'kysely'
import { rename } from 'fs-extra'

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
    const [database, success] = await createDatabase<Database>(config, migrate, logger)
    db = database
    if (!success) {
      continue
    }
    app.registry.get(kSettings).then((settings) => settings.databaseReadySet(true))
    break
  }

  const imageStorage = await app.registry.get(ImageStorage)
  const getPath = await app.registry.get(kGameDataPath)
  const eventBus = new EventEmitter()

  const context = createResourceContext(getPath(), imageStorage, eventBus, logger, resourceWorker, db!)
  app.registry.register(kResourceContext, context)

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
