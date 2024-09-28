import { download } from '@xmcl/file-transfer'
import { ProjectMappingService as IProjectMappingService, ProjectMappingServiceKey } from '@xmcl/runtime-api'
import { readFile, writeFile } from 'fs-extra'
import { Kysely } from 'kysely'
import { Database as SQLDatabase } from 'node-sqlite3-wasm'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { SqliteWASMDialect } from '~/sql'
import { LauncherApp } from '../app/LauncherApp'
import { missing } from '../util/fs'

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
        const response = await this.app.fetch(url, {
          method: 'HEAD',
          headers: {
            'If-Modified-Since': lastModified,
          },
        })
        if (response.status === 200) {
          await download({
            url,
            destination: filePath,
          })
          await writeFile(getPath('project-mapping.last-modified'), new Date().toUTCString())
        }
      }
    })

    const sqlite = new SQLDatabase(getPath('project-mapping.sqlite'), {
      readOnly: true,
    })
    this.#db = new Kysely<Database>({
      dialect: new SqliteWASMDialect({
        database: sqlite,
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
