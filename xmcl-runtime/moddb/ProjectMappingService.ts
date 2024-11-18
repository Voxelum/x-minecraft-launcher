import { ProjectMappingService as IProjectMappingService, ProjectMappingServiceKey, Settings } from '@xmcl/runtime-api'
import { createHash } from 'crypto'
import { existsSync, rmSync, writeFile } from 'fs-extra'
import { Kysely } from 'kysely'
import { Database as SQLDatabase } from 'node-sqlite3-wasm'
import { join } from 'path'
import { promisify } from 'util'
import { gunzip } from 'zlib'
import { Inject, LauncherAppKey } from '~/app'
import { kGFW } from '~/gfw'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kSettings } from '~/settings'
import { SqliteWASMDialect } from '~/sql'
import { LauncherApp } from '../app/LauncherApp'
import { checksum } from '../util/fs'

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
      await this.ensureDatabase(true)
    })
  }

  private async ensureDatabase(init = false) {
    const locale = this.settings.locale.toLowerCase()
    const gfw = await this.app.registry.get(kGFW)

    if (!locale) return undefined
    if (this.#db?.locale === locale) return this.#db.db

    let filePath = join(this.app.appDataPath, `project-mapping-${locale}.sqlite`)
    await this.semaphoreManager.getLock('project-mapping').write(async () => {
      let original = `https://xmcl.blob.core.windows.net/project-mapping/${locale}.sqlite`

      async function exists() {
        try {
          const resp = await fetch(original + '.sha256', { method: 'HEAD' })
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
          `https://files.0x.halac.cn/Services/XMCL/project-mapping/${locale}.sqlite.gz`,
          `https://files-0x.halac.cn/Services/XMCL/project-mapping/${locale}.sqlite.gz`,
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
      const currentSha256 = await checksum(filePath, 'sha256').catch(() => '')
      if (currentSha256 !== sha256) {
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
        throw new AggregateError(errors)
      }
    })

    const newLocale = this.settings.locale.toLowerCase()

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

    this.app.registryDisposer(async () => {
      sqlite.close()
    })

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
