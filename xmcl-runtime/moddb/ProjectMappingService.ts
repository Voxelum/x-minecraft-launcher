import { ProjectMappingService as IProjectMappingService, ProjectMapping, ProjectMappingServiceKey, Settings } from '@xmcl/runtime-api'
import { createHash } from 'crypto'
import { existsSync, rmSync, writeFile } from 'fs-extra'
import { Kysely } from 'kysely'
import { Database as SQLDatabase } from 'node-sqlite3-wasm'
import { join } from 'path'
import { promisify } from 'util'
import { gunzip } from 'zlib'
import { Inject, LauncherAppKey } from '~/app'
import { kGFW } from '~/infra'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kSettings } from '~/settings'
import { SqliteWASMDialect } from '@xmcl/sqlite'
import { LauncherApp } from '../app/LauncherApp'
import { checksum } from '../util/fs'

const PROJECT_MAPPING_OPEN_RETRY_DELAYS = [200, 500, 1_000, 2_000]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : `${e}`
}

function isDatabaseLockedError(e: unknown) {
  return getErrorMessage(e).toLowerCase().includes('database is locked')
}

function isCorruptDatabaseError(e: unknown) {
  const message = getErrorMessage(e).toLowerCase()
  return message.includes('database disk image is malformed') ||
    message.includes('not a database') ||
    message.includes('file is encrypted or is not a database') ||
    message.includes('no such table: project')
}

function isOpenDatabaseError(e: unknown) {
  const message = getErrorMessage(e).toLowerCase()
  return message.includes('could not open the database') ||
    message.includes('unable to open database file') ||
    message.includes('failed to open')
}

interface Database {
  project: {
    modrinthId: string
    curseforgeId: number
    name: string
    description: string
  }
}

@ExposeServiceKey(ProjectMappingServiceKey)
export class ProjectMappingService extends AbstractService implements IProjectMappingService {
  #db: {
    db: Kysely<Database>
    locale: string
  } | undefined

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kSettings) private settings: Settings,
  ) {
    super(app, async () => {
      try {
        await this.tryEnsureDatabase(true)
      } catch (e) {
        if (typeof e === 'object' && e) {
          Object.assign(e, { Cause: 'ProjectMappingInitialize' })
        }
        this.warn('Project mapping database is not ready during initialization. It will be retried lazily.', e)
      }
    })
  }

  private deleteProjectMappingDatabase(filePath: string) {
    for (const path of [filePath, `${filePath}.lock`, `${filePath}-wal`, `${filePath}-shm`]) {
      try {
        if (existsSync(path)) {
          rmSync(path, { recursive: true })
        }
      } catch (e) {
        this.warn(`Failed to remove project mapping database file ${path}`, e)
      }
    }
  }

  private async ensureDatabaseFile(locale: string, forceDownload = false) {
    const gfw = await this.app.registry.get(kGFW)
    const app = this.app

    let filePath = join(this.app.appDataPath, `project-mapping-${locale}.sqlite`)
    await this.mutex.of('project-mapping').runExclusive(async () => {
      let original = `https://xmcl.blob.core.windows.net/project-mapping/${locale}.sqlite`

      async function exists() {
        try {
          const resp = await app.fetch(original + '.sha256', { method: 'HEAD' })
          if (!resp.ok) {
            return false
          }
          return true
        } catch {
          return false
        }
      }

      const hasLocaleDb = await exists()

      if (!hasLocaleDb) {
        original = 'https://xmcl.blob.core.windows.net/project-mapping/en.sqlite'
        filePath = join(this.app.appDataPath, 'project-mapping-en.sqlite')
      }

      const urls = gfw.inside && hasLocaleDb
        ? [
          original + '.gz',
        ]
        : [
          original + '.gz',
        ]
      const errors = [] as any[]
      const sha256 = await this.app.fetch(original + '.sha256').then((r) => r.text())
      if (!sha256) {
        return
      }
      const currentSha256 = forceDownload ? '' : await checksum(filePath, 'sha256').catch(() => '')
      if (forceDownload || currentSha256 !== sha256) {
        for (const url of urls) {
          try {
            const resp = await this.app.fetch(url)
            if (!resp.ok) {
              return undefined
            }
            const buf = await resp.arrayBuffer()
            const data = await promisify(gunzip)(buf)
            const hash = createHash('sha256').update(data as any).digest('hex')
            if (hash !== sha256) {
              continue
            }
            await writeFile(filePath, data as any)
            return
          } catch (e) {
            errors.push(e)
          }
        }
      }
      if (errors.length === 1) {
        throw errors[0]
      }
      if (errors.length) {
        throw new AggregateError(errors.flatMap(e => e instanceof AggregateError ? e.errors : e))
      }
    })

    return filePath
  }

  private async openDatabase(filePath: string, locale: string) {
    const db = new Kysely<Database>({
      dialect: new SqliteWASMDialect({
        databasePath: filePath,
        database: () => {
          try {
            const db = new SQLDatabase(filePath, {
              readOnly: true,
            })
            try {
              db.run('PRAGMA busy_timeout = 5000')
            } catch (e) {
              this.warn('Failed to configure project mapping database busy timeout', e)
            }
            return db
          } catch (e) {
            this.#db = undefined
            throw e
          }
        },
        onError: (e) => {
          // @ts-ignore
          e.source = 'ProjectMappingDatabase'
        },
      }),
      log: (e) => {
        if (e.level === 'error') {
          this.warn(e.query.sql + '\n[' + e.query.parameters.join(', ') + ']')
        }
      },
    })

    try {
      await db.selectFrom('project')
        .select('modrinthId')
        .limit(1)
        .execute()
    } catch (e) {
      await db.destroy().catch(() => {})
      throw e
    }

    this.#db = {
      db,
      locale,
    }

    this.app.registryDisposer(async () => {
      db.destroy()
    })

    return db
  }

  private async ensureDatabase(init = false) {
    const locale = this.settings.locale.toLowerCase() || 'en'

    if (this.#db?.locale === locale) return this.#db.db

    let filePath = await this.ensureDatabaseFile(locale)

    const newLocale = this.settings.locale.toLowerCase() || 'en'

    if (this.#db?.locale === locale) return this.#db.db
    if (newLocale !== locale) return undefined

    if (init) {
      try {
        const lockPath = filePath + '.lock'
        if (existsSync(lockPath)) {
          rmSync(lockPath, { recursive: true })
        }
      } catch { }
    }

    let shouldRebuild = false
    for (let attempt = 0; attempt <= PROJECT_MAPPING_OPEN_RETRY_DELAYS.length; attempt++) {
      try {
        if (shouldRebuild) {
          this.deleteProjectMappingDatabase(filePath)
          filePath = await this.ensureDatabaseFile(locale, true)
          shouldRebuild = false
        }
        return await this.openDatabase(filePath, locale)
      } catch (e) {
        this.#db = undefined
        if (isCorruptDatabaseError(e)) {
          shouldRebuild = true
          this.warn('Project mapping database is corrupt. Rebuilding the cache.', e)
          continue
        }
        if (isDatabaseLockedError(e) && attempt < PROJECT_MAPPING_OPEN_RETRY_DELAYS.length) {
          await sleep(PROJECT_MAPPING_OPEN_RETRY_DELAYS[attempt])
          continue
        }
        if (isOpenDatabaseError(e) && attempt < PROJECT_MAPPING_OPEN_RETRY_DELAYS.length) {
          await sleep(PROJECT_MAPPING_OPEN_RETRY_DELAYS[attempt])
          continue
        }
        throw e
      }
    }

    return undefined
  }

  private async tryEnsureDatabase(init = false) {
    try {
      return await this.ensureDatabase(init)
    } catch (e) {
      this.#db = undefined
      this.warn('Failed to open project mapping database. Project mapping lookup will be disabled until the next retry.', e)
      return undefined
    }
  }

  async lookupByKeyword(keyword: string): Promise<ProjectMapping[]> {
    const db = await this.tryEnsureDatabase()

    if (!db) return []

    const result = await db.selectFrom('project')
      .where(eb => eb.or([
        eb('name', 'like', `%${keyword}%`),
        eb('description', 'like', `%${keyword}%`),
      ]))
      .selectAll()
      .execute()
      .catch((e) => {
        this.warn('Failed to lookup project mapping by keyword', e)
        return []
      })

    return result
  }

  async lookupByModrinth(modrinth: string) {
    const db = await this.tryEnsureDatabase()

    if (!db) return undefined

    const result = await db.selectFrom('project')
      .where('modrinthId', '=', modrinth)
      .selectAll()
      .executeTakeFirst()
      .catch((e) => {
        this.warn('Failed to lookup project mapping by Modrinth id', e)
        return undefined
      })
    return result
  }

  async lookupByCurseforge(curseforge: number) {
    const db = await this.tryEnsureDatabase()

    if (!db) return undefined

    const result = await db.selectFrom('project')
      .where('curseforgeId', '=', curseforge)
      .selectAll()
      .executeTakeFirst()
      .catch((e) => {
        this.warn('Failed to lookup project mapping by CurseForge id', e)
        return undefined
      })
    return result
  }

  async lookupBatch(modrinth: string[], curseforge: number[]) {
    const db = await this.tryEnsureDatabase()

    if (!db) return []

    const result = await db.selectFrom('project')
      .where(eb => eb.or([
        eb('modrinthId', 'in', modrinth),
        eb('curseforgeId', 'in', curseforge),
      ]))
      .selectAll()
      .execute()
      .catch((e) => {
        this.warn('Failed to lookup project mappings in batch', e)
        return []
      })
    return result
  }
}
