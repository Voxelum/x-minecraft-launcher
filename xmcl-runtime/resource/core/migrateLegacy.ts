import { sql } from 'kysely'
import { ResourceContext } from './ResourceContext'

export async function migrateImageProtocolChange({ db, logger }: ResourceContext) {
  // Update all image://<id> to http://launcher/image/<id>
  try {
    await sql`update icons set icon = REPLACE(icon, 'image://', 'http://launcher/image/') where "icon" like 'image:%';`.execute(db)
  } catch (e) {
    logger.warn('Fail to migrate image protocol change')
    logger.error(e as any)
  }
}
