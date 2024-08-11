import { existsSync, rmSync } from 'fs'
import { Database } from 'node-sqlite3-wasm'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { kFlights } from '~/flights'
import { SqliteWASMDialectConfig } from '~/sql'
import { DatabaseWorker } from '~/sql/type'
import createDbWorker from '../sql/sqlite.worker?worker'
import { createLazyWorker } from '../worker'
import createResourceWorker from './resource.worker?worker'
import { kResourceDatabaseOptions, kResourceWorker, ResourceWorker } from './worker'

export const pluginResourceWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('ResourceWorker')
  const resourceWorker: ResourceWorker = createLazyWorker(createResourceWorker, {
    methods: ['checksum', 'copyPassively', 'hash', 'hashAndFileType', 'parse', 'fingerprint'],
  }, logger, { name: 'CPUWorker' })
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
  app.registry.register(kResourceDatabaseOptions, config)
}
