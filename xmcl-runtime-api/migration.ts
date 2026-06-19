/**
 * The phase of an in-flight data-root migration.
 *
 * - `scanning`: walking the source tree to compute the total size so the
 *   progress bar can be determinate. No bytes are moved yet.
 * - `migrating`: actually moving/copying files. `copiedBytes` / `copiedFiles`
 *   advance towards the totals.
 * - `done`: every candidate has been migrated.
 */
export type MigrationPhase = 'scanning' | 'migrating' | 'done'

export interface MigrationProgress {
  /**
   * The source data root being migrated away from.
   */
  from: string
  /**
   * The destination data root being migrated to.
   */
  to: string
  /**
   * The file currently being moved (absolute path), for display. Empty while
   * scanning.
   */
  file: string
  /**
   * Bytes moved so far.
   */
  copiedBytes: number
  /**
   * Total bytes to move. `0` until the scan finishes.
   */
  totalBytes: number
  /**
   * Files moved so far.
   */
  copiedFiles: number
  /**
   * Total files to move. `0` until the scan finishes.
   */
  totalFiles: number
  /**
   * Current phase of the migration.
   */
  phase: MigrationPhase
}

export interface Migration {
  getProgress(): Promise<MigrationProgress>
  on(event: 'progress', func: (payload: MigrationProgress) => void): void
  on(event: 'error', func: (payload: { file: string, error: object }) => void): void
}
