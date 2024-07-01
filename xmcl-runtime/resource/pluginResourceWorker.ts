import { LauncherAppPlugin } from '~/app'
import { createLazyWorker } from '../worker'
import createResourceWorker from './resource.worker?worker'
import createDbWorker from '../sql/sqlite.worker?worker'
import { kResourceDatabaseOptions, ResourceWorker, kResourceWorker } from './worker'
import { join } from 'path'
import { DatabaseWorker } from '~/sql/type'
import { kFlights } from '~/flights'
import { SqliteWASMDialectConfig } from '~/sql'
import { Database } from 'node-sqlite3-wasm'

export const pluginResourceWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('ResourceWorker')
  const resourceWorker: ResourceWorker = createLazyWorker(createResourceWorker, {
    methods: ['checksum', 'copyPassively', 'hash', 'hashAndFileType', 'parse', 'fingerprint'],
  }, logger, { name: 'CPUWorker' })
  app.registry.register(kResourceWorker, resourceWorker)

  const flights = await app.registry.get(kFlights)
  let config: SqliteWASMDialectConfig
  if (flights.enableResourceDatabaseWorker) {
    const dbLogger = app.getLogger('ResourceDbWorker')
    const dbWorker: DatabaseWorker = createLazyWorker(createDbWorker, {
      methods: ['executeQuery', 'streamQuery', 'init', 'destroy'],
      asyncGenerators: ['streamQuery'],
    }, dbLogger, { workerData: { fileName: join(app.appDataPath, 'resources.sqlite') }, name: 'ResourceDBWorker' })
    config = {
      worker: dbWorker,
    }
  } else {
    config = {
      database: new Database(join(app.appDataPath, 'resources.sqlite')),
    }
  }
  app.registry.register(kResourceDatabaseOptions, config)
}
