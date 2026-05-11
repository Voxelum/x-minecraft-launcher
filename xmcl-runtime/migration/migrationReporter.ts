import { EventEmitter } from 'events'
import { InjectionKey, LauncherAppPlugin } from '~/app'
import { MigrationError, MigrationProgress } from '@xmcl/runtime-api'

export interface MigrationReporter extends EventEmitter {
  on(event: 'progress', listener: (p: MigrationProgress) => void): this
  on(event: 'error', listener: (e: MigrationError) => void): this
  off(event: 'progress', listener: (p: MigrationProgress) => void): this
  off(event: 'error', listener: (e: MigrationError) => void): this
  emit(event: 'progress', payload: MigrationProgress): boolean
  emit(event: 'error', payload: MigrationError): boolean
  /** Last published progress, or undefined if no migration has started. */
  getCurrent(): MigrationProgress | undefined
  setProgress(progress: MigrationProgress): void
  setError(error: MigrationError): void
}

export const kMigrationReporter: InjectionKey<MigrationReporter> = Symbol('MigrationReporter')

class MigrationReporterImpl extends EventEmitter implements MigrationReporter {
  #current: MigrationProgress | undefined

  getCurrent() { return this.#current }

  setProgress(progress: MigrationProgress) {
    this.#current = progress
    this.emit('progress', progress)
  }

  setError(error: MigrationError) {
    this.emit('error', error)
  }
}

/**
 * Registers the migration reporter early in boot so `handleMigrateRoot`
 * (which runs during `LauncherApp.setup()`, before any service is
 * instantiated) can publish progress before the renderer-facing
 * `MigrationService` is created.
 */
export const pluginMigration: LauncherAppPlugin = (app) => {
  app.registry.register(kMigrationReporter, new MigrationReporterImpl())
}
