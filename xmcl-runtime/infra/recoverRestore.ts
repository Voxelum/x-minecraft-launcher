import { join } from 'path'
import type { LauncherApp } from '~/app'
import { RestoreTransaction } from '~/backup/restoreTransaction'

const recoveries = new WeakMap<LauncherApp, Promise<void>>()
/** All startup readers await the same recovery, including its rejection. */
export function recoverRestore(app: LauncherApp): Promise<void> {
  let recovery = recoveries.get(app)
  if (!recovery) {
    recovery = RestoreTransaction.recover(join(app.appDataPath, 'restore-transactions'))
    recoveries.set(app, recovery)
  }
  return recovery
}
