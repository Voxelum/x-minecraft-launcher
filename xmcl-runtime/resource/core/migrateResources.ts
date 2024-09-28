import { ResourceType } from '@xmcl/runtime-api'
import { Kysely, Migration, MigrationProvider, Migrator } from 'kysely'
import { Database } from './schema'

export class ResourceMigrateProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({
      1: { up, down },
      2: { up: up2, down: down2 },
    })
  }
}

/**
 * Migrate the database to latest version
 * @param db The sqldatabase
 */
export function migrate(db: Kysely<Database>) {
  const migrator = new Migrator({
    db,
    provider: new ResourceMigrateProvider(),
  })
  return migrator.migrateToLatest()
}

async function up2(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable('resources')
    .addColumn(ResourceType.MMCModpack, 'json')
    .execute()
}

async function down2(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable('resources')
    .dropColumn(ResourceType.MMCModpack)
    .execute()
}

async function up(db: Kysely<Database>): Promise<void> {
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
    .addColumn(ResourceType.CurseforgeModpack, 'json')
    .addColumn(ResourceType.McbbsModpack, 'json')
    .addColumn(ResourceType.ModrinthModpack, 'json')
    .addColumn(ResourceType.Modpack, 'json')
    .addColumn(ResourceType.Save, 'json')
    .addColumn(ResourceType.ShaderPack, 'json')
    .addColumn('instance', 'json')
    .addColumn('github', 'json')
    .addColumn('curseforge', 'json')
    .addColumn('modrinth', 'json')
    .addColumn('gitlab', 'json')
    .execute()

  await db.schema
    .createTable('tags')
    .addColumn('sha1', 'char(40)', (col) => col.notNull()/* .references('resources.sha1').onDelete('cascade') */)
    .addColumn('tag', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('sha1_uri_unique', ['sha1', 'tag'])
    .execute()

  await db.schema
    .createTable('uris')
    .addColumn('sha1', 'char(40)', (col) => col.notNull()/* .references('resources.sha1').onDelete('cascade') */)
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('sha1_uri_unique', ['sha1', 'uri'])
    .execute()

  await db.schema
    .createTable('icons')
    .addColumn('sha1', 'char(40)', (col) => col.notNull()/* .references('resources.sha1').onDelete('cascade') */)
    .addColumn('icon', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('sha1_uri_unique', ['sha1', 'icon'])
    .execute()

  await db.schema
    .createTable('snapshots')
    .addColumn('domainedPath', 'varchar', (col) => col.primaryKey())
    .addColumn('ino', 'integer', (col) => col.notNull())
    .addColumn('ctime', 'integer', (col) => col.notNull())
    .addColumn('mtime', 'integer', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('fileType', 'varchar', (col) => col.notNull())
    .addColumn('sha1', 'char(40)', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('snapshots_ino_index')
    .on('snapshots')
    .column('ino')
    .execute()

  await db.schema
    .createIndex('snapshots_sha1_index')
    .on('snapshots')
    .column('sha1')
    .execute()
}

async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('resources').execute()
  await db.schema.dropTable('tags').execute()
  await db.schema.dropTable('uris').execute()
  await db.schema.dropTable('icons').execute()
  await db.schema.dropTable('snapshots').execute()
  await db.schema.dropIndex('snapshots_ino_index').execute()
  await db.schema.dropIndex('snapshots_sha1_index').execute()
}
