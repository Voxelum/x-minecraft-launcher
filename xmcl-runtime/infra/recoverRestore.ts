import { join } from 'path'
import type { LauncherApp } from '~/app'
import { RestoreTransaction } from '~/backup/restoreTransaction'
import { recoverXmclImport } from '~/setup/xmclImport'

const recoveries = new WeakMap<LauncherApp, Promise<void>>()
/** All startup readers await the same recovery, including its rejection. */
export function recoverRestore(app: LauncherApp): Promise<void> {
  let recovery = recoveries.get(app)
  if (!recovery) {
    recovery = recoverXmclImportOnce(app).then(() => RestoreTransaction.recover(join(app.appDataPath, 'restore-transactions')))
    recoveries.set(app, recovery)
  }
  return recovery
}

/**
 * Only the lock holder may apply a queued import: a second launch quits in setup.
 * Each file is replaced atomically and the journal survives, so a failure retries on
 * the next start instead of keeping the launcher from opening.
 */
async function recoverXmclImportOnce(app: LauncherApp) {
  if (!app.host.requestSingleInstanceLock()) return
  await recoverXmclImport(app.appDataPath).catch((e) => {
    app.getLogger('XmclImport').warn(e)
  })
}
