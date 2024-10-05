import { download } from '@xmcl/file-transfer'
import { ProjectMappingService as IProjectMappingService, ProjectMappingServiceKey, resolveQuiltVersion, Settings } from '@xmcl/runtime-api'
import { createWriteStream, readFile, writeFile } from 'fs-extra'
import { Kysely } from 'kysely'
import { Database as SQLDatabase } from 'node-sqlite3-wasm'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { AbstractService, ExposeServiceKey, Lock } from '~/service'
import { SqliteWASMDialect } from '~/sql'
import { LauncherApp } from '../app/LauncherApp'
import { missing } from '../util/fs'
import { join } from 'path'
import { kSettings } from '~/settings'
import { createGunzip } from 'zlib'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

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
      this.ensureDatabase()
    })
  }

  private async ensureDatabase() {
    const locale = this.settings.locale.toLowerCase()

    if (!locale) return undefined
    if (locale === 'en') return undefined
    if (this.#db?.locale === locale) return this.#db.db

    const filePath = join(this.app.appDataPath, `project-mapping-${locale}.sqlite`)
    const lastModifiedPath = filePath + '.last-modified'
    const url = `https://xmcl.blob.core.windows.net/project-mapping/${locale}.sqlite.gz`

    this.semaphoreManager.getLock('project-mapping').write(async () => {
      if (await missing(filePath)) {
        const resp = await this.app.fetch(url)
        if (!resp.ok) {
          return undefined
        }
        await pipeline(Readable.fromWeb(resp.body as any), createGunzip(), createWriteStream(filePath))
        await writeFile(lastModifiedPath, new Date().toUTCString())
      } else {
        const lastModified = await readFile(lastModifiedPath, 'utf-8')
        const response = await this.app.fetch(url, {
          method: 'HEAD',
          headers: {
            'If-Modified-Since': lastModified,
          },
        })
        if (response.status === 200) {
          const resp = await this.app.fetch(url)
          await pipeline(Readable.fromWeb(resp.body as any), createGunzip(), createWriteStream(filePath))
          await writeFile(lastModifiedPath, new Date().toUTCString())
        }
      }
    })

    const newLocale = this.settings.locale.toLowerCase()

    if (this.#db?.locale === locale) return this.#db.db
    if (newLocale !== locale) return undefined

    const sqlite = new SQLDatabase(filePath, {
      readOnly: true,
    })

    const db = new Kysely<Database>({
      dialect: new SqliteWASMDialect({
        database: sqlite,
      }),
      log: (e) => {
        if (e.level === 'error') {
          this.warn(e.query.sql + '\n[' + e.query.parameters.join(', ') + ']')
        }
      },
    })

    this.#db = {
      db,
      locale,
    }

    return db
  }

  async lookupByModrinth(modrinth: string) {
    const db = await this.ensureDatabase()

    if (!db) return undefined

    const result = await db.selectFrom('project')
      .where('modrinthId', '=', modrinth)
      .selectAll()
      .executeTakeFirst()
    return result
  }

  async lookupByCurseforge(curseforge: number) {
    const db = await this.ensureDatabase()

    if (!db) return undefined

    const result = await db.selectFrom('project')
      .where('curseforgeId', '=', curseforge)
      .selectAll()
      .executeTakeFirst()
    return result
  }

  async lookupBatch(modrinth: string[], curseforge: number[]) {
    const db = await this.ensureDatabase()

    if (!db) return []

    const result = await db.selectFrom('project')
      .where(eb => eb.or([
        eb('modrinthId', 'in', modrinth),
        eb('curseforgeId', 'in', curseforge),
      ]))
      .selectAll()
      .execute()
    return result
  }
}
