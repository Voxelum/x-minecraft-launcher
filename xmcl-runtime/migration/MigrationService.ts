import {
  MigrationProgress,
  MigrationService as IMigrationService,
  MigrationServiceKey,
} from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { LauncherApp } from '~/app/LauncherApp'
import { AbstractService, ExposeServiceKey } from '~/service'
import { MigrationReporter, kMigrationReporter } from './migrationReporter'

@ExposeServiceKey(MigrationServiceKey)
export class MigrationService extends AbstractService implements IMigrationService {
  #reporter: MigrationReporter | undefined

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, async () => {
      const reporter = await app.registry.get(kMigrationReporter)
      this.#reporter = reporter
      reporter.on('progress', (p) => {
        this.emit('migration-progress', p)
      })
      reporter.on('error', (e) => {
        this.emit('migration-error', e)
      })
    })
  }

  async getProgress(): Promise<MigrationProgress | undefined> {
    return this.#reporter?.getCurrent()
  }
}
