import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'

export interface MigrationProgress {
  from: string
  to: string
  progress: number
  total: number
}

export interface MigrationError {
  from: string
  to: string
  error: object
}

interface MigrationServiceEventMap {
  'migration-progress': MigrationProgress
  'migration-error': MigrationError
}

/**
 * Reports on the data-root migration that runs during early boot when the
 * launcher was relaunched with the `--migrate` flag.
 *
 * The migration progress is intentionally event-driven (not `SharedState`)
 * because this service must be safe to call before the regular state-sync
 * infrastructure is fully wired up — it runs while the data root is still
 * being moved.
 */
export interface MigrationService extends GenericEventEmitter<MigrationServiceEventMap> {
  /**
   * Snapshot of the current migration progress, or `undefined` if no
   * migration is in progress (i.e. the launcher booted normally).
   */
  getProgress(): Promise<MigrationProgress | undefined>
}

export const MigrationServiceKey: ServiceKey<MigrationService> = 'MigrationService'
