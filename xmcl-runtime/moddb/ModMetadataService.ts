import { isNotNull } from '@xmcl/core/utils'
import { DownloadTask } from '@xmcl/installer'
import { ModMetadataService as IModMetadataService, ModMetadata, ModMetadataServiceKey, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { createReadStream } from 'fs'
import { Kysely } from 'kysely'
import { Database as SQLDatabase } from 'node-sqlite3-wasm'
import { request } from 'undici'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey } from '~/service'
import { SqliteWASMDialect } from '~/sql'
import { TaskFn, kTaskExecutor } from '~/task'
import { checksumFromStream } from '~/util/fs'
import { isNonnull } from '~/util/object'
import { jsonObjectFrom } from '~/util/sqlHelper'

interface Database {
  file: {
    sha1: string
    name: string
    domain: string
  }
  project_mapping: {
    curseforge_project: number
    modrinth_project: string
  }
  modrinth_version: {
    sha1: string
    project: string
    version: string
  }
  curseforge_file: {
    sha1: string
    project: number
    file: number
  }
  forge_mod: {
    sha1: string
    id: string
    version: string
  }
  fabric_mod: {
    sha1: string
    id: string
    version: string
  }
}

@ExposeServiceKey(ModMetadataServiceKey)
export class ModMetadataService extends AbstractService implements IModMetadataService {
  private db: Kysely<Database> | undefined

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTaskExecutor) private submit: TaskFn,
  ) {
    super(app, async () => {
      // await this.#ensureDb()
    })
  }

  async lookupMapping(lookup: { curseforge: number[]; modrinth: string[] }): Promise<{ curseforge?: Record<number, string>; modrinth?: Record<string, number> }> {
    const db = await this.#ensureDb()
    const curseforge = await db.selectFrom('project_mapping')
      .where('curseforge_project', 'in', lookup.curseforge)
      .selectAll()
      .execute()
    const modrinth = await db.selectFrom('project_mapping')
      .where('modrinth_project', 'in', lookup.modrinth)
      .selectAll()
      .execute()
    return {
      curseforge: curseforge?.filter(isNotNull).reduce((acc, cur) => {
        acc[cur.curseforge_project] = cur.modrinth_project
        return acc
      }, {} as Record<number, string>),
      modrinth: modrinth?.filter(isNotNull).reduce((acc, cur) => {
        acc[cur.modrinth_project] = cur.curseforge_project
        return acc
      }, {} as Record<string, number>),
    }
  }

  async getMetadataFromSha1s(sha1: string[]): Promise<ModMetadata[]> {
    const db = await this.#ensureDb()
    const result = await db.selectFrom('file')
      .where('sha1', 'in', sha1)
      .select((eb) => [
        'sha1',
        'name',
        'domain',
        jsonObjectFrom(
          eb.selectFrom('forge_mod').select(['id', 'version']).whereRef('forge_mod.sha1', '=', 'file.sha1'),
        ).as('forge'),
        jsonObjectFrom(
          eb.selectFrom('fabric_mod').select(['id', 'version']).whereRef('fabric_mod.sha1', '=', 'file.sha1'),
        ).as('fabric'),
        jsonObjectFrom(
          eb.selectFrom('modrinth_version').select(['project', 'version']).whereRef('modrinth_version.sha1', '=', 'file.sha1'),
        ).as('modrinth'),
        jsonObjectFrom(
          eb.selectFrom('curseforge_file').select(['project', 'file']).whereRef('curseforge_file.sha1', '=', 'file.sha1'),
        ).as('curseforge'),
      ])
      .execute()
    return result?.filter(isNonnull).map((r) => {
      const domain = r.domain as ResourceDomain
      const name = r.name
      const forge = r.forge
      const fabric = r.fabric
      const modrinth = r.modrinth
      const curseforge = r.curseforge
      return {
        sha1: r.sha1,
        name,
        domain,
        forge: forge ? { id: forge.id, version: forge.version } : undefined,
        fabric: fabric ? { id: fabric.id, version: fabric.version } : undefined,
        modrinth: modrinth ? { id: modrinth.project, version: modrinth.version } : undefined,
        curseforge: curseforge ? { id: curseforge.project, file: curseforge.file } : undefined,
      }
    }) || []
  }

  async getMetadataFromSha1(sha1: string): Promise<ModMetadata | undefined> {
    const db = await this.#ensureDb()
    const result = await db.selectFrom('file')
      .where('sha1', '=', sha1)
      .select((eb) => [
        'name',
        'domain',
        jsonObjectFrom(
          eb.selectFrom('forge_mod').select(['id', 'version']).where('sha1', '=', sha1),
        ).as('forge'),
        jsonObjectFrom(
          eb.selectFrom('fabric_mod').select(['id', 'version']).where('sha1', '=', sha1),
        ).as('fabric'),
        jsonObjectFrom(
          eb.selectFrom('modrinth_version').select(['project', 'version']).where('sha1', '=', sha1),
        ).as('modrinth'),
        jsonObjectFrom(
          eb.selectFrom('curseforge_file').select(['project', 'file']).where('sha1', '=', sha1),
        ).as('curseforge'),
      ])
      .executeTakeFirst()
    if (!result) return
    const domain = result.domain as ResourceDomain
    const name = result.name
    const forge = result.forge
    const fabric = result.fabric
    const modrinth = result.modrinth
    const curseforge = result.curseforge
    return {
      sha1,
      name,
      domain,
      forge: forge ? { id: forge.id, version: forge.version } : undefined,
      fabric: fabric ? { id: fabric.id, version: fabric.version } : undefined,
      modrinth: modrinth ? { id: modrinth.project, version: modrinth.version } : undefined,
      curseforge: curseforge ? { id: curseforge.project, file: curseforge.file } : undefined,
    }
  }

  async lookupModrinthId(curseforgeId: number): Promise<string | undefined> {
    const db = await this.#ensureDb()
    const result = await db.selectFrom('project_mapping')
      .where('curseforge_project', '=', curseforgeId)
      .selectAll()
      .executeTakeFirst()
    return result?.modrinth_project
  }

  async lookupCurseforgeId(modrinthId: string): Promise<number | undefined> {
    const db = await this.#ensureDb()
    const result = await db.selectFrom('project_mapping')
      .where('modrinth_project', '=', modrinthId)
      .selectAll()
      .executeTakeFirst()
    return result?.curseforge_project
  }

  async decorateResources(resources: Resource[]) {
    const sha1s = resources.map((r) => r.hash)
    const metadatas = await this.getMetadataFromSha1s(sha1s)
    const resourceService = await this.app.registry.get(ResourceService)
    const resourceDict = resources.reduce((acc, cur) => {
      acc[cur.hash] = cur
      return acc
    }, {} as Record<string, Resource>)
    const toUpdates = [] as Resource[]
    for (const metadata of metadatas) {
      const res = resourceDict[metadata.sha1]
      if (!res) continue
      let dirty = false
      if (!res.metadata.curseforge && metadata.curseforge) {
        res.metadata.curseforge = {
          projectId: metadata.curseforge.id,
          fileId: metadata.curseforge.file,
        }
        dirty = true
      }
      if (!res.metadata.modrinth && metadata.modrinth) {
        res.metadata.modrinth = {
          projectId: metadata.modrinth.id,
          versionId: metadata.modrinth.version,
        }
        dirty = true
      }
      if (dirty) {
        toUpdates.push(res)
      }
    }
    await resourceService.updateResources(toUpdates)
    return resources
  }

  async #ensureDb() {
    if (this.db) return this.db
    const sha1 = await (await request('https://xmcl.blob.core.windows.net/releases/db.sqlite.sha1')).body.text()
    const dbPath = this.getAppDataPath('db.sqlite')
    const actual = await checksumFromStream(createReadStream(dbPath), 'sha1').catch(() => '')
    if (actual !== sha1) {
      const task = new DownloadTask({
        url: 'https://xmcl.blob.core.windows.net/releases/db.sqlite',
        destination: dbPath,
        validator: {
          algorithm: 'sha1',
          hash: sha1,
        },
        skipPrevalidate: true,
      })
      await this.submit(task)
    }
    const sqlite = new SQLDatabase(dbPath, {
      readOnly: true,
    })
    const dialect = new SqliteWASMDialect({
      database: sqlite,
    })
    const db = new Kysely<Database>({
      dialect,
    })
    this.db = db
    return db
  }
}
