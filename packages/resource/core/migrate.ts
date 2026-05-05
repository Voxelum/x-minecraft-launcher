import { Kysely, Migration, MigrationProvider, Migrator, sql } from 'kysely'
import { Database } from '../schema'
import { ResourceType } from '../ResourceType'

export class ResourceMigrateProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({
      1: v1,
      2: v2,
      2.1: v21,
      2.2: v22,
    })
  }
}

async function fixSnapshotTable(db: Kysely<Database>) {
  let columns = await sql`PRAGMA table_info(snapshots)`.execute(db)
  if (columns.rows.some((c: any) => c.name === 'ctime')) {
    await v21.up(db)
  }
  columns = await sql`PRAGMA table_info(snapshots)`.execute(db)
  if (columns.rows.some((c: any) => c.name === 'ctime')) {
    // force recreate the table
    await db.schema
      .createTable('snapshots_temp')
      .addColumn('domainedPath', 'varchar', (col) => col.primaryKey())
      .addColumn('ino', 'integer', (col) => col.notNull())
      .addColumn('mtime', 'integer', (col) => col.notNull())
      .addColumn('fileType', 'varchar', (col) => col.notNull())
      .addColumn('sha1', 'char(40)', (col) => col.notNull())
      .execute()
    // copy data
    await sql`insert into snapshots_temp select domainedPath, ino, mtime, fileType, sha1 from snapshots`.execute(
      db,
    )
    // drop old table
    await db.schema.dropTable('snapshots').execute()
    // rename new table
    await db.schema.alterTable('snapshots_temp').renameTo('snapshots').execute()
    await db.schema.createIndex('snapshots_ino_index').on('snapshots').column('ino').execute()

    await db.schema.createIndex('snapshots_sha1_index').on('snapshots').column('sha1').execute()
  }
}

async function fixResourceTable(db: Kysely<Database>) {
  let columns = await sql`PRAGMA table_info(resources)`.execute(db)
  // check neoforge column
  if (!columns.rows.some((c: any) => c.name === ResourceType.Neoforge)) {
    await v22.up(db)
  }
}

/**
 * Migrate the database to latest version
 * @param db The sqldatabase
 */
export async function migrate(db: Kysely<Database>) {
  const migrator = new Migrator({
    db,
    provider: new ResourceMigrateProvider(),
  })

  const { error, results } = await migrator.migrateToLatest()
  if (error) {
    throw error
  }
  await fixSnapshotTable(db)
  await fixResourceTable(db)
  return results
}

const v1: Migration = {
  async up(db: Kysely<Database>): Promise<void> {
    await db.schema
      .createTable('resources')
      .addColumn('sha1', 'char(40)', (col) => col.primaryKey())
      .addColumn('sha256', 'char(64)', (col) => col.unique())
      .addColumn('name', 'varchar', (col) => col.notNull())
      .addColumn(ResourceType.Forge, 'json')
      .addColumn(ResourceType.Fabric, 'json')
      .addColumn(ResourceType.Liteloader, 'json')
      .addColumn(ResourceType.Quilt, 'json')
      .addColumn(ResourceType.ResourcePack, 'json')
      .addColumn('save', 'json')
      .addColumn(ResourceType.ShaderPack, 'json')
      .addColumn(ResourceType.Neoforge, 'json')
      .addColumn('instance', 'json')
      .addColumn('github', 'json')
      .addColumn('curseforge', 'json')
      .addColumn('modrinth', 'json')
      .addColumn('gitlab', 'json')
      .execute()

    await db.schema
      .createTable('tags')
      .addColumn(
        'sha1',
        'char(40)',
        (col) => col.notNull() /* .references('resources.sha1').onDelete('cascade') */,
      )
      .addColumn('tag', 'varchar', (col) => col.notNull())
      .addUniqueConstraint('sha1_uri_unique', ['sha1', 'tag'])
      .execute()

    await db.schema
      .createTable('uris')
      .addColumn(
        'sha1',
        'char(40)',
        (col) => col.notNull() /* .references('resources.sha1').onDelete('cascade') */,
      )
      .addColumn('uri', 'varchar', (col) => col.notNull())
      .addUniqueConstraint('sha1_uri_unique', ['sha1', 'uri'])
      .execute()

    await db.schema
      .createTable('icons')
      .addColumn(
        'sha1',
        'char(40)',
        (col) => col.notNull() /* .references('resources.sha1').onDelete('cascade') */,
      )
      .addColumn('icon', 'varchar', (col) => col.notNull())
      .addUniqueConstraint('sha1_uri_unique', ['sha1', 'icon'])
      .execute()

    await db.schema
      .createTable('snapshots')
      .addColumn('domainedPath', 'varchar', (col) => col.primaryKey())
      .addColumn('ino', 'integer', (col) => col.notNull())
      .addColumn('mtime', 'integer', (col) => col.notNull())
      .addColumn('fileType', 'varchar', (col) => col.notNull())
      .addColumn('sha1', 'char(40)', (col) => col.notNull())
      .execute()

    await db.schema.createIndex('snapshots_ino_index').on('snapshots').column('ino').execute()

    await db.schema.createIndex('snapshots_sha1_index').on('snapshots').column('sha1').execute()
  },
}

const v2: Migration = {
  async up(db: Kysely<Database>): Promise<void> {
    // check if the resource table has ResourceType.MMCModpack column
    const columns = await sql`PRAGMA table_info(resources)`.execute(db)
    if (columns.rows.some((c: any) => c.name === 'MMCModpack')) {
      return
    }
    await db.schema.alterTable('resources').addColumn('MMCModpack', 'json').execute()
  },
}

const v21: Migration = {
  async up(db: Kysely<Database>): Promise<void> {
    await db.schema
      .alterTable('snapshots')
      .dropColumn('ctime')
      .execute()
      .catch(() => {})
    await db.schema
      .alterTable('snapshots')
      .dropColumn('size')
      .execute()
      .catch(() => {})
  },
}

const v22: Migration = {
  async up(db: Kysely<Database>): Promise<void> {
    await sql`update icons set icon = REPLACE(icon, 'image://', 'http://launcher/image/') where "icon" like 'image:%';`.execute(
      db,
    )
    const columns = await sql`PRAGMA table_info(resources)`.execute(db)
    if (columns.rows.some((c: any) => c.name === ResourceType.Neoforge)) {
      return
    }
    await db.schema.alterTable('resources').addColumn(ResourceType.Neoforge, 'json').execute()
  },
}
