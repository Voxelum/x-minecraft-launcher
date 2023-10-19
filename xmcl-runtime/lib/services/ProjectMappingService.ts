import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { AbstractService, ExposeServiceKey } from './Service'
import { PathResolver, kGameDataPath } from '../entities/gameDataPath'
import { missing } from '../util/fs'
import { download } from '@xmcl/file-transfer'
import { request } from 'undici'
import { readFile, writeFile } from 'fs/promises'
import { ProjectMappingServiceKey, ProjectMappingService as IProjectMappingService } from '@xmcl/runtime-api'

interface Database {
  project: {
    modrinth: string
    curseforge: string
  }
}

@ExposeServiceKey(ProjectMappingServiceKey)
export class ProjectMappingService extends AbstractService implements IProjectMappingService {
  #db: Kysely<Database>

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) getPath: PathResolver,
  ) {
    super(app, async () => {
      const filePath = getPath('project-mapping.sqlite')
      const url = 'https://xmcl.blob.core.windows.net/project-mapping/latest.sqlite'
      if (await missing(filePath)) {
        await download({
          url,
          destination: filePath,
        })
        await writeFile(getPath('project-mapping.last-modified'), new Date().toUTCString())
      } else {
        const lastModified = await readFile(getPath('project-mapping.last-modified'), 'utf-8')
        const response = await request(url, {
          method: 'HEAD',
          headers: {
            'If-Modified-Since': lastModified,
          },
        })
        if (response.statusCode === 200) {
          await download({
            url,
            destination: filePath,
          })
          await writeFile(getPath('project-mapping.last-modified'), new Date().toUTCString())
        }
      }
    })

    this.#db = new Kysely<Database>({
      dialect: new SqliteDialect({
        database: new SQLite(getPath('project-mapping.sqlite'), {}),
      }),
      log: (e) => {
        if (e.level === 'error') {
          this.warn(e.query.sql + '\n[' + e.query.parameters.join(', ') + ']')
        }
      },
    })
  }

  async lookupByModrinth(modrinth: string) {
    await this.initialize()
    const result = await this.#db.selectFrom('project')
      .where('modrinth', '=', modrinth)
      .select('curseforge')
      .executeTakeFirst()
    if (result) return Number(result.curseforge)
  }

  async lookupByCurseforge(curseforge: string) {
    await this.initialize()
    const result = await this.#db.selectFrom('project')
      .where('curseforge', '=', curseforge)
      .select('modrinth')
      .executeTakeFirst()
    if (result) return result.modrinth
  }
}
