import { Kysely, sql } from 'kysely'
import { Database } from '../schema'
import { isValidCurseforgeRef, isValidModrinthRef } from '../ResourceMetadata'

export interface SweepCorruptedRefsResult {
  /** Number of rows whose modrinth column was nulled. */
  modrinthCleared: number
  /** Number of rows whose curseforge column was nulled. */
  curseforgeCleared: number
  /** Distinct rows affected (i.e. UI-facing "broken metadata" count). */
  rowsAffected: number
}

/**
 * One-shot startup sweep that walks the `resources` table and clears
 * obviously-corrupted modrinth / curseforge metadata (e.g. a file path
 * leaked into modrinth.versionId by older builds or third-party
 * importers). The row keeps its sha1/name/icons etc.; only the bad
 * reference column is nulled, so the file is still usable and can be
 * re-attributed via the sha1 lookup path.
 *
 * Safe to run unconditionally on every startup: O(rows) scan but each
 * UPDATE only touches rows whose JSON fails validation.
 */
export async function sweepCorruptedRefs(db: Kysely<Database>): Promise<SweepCorruptedRefsResult> {
  const rows = await db
    .selectFrom('resources')
    .select(['sha1', 'modrinth', 'curseforge'])
    .where((eb) => eb.or([
      eb('modrinth', 'is not', null),
      eb('curseforge', 'is not', null),
    ]))
    .execute()

  const result: SweepCorruptedRefsResult = {
    modrinthCleared: 0,
    curseforgeCleared: 0,
    rowsAffected: 0,
  }

  for (const row of rows) {
    const modrinthBad = row.modrinth && !isValidModrinthRef(row.modrinth as any)
    const curseforgeBad = row.curseforge && !isValidCurseforgeRef(row.curseforge as any)
    if (!modrinthBad && !curseforgeBad) continue

    const update: Record<string, any> = {}
    if (modrinthBad) {
      update.modrinth = null
      result.modrinthCleared++
    }
    if (curseforgeBad) {
      update.curseforge = null
      result.curseforgeCleared++
    }
    result.rowsAffected++

    await db
      .updateTable('resources')
      .set(update)
      .where('sha1', '=', row.sha1)
      .execute()
  }

  return result
}
