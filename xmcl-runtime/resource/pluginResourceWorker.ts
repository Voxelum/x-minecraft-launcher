import {
  Database,
  ResourceContext,
  ResourceManager,
  getDomainedPath,
  migrate,
  sweepCorruptedRefs,
} from '@xmcl/resource'
import {
  Exception,
  InstanceServiceKey,
  InstanceState,
  ParseException,
  ResourceState,
  SharedState,
} from '@xmcl/runtime-api'
import {
  JSONPlugin,
  NodeSqliteDialect,
  NodeSqliteDialectConfig,
} from '@xmcl/sqlite'
import { AnyError } from '@xmcl/utils'
import { createLazyWorker } from '@xmcl/worker'
import EventEmitter from 'events'
import { rename } from 'fs-extra'
import { Kysely, ParseJSONResultsPlugin } from 'kysely'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'path'
import { LauncherApp, LauncherAppPlugin, kGameDataPath } from '~/app'
import { ImageStorage, ZipManager } from '~/infra'
import { ServiceStateManager } from '~/service'
import { kSettings } from '~/settings'
import { kResourceContext, kResourceManager } from './index'
import createResourceWorker from './resource.worker?worker'
import { ResourceWorker, kResourceWorker } from './worker'

function loadDatabaseConfig(app: LauncherApp, dbPath: string): NodeSqliteDialectConfig {
  const onError: NodeSqliteDialectConfig['onError'] = (e) => {
    if (e instanceof Error && ((e as any).code === 'ERR_SQLITE_ERROR' || e.name === 'SQLite3Error')) {
      const message = e.message.toLowerCase()
      if (
        message === 'unable to open database file' ||
        message === 'database disk image is malformed' ||
        message === 'file is not a database' ||
        message === 'file is encrypted or is not a database' ||
        message.startsWith('no such table') ||
        message.startsWith('out of memory')
      )
        app.registry.get(kSettings).then((settings) => settings.databaseReadySet(false))
    }
    // @ts-ignore
    e.source = 'ResourceDatabase'
  }

  return {
    databasePath: dbPath,
    database: () => {
      const db = new DatabaseSync(dbPath)
      db.exec('PRAGMA locking_mode = EXCLUSIVE')
      db.exec('PRAGMA journal_mode = WAL')
      return db
    },
    onError,
  }
}

export const pluginResourceWorker: LauncherAppPlugin = async (app) => {
  const workerLogger = app.getLogger('ResourceWorker')

  const [resourceWorker, dispose] = createLazyWorker<ResourceWorker>(
    createResourceWorker,
    {
      methods: ['checksum', 'hash', 'hashAndFileType', 'parse', 'fingerprint'],
    },
    workerLogger,
    Exception,
    { name: 'CPUWorker' },
  )
  app.registryDisposer(dispose)
  app.registry.register(kResourceWorker, resourceWorker)

  const logger = app.getLogger('ResourceContext')
  // The resource database no longer has a worker/non-worker selection: the
  // obsolete `enableResourceDatabaseWorker` flight is ignored (it can no longer
  // spawn a SQLite worker). The database now runs in the normal runtime process
  // through a single `node:sqlite` connection.
  //
  // The resource database is launcher-level state and stays in appData: it must
  // NOT travel with the game data root during a migration (its rows hold
  // absolute paths that are stale at the new location anyway, so the index is
  // rebuilt rather than moved).
  const dbPath = join(app.appDataPath, 'resources.sqlite')

  let db: Kysely<Database> | undefined
  for (let i = 0; i < 3; i++) {
    if (db) {
      db.destroy()
      const bkPath = dbPath + '.' + Date.now() + '.bk'
      await rename(dbPath, bkPath).catch(() => {})
    }
    const config = loadDatabaseConfig(app, dbPath)
    const dialect = new NodeSqliteDialect(config)
    const database = new Kysely<Database>({
      dialect,
      plugins: [new ParseJSONResultsPlugin(), new JSONPlugin()],
      log: (e) => {
        if (e.level === 'error') {
          logger.warn(
            e.query.sql + '\n[' + e.query.parameters.join(', ') + ']',
            (e.error as Error).message,
          )
        }
      },
    })
    let success = true
    try {
      const results = await migrate(database)
      if (results) {
        for (const result of results) {
          if (result.status === 'Error') {
            logger.error(
              new AnyError(
                'ResourceDatabaseMigration',
                `Failed to migrate database: ${result.migrationName}`,
              ),
            )
          }
        }
      }
      success = true
    } catch (e) {
      logger.error(
        Object.assign(e as any, {
          cause: 'ResourceDatabaseMigration',
        }),
      )
      success = false
    }
    db = database
    if (!success) {
      continue
    }
    app.registry.get(kSettings).then((settings) => settings.databaseReadySet(true))

    // Fire-and-forget: walk the resources table once and null out any
    // modrinth/curseforge refs that are obviously corrupted (e.g. a
    // file path stored in versionId). Surfaces a soft hint on the home
    // page so the user knows attribution was lost for some files.
    sweepCorruptedRefs(database).then(async (r) => {
      if (r.rowsAffected > 0) {
        logger.warn(
          `Cleared corrupted resource refs: ${r.rowsAffected} row(s), ` +
          `${r.modrinthCleared} modrinth + ${r.curseforgeCleared} curseforge.`,
        )
        const settings = await app.registry.get(kSettings)
        settings.corruptedResourceCountSet(r.rowsAffected)
      }
    }).catch((e) => {
      logger.error(Object.assign(e as any, { cause: 'SweepCorruptedRefs' }))
    })
    break
  }

  // Set database ready status to false if initialization failed after all attempts
  if (!db) {
    app.registry.get(kSettings).then((settings) => settings.databaseReadySet(false))
    logger.warn(
      'Resource database initialization failed after 3 attempts. Some features may not work properly.',
    )
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
    throwException: ({ type, code, path }) => {
      throw new ParseException({ type, code, path })
    },
    createResourceState: function (): ResourceState {
      return new ResourceState()
    },
  }
  app.registry.register(kResourceContext, context)
  app.registry.register(kResourceManager, new ResourceManager(context))

  app.registryDisposer(async () => {
    await context.db.destroy()
  })

  app.registryDisposer(async () => {
    app.registry.getIfPresent(ZipManager).then((man) => man?.close())
  })

  app.registry
    .get(ServiceStateManager)
    .then((manager) => manager.get(InstanceServiceKey.toString()))
    .then((state) => {
      ;(state as unknown as SharedState<InstanceState>)?.subscribe('instanceRemove', (path) => {
        context.db
          .deleteFrom('snapshots')
          .where('domainedPath', 'like', `${getDomainedPath(path, context.root)}%`)
          .execute()
      })
    })
}
